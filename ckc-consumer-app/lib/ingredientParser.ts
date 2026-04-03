// ─────────────────────────────────────────────
//  Ingredient / protein string utilities
// ─────────────────────────────────────────────

// ── Shopping categories ────────────────────────────────────────────────────

export const SHOPPING_CATEGORIES = [
  { key: 'protein',         label: 'Protein' },
  { key: 'produce',         label: 'Produce' },
  { key: 'dairy',           label: 'Dairy & Eggs' },
  { key: 'pantry-staples',  label: 'Pantry' },
] as const;

// ── Unit normalization ─────────────────────────────────────────────────────

const UNITS: Record<string, string> = {
  cups:'cup', cup:'cup',
  tablespoons:'tbsp', tablespoon:'tbsp', tbsp:'tbsp', tbs:'tbsp',
  teaspoons:'tsp', teaspoon:'tsp', tsp:'tsp',
  ounces:'oz', ounce:'oz', oz:'oz',
  pounds:'lb', pound:'lb', lb:'lb', lbs:'lb',
  grams:'g', gram:'g', g:'g',
  kilograms:'kg', kilogram:'kg', kg:'kg',
  cloves:'clove', clove:'clove',
  heads:'head', head:'head',
  bunches:'bunch', bunch:'bunch',
  cans:'can', can:'can',
  packages:'pkg', package:'pkg', pkg:'pkg',
  slices:'slice', slice:'slice',
  pieces:'piece', piece:'piece',
  sprigs:'sprig', sprig:'sprig',
  stalks:'stalk', stalk:'stalk',
  pinches:'pinch', pinch:'pinch',
};

const FRACTION_MAP: Record<string, string> = {
  '½':'1/2','⅓':'1/3','⅔':'2/3','¼':'1/4','¾':'3/4',
  '⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8',
};

// ── Category keywords ──────────────────────────────────────────────────────

const PROTEIN_WORDS = [
  'chicken','beef','pork','lamb','turkey','fish','salmon','tuna','shrimp',
  'scallop','cod','halibut','steak','ground beef','ground turkey','ground pork',
  'ground chicken','ground lamb','sausage','bacon','ham','egg','tofu','tempeh',
  'prawn','seafood','lobster','crab','brisket','roast','ribs','loin','filet',
  'tenderloin','breast','thigh','drumstick','wing',
];
const DAIRY_WORDS = [
  'butter','cream','milk','cheese','yogurt','cheddar','mozzarella','parmesan',
  'feta','ricotta','sour cream','heavy cream','half and half','brie','gouda',
  'gruyere','provolone','pecorino','romano','goat cheese','cottage cheese',
  'cream cheese','mascarpone','buttermilk','ghee',
];
const PRODUCE_WORDS = [
  'onion','garlic','ginger','lemon','lime','orange','tomato','pepper','carrot',
  'celery','potato','sweet potato','broccoli','spinach','kale','lettuce','arugula',
  'zucchini','eggplant','mushroom','asparagus','corn','peas','beans','avocado',
  'mango','apple','pear','peach','berry','strawberry','blueberry','raspberry',
  'shallot','scallion','leek','fennel','beet','squash','cucumber','radish',
  'cabbage','cauliflower','artichoke','basil','cilantro','parsley','thyme',
  'rosemary','mint','dill','sage','chive','herb',
];

export function categorizeIngredient(name: string): string {
  const n = name.toLowerCase();
  if (PROTEIN_WORDS.some(w => n.includes(w))) return 'protein';
  if (DAIRY_WORDS.some(w => n.includes(w))) return 'dairy';
  if (PRODUCE_WORDS.some(w => n.includes(w))) return 'produce';
  return 'pantry-staples';
}

// ── Number helpers ─────────────────────────────────────────────────────────

export function fmtNum(n: number): string {
  if (n === Math.floor(n)) return String(n);
  const frac: Record<string, string> = {
    '0.5':'½','0.25':'¼','0.75':'¾','0.333':'⅓','0.667':'⅔','0.125':'⅛',
  };
  const whole = Math.floor(n);
  const rem = parseFloat((n - whole).toFixed(3));
  const fr = frac[String(rem)];
  if (fr) return whole > 0 ? `${whole} ${fr}` : fr;
  return n.toFixed(1);
}

export function fmtQty(qty: number, unit: string, _category?: string): string {
  if (!qty) return unit || '';
  return unit ? `${fmtNum(qty)} ${unit}` : fmtNum(qty);
}

// ── Dairy sort group ───────────────────────────────────────────────────────

export function getDairyGroup(name: string): number {
  const n = name.toLowerCase();
  if (n.includes('egg')) return 1;
  const cheeses = ['parmesan','mozzarella','feta','cheddar','jack','gruyere',
    'brie','goat','ricotta','cream cheese','cottage','cheese'];
  if (cheeses.some(c => n.includes(c))) return 2;
  if (n.includes('sour cream') || n.includes('yogurt') || n.includes('crème')) return 3;
  return 4;
}

// ── Ingredient parser ──────────────────────────────────────────────────────

function parseQty(str: string): number {
  for (const [k, v] of Object.entries(FRACTION_MAP)) str = str.split(k).join(v);
  str = str.trim();
  let m = str.match(/^(\d+)\s+(\d+)\/(\d+)/);
  if (m) return parseInt(m[1]) + parseInt(m[2]) / parseInt(m[3]);
  m = str.match(/^(\d+)\/(\d+)/);
  if (m) return parseInt(m[1]) / parseInt(m[2]);
  m = str.match(/^(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
  if (m) return (parseFloat(m[1]) + parseFloat(m[2])) / 2;
  m = str.match(/^(\d+\.?\d*)/);
  if (m) return parseFloat(m[1]);
  return 0;
}

export function parseIngredient(raw: string): {
  qty: number; unit: string; name: string; category: string; raw: string;
} {
  if (!raw) return { qty: 0, unit: '', name: '', category: 'pantry-staples', raw };
  let str = raw.trim();
  for (const [k, v] of Object.entries(FRACTION_MAP)) str = str.split(k).join(v);

  // Extract quantity
  let qty = 0;
  const qtyPat = /^((?:\d+\s+)?\d+\/\d+|\d+\.?\d*(?:\s*[-–]\s*\d+\.?\d*)?)/;
  const qtyM = str.match(qtyPat);
  if (qtyM) { qty = parseQty(qtyM[1]); str = str.slice(qtyM[0].length).trim(); }

  // Extract unit
  let unit = '';
  const unitKeys = Object.keys(UNITS).sort((a, b) => b.length - a.length);
  for (const uk of unitKeys) {
    const pat = new RegExp('^' + uk.replace('.', '\\.') + '(?:\\b|\\s|,|$)', 'i');
    if (pat.test(str)) {
      unit = UNITS[uk];
      str = str.slice(uk.length).trim();
      if (str.startsWith('of ')) str = str.slice(3).trim();
      break;
    }
  }

  // Clean name
  const name = str
    .replace(/\(.*?\)/g, '')
    .replace(/,.*$/, '')
    .trim()
    .toLowerCase();

  return { qty, unit, name: name || raw.toLowerCase(), category: categorizeIngredient(name || raw), raw };
}

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
