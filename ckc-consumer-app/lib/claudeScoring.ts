/**
 * claudeScoring.ts — re-exports web implementation
 * The web implementation uses fetch which works on both web and React Native.
 */
export { scoreIngredientsWithClaude } from './claudeScoring.web';
export type { ScoredIngredient } from './claudeScoring.web';
