// ─────────────────────────────────────────────
//  Ingredient / protein string utilities
// ─────────────────────────────────────────────

// Normalizes a protein type label for display and search matching.
// e.g. 'Chicken' → 'chicken', 'Fish/Seafood' → 'fish/seafood'
export function normalizeProtein(protein: string): string {
  return protein.trim().toLowerCase();
}

// Normalizes a raw ingredient string from Firestore:
// - Decodes common HTML entities
// - Strips leading asterisks
// - Strips double-parenthesis notes like ((optional))
// - Strips trailing "plus more…" / "if needed" clauses
// - Normalizes all olive oil variants → "olive oil"
export function normalizeIngredient(raw: string): string {
  let s = raw.trim();

  // Decode common HTML entities
  s = s
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');

  // Strip leading asterisks
  s = s.replace(/^\*+\s*/, '');

  // Strip double-parenthesis notes: ((optional)), ((or to taste))
  s = s.replace(/\(\([^)]*\)\)/g, '').trim();

  // Strip trailing quantity/modifier clauses
  s = s.replace(/,?\s*plus more\b.*/i, '').trim();
  s = s.replace(/,?\s*\(plus more[^)]*\)/i, '').trim();
  s = s.replace(/,?\s*if (?:necessary|needed)\b.*/i, '').trim();
  s = s.replace(/,?\s*or more\b.*/i, '').trim();
  s = s.replace(/,?\s*to taste\b.*/i, '').trim();

  // Normalize olive oil variants → "olive oil"
  s = s.replace(/\bextra[- ]?virgin olive oil\b/gi, 'olive oil');
  s = s.replace(/\bevoo\b/gi, 'olive oil');
  s = s.replace(/\b(?:light|pure) olive oil\b/gi, 'olive oil');

  return s.trim();
}

// Formats a rating string like "4.9 (180 ratings)" → "4.9/5 · 180 ratings"
// Returns null for missing / NR / N/A ratings.
export function formatRating(rating: string | undefined | null): string | null {
  if (!rating || rating === 'NR' || rating === 'N/A') return null;
  const withCount = rating.match(/^([\d.]+)\s*\((\d[\d,]*)\s*rating/i);
  if (withCount) return `${withCount[1]}/5 · ${withCount[2]} ratings`;
  const num = parseFloat(rating);
  if (!isNaN(num)) return `${num}/5`;
  return null;
}
