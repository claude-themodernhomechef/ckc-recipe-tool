/**
 * gemini.web.ts — Web implementation of Gemini vision utilities
 *
 * Uses fetch + FileReader (available in browsers) to convert image URLs to base64
 * then calls the Gemini API directly.
 */

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

export interface ExtractedIngredient {
  raw: string;
  name: string;
  qty: string;
}

export interface PantryItem {
  name: string;
}

async function uriToBase64Web(uri: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(uri);
  const blob     = await response.blob();
  const mimeType = blob.type || 'image/jpeg';
  return new Promise((resolve, reject) => {
    const reader  = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result.split(',')[1], mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function callGemini(prompt: string, base64: string, mimeType: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64 } },
          ],
        }],
      }),
    }
  );
  const json = await response.json();
  console.log('[gemini.web] API response status:', response.status, JSON.stringify(json).slice(0, 300));
  if (!response.ok || json?.error) {
    throw new Error(json?.error?.message ?? `Gemini API error ${response.status}`);
  }
  let text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  // Strip markdown code blocks if Gemini wraps response in ```json ... ```
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return text;
}

export async function scanRecipePhoto(imageUri: string): Promise<ExtractedIngredient[]> {
  if (!API_KEY) throw new Error('GEMINI_KEY_MISSING');
  const { base64, mimeType } = await uriToBase64Web(imageUri);
  const prompt = `Extract every ingredient from this recipe image. Return ONLY a JSON array:
[{"raw":"2 cloves garlic","name":"garlic","qty":"2 cloves"}]
No explanation, no markdown, no code blocks. If no ingredient list found, return [].`;
  const text = (await callGemini(prompt, base64, mimeType)).trim();
  console.log('[gemini.web] scanRecipePhoto raw response:', text);
  if (!text || text === '[]') return [];
  return JSON.parse(text) as ExtractedIngredient[];
}

export async function scanPantryPhoto(imageUri: string): Promise<PantryItem[]> {
  if (!API_KEY) throw new Error('GEMINI_KEY_MISSING');
  const { base64, mimeType } = await uriToBase64Web(imageUri);
  const prompt = `List every food ingredient or product visible in this image. Return ONLY a JSON array:
[{"name":"olive oil"},{"name":"garlic"}]
No explanation, no markdown, no code blocks. Lowercase names. If nothing found, return [].`;
  const text = (await callGemini(prompt, base64, mimeType)).trim();
  return JSON.parse(text) as PantryItem[];
}
