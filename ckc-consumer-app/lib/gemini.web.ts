/**
 * gemini.web.ts — Web stub
 *
 * Gemini vision calls require the mobile app (camera + native APIs).
 * This stub is automatically used by Expo for web builds.
 */

export interface ExtractedIngredient {
  raw: string;
  name: string;
  qty: string;
}

export interface PantryItem {
  name: string;
}

export async function scanRecipePhoto(_imageUri: string): Promise<ExtractedIngredient[]> {
  return [];
}

export async function scanPantryPhoto(_imageUri: string): Promise<PantryItem[]> {
  return [];
}
