"use strict";
/**
 * CKC Firebase Cloud Functions
 *
 * onRecipeApproved  — fires when a recipe's status changes to "yes"
 *                     enriches: protein_type, menu_description, dietTags
 *
 * manualEnrich      — HTTPS callable: enrich a single recipe by ID on demand
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkEnrich = exports.manualEnrich = exports.onRecipeApproved = exports.scrapeImageForRecipe = exports.weeklyImageScrape = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const classifyProtein_1 = require("./enrichment/classifyProtein");
const classifyDietTags_1 = require("./enrichment/classifyDietTags");
const fetchDescription_1 = require("./enrichment/fetchDescription");
const firebaseAdmin_1 = require("./firebaseAdmin");
// Re-export Phase 4 image scraping functions
var scrapeImages_1 = require("./scrapeImages");
Object.defineProperty(exports, "weeklyImageScrape", { enumerable: true, get: function () { return scrapeImages_1.weeklyImageScrape; } });
Object.defineProperty(exports, "scrapeImageForRecipe", { enumerable: true, get: function () { return scrapeImages_1.scrapeImageForRecipe; } });
// ── Helper: run enrichment for one recipe doc ─────────────────────────────────
async function enrichRecipe(docRef, data) {
    const name = data.name || '';
    const url = data.url || '';
    const ingredients = data.ingredients || [];
    const blogger = data.blogger || '';
    const updates = {};
    // 1. Protein type
    if (!data.protein_type) {
        const protein = (0, classifyProtein_1.classifyProtein)(name);
        if (protein)
            updates.protein_type = protein;
    }
    // 2. Menu description
    if (!data.menu_description || data.menu_description === '') {
        const desc = await (0, fetchDescription_1.fetchDescription)(url, data.menu_description);
        if (desc)
            updates.menu_description = desc;
    }
    // 3. Diet tags
    if (!data.dietTags || Object.keys(data.dietTags).length === 0) {
        const dietTags = (0, classifyDietTags_1.classifyDietTags)(ingredients, name, blogger);
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
exports.onRecipeApproved = functions.firestore
    .document('recipes/{recipeId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // Only run when status just became "yes"
    if (before.status === 'yes' || after.status !== 'yes')
        return null;
    functions.logger.info(`Enriching recipe: ${context.params.recipeId}`);
    try {
        await enrichRecipe(change.after.ref, after);
        functions.logger.info(`Done enriching: ${context.params.recipeId}`);
    }
    catch (err) {
        functions.logger.error(`Error enriching ${context.params.recipeId}:`, err);
    }
    return null;
});
// ── HTTPS Callable: manually trigger enrichment for one recipe ────────────────
exports.manualEnrich = functions.https.onCall(async (data, context) => {
    const recipeId = data === null || data === void 0 ? void 0 : data.recipeId;
    if (!recipeId)
        throw new functions.https.HttpsError('invalid-argument', 'recipeId required');
    const docRef = firebaseAdmin_1.db.collection('recipes').doc(recipeId);
    const snap = await docRef.get();
    if (!snap.exists)
        throw new functions.https.HttpsError('not-found', `Recipe ${recipeId} not found`);
    await enrichRecipe(docRef, snap.data());
    return { success: true, recipeId };
});
// ── HTTPS Callable: re-enrich ALL approved recipes (admin use only) ───────────
exports.bulkEnrich = functions
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .https.onCall(async (data, _context) => {
    var _a;
    // Simple password gate — matches the admin UI gate
    const adminPassword = ((_a = functions.config().admin) === null || _a === void 0 ? void 0 : _a.password) || 'ckc-admin';
    if ((data === null || data === void 0 ? void 0 : data.password) !== adminPassword) {
        throw new functions.https.HttpsError('permission-denied', 'Wrong password');
    }
    const snap = await firebaseAdmin_1.db.collection('recipes').where('status', '==', 'yes').get();
    functions.logger.info(`Bulk enriching ${snap.size} recipes`);
    let enriched = 0;
    let errors = 0;
    for (const doc of snap.docs) {
        try {
            await enrichRecipe(doc.ref, doc.data());
            enriched++;
        }
        catch (err) {
            functions.logger.error(`Error on ${doc.id}:`, err);
            errors++;
        }
        // Small delay to avoid hammering external URLs
        await new Promise((r) => setTimeout(r, 200));
    }
    return { enriched, errors, total: snap.size };
});
//# sourceMappingURL=index.js.map