"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bucket = exports.db = void 0;
/**
 * Shared Firebase Admin initialization.
 * Import `db` and `bucket` from here instead of calling initializeApp() in each file.
 */
const admin = require("firebase-admin");
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.db = admin.firestore();
exports.bucket = admin.storage().bucket('ckc-recipe-swipe.firebasestorage.app');
//# sourceMappingURL=firebaseAdmin.js.map