"use strict";
/**
 * scrapeImages — Phase 4
 *
 * weeklyImageScrape  — Pub/Sub scheduled function: every Monday at 2am ET
 *                      Finds recipes with no image, scrapes og:image, uploads to Storage.
 *
 * scrapeImageForRecipe — HTTPS callable: scrape a single recipe on demand from the admin UI.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeImageForRecipe = exports.weeklyImageScrape = void 0;
const functions = require("firebase-functions");
const https = require("https");
const http = require("http");
const firebaseAdmin_1 = require("./firebaseAdmin");
const admin = require("firebase-admin");
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BATCH_SIZE = 50; // max recipes to process per scheduled run
// ── Fetch raw HTML ────────────────────────────────────────────────────────────
function fetchHtml(url, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const req = lib.get(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' } }, (res) => {
            if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                fetchHtml(res.headers.location, timeoutMs).then(resolve).catch(reject);
                return;
            }
            if (!res.statusCode || res.statusCode >= 400) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(Buffer.from(c)));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
            res.on('error', reject);
        });
        req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
        req.on('error', reject);
    });
}
// ── Fetch image bytes from a URL ──────────────────────────────────────────────
function fetchImageBytes(url, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const req = lib.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
            if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
                fetchImageBytes(res.headers.location, timeoutMs).then(resolve).catch(reject);
                return;
            }
            if (!res.statusCode || res.statusCode >= 400) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            const contentType = (res.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
            const chunks = [];
            res.on('data', (c) => chunks.push(Buffer.from(c)));
            res.on('end', () => resolve({ bytes: Buffer.concat(chunks), contentType }));
            res.on('error', reject);
        });
        req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
        req.on('error', reject);
    });
}
// ── Extract og:image URL from HTML ───────────────────────────────────────────
function extractOgImage(html) {
    let m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (!m)
        m = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return m ? m[1].trim() : null;
}
// ── Slugify recipe ID for storage path ───────────────────────────────────────
function storageSlug(recipeId) {
    return recipeId.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 80);
}
// ── Core: fetch og:image → upload to Storage → return public URL ─────────────
async function scrapeAndUpload(recipeId, pageUrl) {
    try {
        const html = await fetchHtml(pageUrl);
        const imageUrl = extractOgImage(html);
        if (!imageUrl) {
            functions.logger.info(`No og:image for ${recipeId}`);
            return null;
        }
        const { bytes, contentType } = await fetchImageBytes(imageUrl);
        const ext = contentType.replace('image/', '').replace('jpeg', 'jpg');
        const slug = storageSlug(recipeId);
        const blob = firebaseAdmin_1.bucket.file(`images/${slug}.${ext}`);
        await blob.save(bytes, { contentType, resumable: false });
        await blob.makePublic();
        return blob.publicUrl();
    }
    catch (err) {
        functions.logger.warn(`scrapeAndUpload failed for ${recipeId}:`, err);
        return null;
    }
}
// ── Scheduled: runs every Monday at 2am Eastern ──────────────────────────────
exports.weeklyImageScrape = functions
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .pubsub.schedule('every monday 02:00')
    .timeZone('America/New_York')
    .onRun(async () => {
    // Find approved recipes with no image, up to BATCH_SIZE
    const snap = await firebaseAdmin_1.db
        .collection('recipes')
        .where('status', '==', 'yes')
        .where('photo_url', '==', null)
        .limit(BATCH_SIZE)
        .get();
    functions.logger.info(`Weekly image scrape: ${snap.size} recipes to process`);
    let scraped = 0;
    for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const url = data.url || '';
        if (!url)
            continue;
        const publicUrl = await scrapeAndUpload(docSnap.id, url);
        if (publicUrl) {
            await docSnap.ref.update({
                photo_url: publicUrl,
                image: publicUrl,
                imageScrapedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            scraped++;
        }
        // Polite delay between requests
        await new Promise((r) => setTimeout(r, 600));
    }
    functions.logger.info(`Weekly image scrape done: ${scraped}/${snap.size} images uploaded`);
    return null;
});
// ── HTTPS Callable: scrape a single recipe from the admin UI ─────────────────
exports.scrapeImageForRecipe = functions.https.onCall(async (data, _context) => {
    var _a;
    const recipeId = data === null || data === void 0 ? void 0 : data.recipeId;
    if (!recipeId)
        throw new functions.https.HttpsError('invalid-argument', 'recipeId required');
    const docRef = firebaseAdmin_1.db.collection('recipes').doc(recipeId);
    const docSnap = await docRef.get();
    if (!docSnap.exists)
        throw new functions.https.HttpsError('not-found', `Recipe ${recipeId} not found`);
    const pageUrl = ((_a = docSnap.data()) === null || _a === void 0 ? void 0 : _a.url) || '';
    if (!pageUrl)
        throw new functions.https.HttpsError('failed-precondition', 'Recipe has no URL');
    const publicUrl = await scrapeAndUpload(recipeId, pageUrl);
    if (!publicUrl)
        return { success: false, recipeId };
    await docRef.update({
        photo_url: publicUrl,
        image: publicUrl,
        imageScrapedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, recipeId, url: publicUrl };
});
//# sourceMappingURL=scrapeImages.js.map