/**
 * CKC Firebase Cloud Functions
 *
 * onRecipeApproved  — fires when a recipe's status changes to "yes"
 *                     enriches: protein_type, menu_description, dietTags
 *
 * manualEnrich      — HTTPS callable: enrich a single recipe by ID on demand
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { classifyProtein } from './enrichment/classifyProtein';
import { classifyDietTags } from './enrichment/classifyDietTags';
import { fetchDescription } from './enrichment/fetchDescription';
import { db } from './firebaseAdmin';

// Re-export Phase 4 image scraping functions
export { weeklyImageScrape, scrapeImageForRecipe } from './scrapeImages';

// ── Helper: run enrichment for one recipe doc ─────────────────────────────────

async function enrichRecipe(
  docRef: admin.firestore.DocumentReference,
  data: admin.firestore.DocumentData,
): Promise<void> {
  const name: string = data.name || '';
  const url: string = data.url || '';
  const ingredients: string[] = data.ingredients || [];
  const blogger: string = data.blogger || '';

  const updates: Record<string, unknown> = {};

  // 1. Protein type
  if (!data.protein_type) {
    const protein = classifyProtein(name);
    if (protein) updates.protein_type = protein;
  }

  // 2. Menu description
  if (!data.menu_description || data.menu_description === '') {
    const desc = await fetchDescription(url, data.menu_description);
    if (desc) updates.menu_description = desc;
  }

  // 3. Diet tags
  if (!data.dietTags || Object.keys(data.dietTags).length === 0) {
    const dietTags = classifyDietTags(ingredients, name, blogger);
    updates.dietTags = dietTags;
  }

  // 4. Clear needsManualReview if we filled in all three
  updates.enrichedAt = admin.firestore.FieldValue.serverTimestamp();
  updates.needsManualReview = false;

  if (Object.keys(updates).length > 0) {
    await docRef.update(updates);
  }
}

// ── Trigger: fires when recipe status changes to "yes" ────────────────────────

export const onRecipeApproved = functions.firestore
  .document('recipes/{recipeId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only run when status just became "yes"
    if (before.status === 'yes' || after.status !== 'yes') return null;

    functions.logger.info(`Enriching recipe: ${context.params.recipeId}`);

    try {
      await enrichRecipe(change.after.ref, after);
      functions.logger.info(`Done enriching: ${context.params.recipeId}`);
    } catch (err) {
      functions.logger.error(`Error enriching ${context.params.recipeId}:`, err);
    }

    return null;
  });

// ── HTTPS Callable: manually trigger enrichment for one recipe ────────────────

export const manualEnrich = functions.https.onCall(async (data, context) => {
  const recipeId: string = data?.recipeId;
  if (!recipeId) throw new functions.https.HttpsError('invalid-argument', 'recipeId required');

  const docRef = db.collection('recipes').doc(recipeId);
  const snap = await docRef.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', `Recipe ${recipeId} not found`);

  await enrichRecipe(docRef, snap.data()!);
  return { success: true, recipeId };
});

// ── HTTPS Callable: re-enrich ALL approved recipes (admin use only) ───────────

export const bulkEnrich = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onCall(async (data, _context) => {
    // Simple password gate — matches the admin UI gate
    const adminPassword = functions.config().admin?.password || 'ckc-admin';
    if (data?.password !== adminPassword) {
      throw new functions.https.HttpsError('permission-denied', 'Wrong password');
    }

    const snap = await db.collection('recipes').where('status', '==', 'yes').get();
    functions.logger.info(`Bulk enriching ${snap.size} recipes`);

    let enriched = 0;
    let errors = 0;
    for (const doc of snap.docs) {
      try {
        await enrichRecipe(doc.ref, doc.data());
        enriched++;
      } catch (err) {
        functions.logger.error(`Error on ${doc.id}:`, err);
        errors++;
      }
      // Small delay to avoid hammering external URLs
      await new Promise((r) => setTimeout(r, 200));
    }

    return { enriched, errors, total: snap.size };
  });
