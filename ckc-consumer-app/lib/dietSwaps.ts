import swapTable from '../data/masterSwapTable.json';

// Strictest diet wins when multiple are active.
const DIET_PRIORITY = ['AIP', 'LH', 'V', 'Vg', 'LF', 'K', 'GF', 'DF'] as const;
type DietCode = (typeof DIET_PRIORITY)[number];

type SwapEntry = {
  type: 'replace' | 'remove' | 'note' | 'keep';
  to?: string;
  note?: string;
};

export type SwapResult = {
  name: string;
  swapNote: string;
  removed: boolean;
  swapType: 'replace' | 'remove' | 'note' | 'keep' | 'none';
};

const table = swapTable as Record<string, Record<string, SwapEntry>>;

export function applyDietSwap(ingredientName: string, activeDiets: string[]): SwapResult {
  const none: SwapResult = { name: ingredientName, swapNote: '', removed: false, swapType: 'none' };

  if (!ingredientName || activeDiets.length === 0) return none;

  const key = ingredientName.toLowerCase().trim();
  const entry = table[key];
  if (!entry) return none;

  const winningDiet = DIET_PRIORITY.find(
    (diet) => activeDiets.includes(diet) && entry[diet],
  );
  if (!winningDiet) return none;

  const swap = entry[winningDiet];

  if (swap.type === 'keep') {
    return { ...none, swapType: 'keep' };
  }

  if (swap.type === 'remove') {
    return { name: ingredientName, swapNote: swap.note ?? '', removed: true, swapType: 'remove' };
  }

  if (swap.type === 'note') {
    return { name: ingredientName, swapNote: swap.note ?? '', removed: false, swapType: 'note' };
  }

  // type === 'replace'
  return {
    name: swap.to ?? ingredientName,
    swapNote: swap.note ?? `${winningDiet} swap`,
    removed: false,
    swapType: 'replace',
  };
}
