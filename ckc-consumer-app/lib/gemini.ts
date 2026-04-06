/**
 * gemini.ts — Gemini Vision utilities
 *
 * scanRecipePhoto   — extract ingredient list from a recipe photo
 * scanPantryPhoto   — identify ingredients visible in a pantry/fridge photo
 *
 * API key is read from EXPO_PUBLIC_GEMINI_API_KEY in .env (never committed to git)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

if (!API_KEY) {
  console.warn('[gemini] EXPO_PUBLIC_GEMINI_API_KEY is not set');
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface ExtractedIngredient {
  raw: string;   // e.g. "2 cloves garlic"
  name: string;  // e.g. "garlic"
  qty:  string;  // e.g. "2 cloves"
}

export interface PantryItem {
  name: string;  // e.g. "olive oil"
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/**
 * Convert a local image URI to a base64 string for the Gemini API.
 * Works with Expo ImagePicker results (file:// URIs).
 */
async function uriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob     = await response.blob();
  // Use FileReader if available (web), otherwise use arrayBuffer (React Native)
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader  = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    const buffer = await blob.arrayBuffer();
    const bytes  = new Uint8Array(buffer);
    let binary   = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }
}

function getMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.png'))  return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

// ─────────────────────────────────────────────
//  Recipe Photo Scan
// ─────────────────────────────────────────────

/**
 * Extract a structured ingredient list from a recipe photo or screenshot.
 * Returns an array of ingredients with name and quantity separated.
 */
export async function scanRecipePhoto(imageUri: string): Promise<ExtractedIngredient[]> {
  const base64    = await uriToBase64(imageUri);
  const mimeType  = getMimeType(imageUri);

  const prompt = `
You are looking at a recipe photo, screenshot, or printed recipe page.

Extract every ingredient listed. For each ingredient return a JSON array with this exact format:
[
  { "raw": "2 cloves garlic", "name": "garlic", "qty": "2 cloves" },
  { "raw": "1 tbsp olive oil", "name": "olive oil", "qty": "1 tbsp" }
]

Rules:
- Return ONLY valid JSON — no explanation, no markdown, no code blocks
- If you cannot find an ingredient list in the image, return an empty array: []
- Normalize ingredient names to lowercase
- Keep quantities as-is from the original text
`.trim();

  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType, data: base64 } },
  ]);

  const text = result.response.text().trim();

  try {
    return JSON.parse(text) as ExtractedIngredient[];
  } catch {
    console.warn('[gemini] scanRecipePhoto: failed to parse JSON', text);
    return [];
  }
}

// ─────────────────────────────────────────────
//  Pantry Photo Scan
// ─────────────────────────────────────────────

/**
 * Identify food ingredients and products visible in a pantry/fridge photo.
 * Returns a flat list of ingredient names to cross-reference with the shopping list.
 */
export async function scanPantryPhoto(imageUri: string): Promise<PantryItem[]> {
  const base64   = await uriToBase64(imageUri);
  const mimeType = getMimeType(imageUri);

  const prompt = `
You are looking at a photo of someone's fridge, pantry, or spice rack.

List every food ingredient or grocery product you can identify. Return a JSON array:
[
  { "name": "olive oil" },
  { "name": "garlic" },
  { "name": "chicken breast" }
]

Rules:
- Return ONLY valid JSON — no explanation, no markdown, no code blocks
- Normalize all names to lowercase
- Be specific — "cheddar cheese" not just "cheese", "baby spinach" not just "greens"
- If you cannot identify any food items, return an empty array: []
`.trim();

  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType, data: base64 } },
  ]);

  const text = result.response.text().trim();

  try {
    return JSON.parse(text) as PantryItem[];
  } catch {
    console.warn('[gemini] scanPantryPhoto: failed to parse JSON', text);
    return [];
  }
}
