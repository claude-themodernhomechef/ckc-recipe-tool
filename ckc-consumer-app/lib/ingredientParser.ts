// ─────────────────────────────────────────────
//  Ingredient / protein string utilities
// ─────────────────────────────────────────────

// Normalizes a protein type label for display and search matching.
// e.g. 'Chicken' → 'chicken', 'Fish/Seafood' → 'fish/seafood'
export function normalizeProtein(protein: string): string {
  return protein.trim().toLowerCase();
}
