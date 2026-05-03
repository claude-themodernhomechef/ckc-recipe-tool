/**
 * Phase 1 — One-time migration: recipes.json → Firestore
 *
 * Usage:
 *   node scripts/migrate_to_firestore.js
 *
 * Reads the service account from ../service-account.json (one level up from repo root).
 * Writes all recipes to the `recipes` collection in Firestore.
 *
 * Field mapping (recipes.json → Firestore):
 *   course      → course (kept) + meal_type (lowercase, for consumer app)
 *   protein     → protein (kept) + protein_type (for consumer app)
 *   description → description (kept) + menu_description (for consumer app)
 *   image       → image (kept) + photo_url (for consumer app)
 *
 * Status logic:
 *   All existing recipes → status: "yes"  (they were already curated/published)
 *   Missing dietTags     → needsManualReview: true  (can't be enriched without ingredients)
 */

const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

// ── Init Firebase ─────────────────────────────────────────────────────────────

// Walk up from script dir until we find service-account.json (handles worktree nesting)
function findServiceAccount() {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'service-account.json');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}
const serviceAccountPath = findServiceAccount();
if (!serviceAccountPath) {
  console.error('ERROR: service-account.json not found at', serviceAccountPath);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
});

const db = admin.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(url) {
  try {
    const pathname = new URL(url).pathname;
    return pathname
      .replace(/^\/|\/$/g, '')   // strip leading/trailing slashes
      .replace(/\//g, '-')        // replace remaining slashes with dashes
      .replace(/[^a-z0-9-]/gi, '') // strip non-alphanumeric
      .toLowerCase()
      .slice(0, 100);             // Firestore doc IDs max 1500 bytes, keep reasonable
  } catch {
    // Fallback: slugify the recipe name
    return url.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 100);
  }
}

function mapCourseToMealType(course) {
  if (!course) return 'entree';
  const c = course.toLowerCase();
  if (c.includes('entree') || c.includes('main'))  return 'entree';
  if (c.includes('side'))                           return 'side';
  if (c.includes('salad'))                          return 'salad';
  if (c.includes('soup'))                           return 'soup';
  if (c.includes('breakfast'))                      return 'breakfast';
  if (c.includes('dessert'))                        return 'dessert';
  if (c.includes('snack') || c.includes('app'))     return 'snack';
  return 'entree';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const recipesPath = path.join(__dirname, '../recipes.json');
  const recipes = JSON.parse(fs.readFileSync(recipesPath, 'utf8'));
  console.log(`Loaded ${recipes.length} recipes from recipes.json`);

  // Check for slug collisions before writing
  const slugsSeen = new Set();
  const collisions = [];
  for (const r of recipes) {
    const slug = slugify(r.url || r.name);
    if (slugsSeen.has(slug)) {
      collisions.push({ name: r.name, slug });
    }
    slugsSeen.add(slug);
  }
  if (collisions.length > 0) {
    console.warn(`WARNING: ${collisions.length} slug collision(s) detected:`);
    collisions.forEach(c => console.warn(' ', c.name, '→', c.slug));
    console.warn('These recipes will overwrite each other. Proceeding anyway.');
  }

  // Batch write — Firestore limit is 500 per batch
  const BATCH_SIZE = 400;
  let written = 0;
  let skipped = 0;

  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const chunk = recipes.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const r of chunk) {
      const slug = slugify(r.url || r.name);
      if (!slug) { skipped++; continue; }

      const hasDietTags   = r.dietTags && Object.keys(r.dietTags).length > 0;
      const hasIngredients = r.ingredients && r.ingredients.length > 0;

      const doc = {
        // ── Original fields (kept as-is) ──
        name:           r.name          || '',
        url:            r.url           || '',
        cuisine:        r.cuisine       || '',
        course:         r.course        || '',
        description:    r.description   || '',
        image:          r.image         || null,
        protein:        r.protein       || '',
        rating:         r.rating        || '',
        blogger:        r.blogger       || '',
        alignmentScore: r.alignmentScore || '',
        dietTags:       r.dietTags      || {},
        ingredients:    r.ingredients   || [],

        // ── Consumer app fields (mapped) ──
        meal_type:        mapCourseToMealType(r.course),
        protein_type:     r.protein       || '',
        menu_description: r.description   || '',
        photo_url:        r.image         || null,
        prep_time:        null,           // not in source data yet

        // ── Pipeline fields ──
        status:             'yes',        // all existing recipes are approved
        needsManualReview:  !hasDietTags, // flag recipes that can't be auto-enriched
        enrichedAt:         hasDietTags ? admin.firestore.FieldValue.serverTimestamp() : null,
        decidedAt:          admin.firestore.FieldValue.serverTimestamp(),
        sourceAddedAt:      admin.firestore.FieldValue.serverTimestamp(),
      };

      const ref = db.collection('recipes').doc(slug);
      batch.set(ref, doc, { merge: false });
      written++;
    }

    await batch.commit();
    console.log(`  Wrote batch ${Math.floor(i / BATCH_SIZE) + 1}: ${Math.min(i + BATCH_SIZE, recipes.length)} / ${recipes.length} recipes`);
  }

  console.log(`\nDone. Written: ${written}, Skipped: ${skipped}`);
  console.log(`Recipes needing manual review (no diet tags): ${recipes.filter(r => !r.dietTags || Object.keys(r.dietTags).length === 0).length}`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
