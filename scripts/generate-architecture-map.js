#!/usr/bin/env node
/**
 * generate-architecture-map.js
 *
 * Scans the CKC repo for files in screens/, lib/, context/, components/,
 * navigation/, functions/src/, plus key data files and Firestore collection
 * references. Builds NODES + EDGES arrays from real imports and merges in
 * hand-written narrative from scripts/architecture-overrides.json.
 *
 * Writes the result into ckc-consumer-app/public/admin-static/architecture-map.html
 * by replacing the marker comments:
 *   // <<NODES_START>> … // <<NODES_END>>
 *   // <<EDGES_START>> … // <<EDGES_END>>
 *
 * Run manually:    node scripts/generate-architecture-map.js
 * Run on deploy:   wired into vercel.json buildCommand
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP  = path.join(ROOT, 'ckc-consumer-app');
const FN   = path.join(ROOT, 'functions/src');
const OUT  = path.join(APP, 'public/admin-static/architecture-map.html');
const OVERRIDES_PATH = path.join(__dirname, 'architecture-overrides.json');

// ── 1. Discover source files ─────────────────────────────────────────────────
function walk(dir, ext = ['.ts', '.tsx']) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walk(full, ext));
    else if (ext.includes(path.extname(name))) out.push(full);
  }
  return out;
}

const SOURCE_DIRS = [
  { dir: path.join(APP, 'screens'),    cat: (f) => f.includes('/admin/') ? 'admin'
                                                  : f.includes('/main/')  ? 'screen'
                                                  : f.includes('/components/') ? 'comp'
                                                  : 'screen' },
  { dir: path.join(APP, 'navigation'), cat: () => 'entry' },
  { dir: path.join(APP, 'lib'),        cat: () => 'lib' },
  { dir: path.join(APP, 'context'),    cat: () => 'ctx' },
  { dir: FN,                           cat: (f) => f.includes('/enrichment/') ? 'fn' : 'fn' },
];

const APP_TSX = path.join(APP, 'App.tsx');

// Build the file index
const files = [];
files.push({ abs: APP_TSX, cat: 'entry' });
for (const { dir, cat } of SOURCE_DIRS) {
  for (const abs of walk(dir)) {
    // skip .web.ts variants — we map both web/native under the same node
    if (/\.web\.ts$/.test(abs)) continue;
    files.push({ abs, cat: cat(abs) });
  }
}

// Strip non-source noise
const SKIP_NAMES = new Set(['index.ts', 'index.tsx']); // index.ts at functions/src is kept (renamed below)
const filtered = files.filter(f => {
  const name = path.basename(f.abs);
  // keep functions/src/index.ts (cloud fn entry)
  if (f.abs.startsWith(FN) && name === 'index.ts') return true;
  return !SKIP_NAMES.has(name) || f.abs === APP_TSX;
});

// ── 2. Build node list ───────────────────────────────────────────────────────
function nodeIdFor(abs) {
  const rel = path.relative(ROOT, abs);
  const base = path.basename(abs, path.extname(abs));
  if (abs === APP_TSX) return 'App';
  if (rel.startsWith('functions/src/index.ts')) return 'fn_index';
  return base;
}

function labelFor(abs, id) {
  if (id === 'App') return 'App.tsx';
  if (id === 'fn_index') return 'functions/index';
  return path.basename(abs, path.extname(abs));
}

function subFor(abs, cat) {
  const rel = path.relative(ROOT, abs);
  if (rel.includes('screens/main/'))       return 'main tab';
  if (rel.includes('screens/admin/'))      return 'admin';
  if (rel.includes('screens/components/')) return 'component';
  if (rel.includes('navigation/'))         return 'navigator';
  if (rel.includes('functions/src/enrichment/')) return 'enrichment';
  if (rel.includes('functions/src/'))      return 'cloud fn';
  if (rel.includes('lib/'))                return 'service';
  if (rel.includes('context/'))            return 'context';
  return '';
}

const filesById = new Map();
for (const f of filtered) {
  const id = nodeIdFor(f.abs);
  if (!filesById.has(id)) filesById.set(id, { ...f, id });
}

// Synthetic / non-file nodes (Firestore collections + external APIs + data files)
const SYNTHETIC = [
  { id: 'recipes_collection',     label: 'recipes',              sub: 'Firestore coll', cat: 'coll', path: 'collection: recipes' },
  { id: 'decisions_collection',   label: 'decisions',            sub: 'Firestore coll', cat: 'coll', path: 'collection: decisions' },
  { id: 'ingredientCategories_collection', label: 'ingredientCategories', sub: 'Firestore coll', cat: 'coll', path: 'collection: ingredientCategories' },
  { id: 'masterSwapTable',        label: 'masterSwapTable',      sub: 'json',           cat: 'data', path: 'data/masterSwapTable.json' },
  { id: 'ingredientMasterList',   label: 'ingredient_master_list', sub: 'json',         cat: 'data', path: 'ingredient_master_list.json' },
  { id: 'dietRules',              label: 'diet-rules',           sub: 'json',           cat: 'data', path: 'functions/diet-rules.json' },
  { id: 'sampleRecipes',          label: 'sampleRecipes',        sub: 'dev seed',       cat: 'data', path: 'ckc-consumer-app/data/sampleRecipes.ts' },
  { id: 'ext_firebase',           label: 'Firebase',             sub: 'auth+db',        cat: 'ext',  path: 'external service' },
  { id: 'ext_gemini',             label: 'Gemini API',           sub: 'photo OCR',      cat: 'ext',  path: 'external service' },
  { id: 'ext_claude',             label: 'Claude API',           sub: 'classification', cat: 'ext',  path: 'external service' },
];

// ── 3. Parse imports → edges ─────────────────────────────────────────────────
const IMPORT_RE = /(?:import\s+(?:[\s\S]*?)\s+from\s+|require\(\s*)['"]([^'"]+)['"]/g;

function importsFrom(abs) {
  const src = fs.readFileSync(abs, 'utf8');
  const out = [];
  let m;
  while ((m = IMPORT_RE.exec(src))) {
    const spec = m[1];
    if (spec.startsWith('.')) out.push(spec);
  }
  return out;
}

function resolveImport(fromAbs, spec) {
  const baseDir = path.dirname(fromAbs);
  const candidates = [
    spec,
    spec + '.ts', spec + '.tsx', spec + '.js',
    path.join(spec, 'index.ts'), path.join(spec, 'index.tsx'),
  ];
  for (const c of candidates) {
    const abs = path.resolve(baseDir, c);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  return null;
}

const edges = []; // [fromId, toId, kind?]
const edgeKey = new Set();
function addEdge(a, b, kind = '') {
  if (a === b) return;
  const k = `${a}->${b}|${kind}`;
  if (edgeKey.has(k)) return;
  edgeKey.add(k);
  edges.push(kind ? [a, b, kind] : [a, b]);
}

// Map collection/external references found in source content
const COLL_RE = /collection\(\s*(?:db,\s*)?['"](\w+)['"]/g;
const COLL_TO_NODE = {
  recipes: 'recipes_collection',
  decisions: 'decisions_collection',
  ingredientCategories: 'ingredientCategories_collection',
};

for (const f of filesById.values()) {
  const fromId = f.id;
  const src = fs.readFileSync(f.abs, 'utf8');

  // file → file edges via imports
  for (const spec of importsFrom(f.abs)) {
    const resolved = resolveImport(f.abs, spec);
    if (!resolved) continue;
    // map .web.ts to its plain sibling so DiscoverScreen → claudeScoring (not .web)
    const cleaned = resolved.replace(/\.web\.ts$/, '.ts');
    const targetId = nodeIdFor(cleaned);
    if (filesById.has(targetId)) addEdge(fromId, targetId);
  }

  // file → Firestore collection
  let cm;
  COLL_RE.lastIndex = 0;
  while ((cm = COLL_RE.exec(src))) {
    const target = COLL_TO_NODE[cm[1]];
    if (target) addEdge(fromId, target);
  }

  // file → external (heuristic by source content)
  if (/firebase\/(app|firestore|auth|storage)|getFirestore|initializeApp/.test(src)) {
    addEdge(fromId, 'ext_firebase');
  }
  if (/@google\/genai|GoogleGenerativeAI|gemini/i.test(src) && f.id !== 'ext_gemini') {
    if (/lib\/gemini/.test(f.abs) || /scanRecipePhoto|scanPantryPhoto/.test(src)) {
      addEdge(fromId, 'ext_gemini');
    }
  }
  if (/@anthropic-ai\/sdk|claude-/i.test(src) && f.id !== 'ext_claude') {
    addEdge(fromId, 'ext_claude');
  }

  // Hard-coded JSON imports → data nodes
  if (/masterSwapTable\.json/.test(src)) addEdge(fromId, 'masterSwapTable');
  if (/ingredient_master_list\.json/.test(src)) addEdge(fromId, 'ingredientMasterList');
  if (/diet-rules\.json/.test(src)) addEdge(fromId, 'dietRules');
  if (/sampleRecipes/.test(src) && f.id !== 'sampleRecipes') addEdge(fromId, 'sampleRecipes');
}

// ── 4. Assemble final NODES list with column/row layout ──────────────────────
const COL_FOR_CAT = { entry: 0, screen: 1, comp: 4, lib: 5, ctx: 6, fn: 6, admin: 3, coll: 7, data: 7, ext: 7 };
// override: onboarding screens in col 1, main-tab screens in col 2, admin in col 3
function colForFile(f) {
  const rel = path.relative(ROOT, f.abs);
  if (rel.endsWith('App.tsx')) return 0;
  if (rel.includes('navigation/')) return 0;
  if (rel.includes('screens/main/')) return 2;
  if (rel.includes('screens/admin/')) return 3;
  if (rel.includes('screens/components/')) return 4;
  if (rel.startsWith('ckc-consumer-app/screens/')) return 1;
  if (rel.includes('lib/')) return 5;
  if (rel.includes('context/')) return 6;
  if (rel.includes('functions/src/')) return 6;
  return 5;
}

// assign rows per column
const rowsByCol = {};
function assignRow(col) {
  rowsByCol[col] = (rowsByCol[col] || 0);
  return rowsByCol[col]++;
}

const finalNodes = [];

for (const f of filesById.values()) {
  const col = colForFile(f);
  const id = f.id;
  const label = labelFor(f.abs, id);
  const sub = subFor(f.abs, f.cat);
  const cat = f.cat;
  finalNodes.push({
    id, label, sub, type: cat, col,
    path: path.relative(ROOT, f.abs),
  });
}

// add synthetic nodes
for (const s of SYNTHETIC) {
  finalNodes.push({ id: s.id, label: s.label, sub: s.sub, type: s.cat, col: 7, path: s.path });
}

// stable column ordering: sort within column by category preference then label
const CAT_ORDER = ['entry', 'screen', 'admin', 'comp', 'lib', 'ctx', 'fn', 'coll', 'data', 'ext'];
finalNodes.sort((a, b) => {
  if (a.col !== b.col) return a.col - b.col;
  const ao = CAT_ORDER.indexOf(a.type), bo = CAT_ORDER.indexOf(b.type);
  if (ao !== bo) return ao - bo;
  return a.label.localeCompare(b.label);
});

// now assign row numbers in declared order within each column
const colRows = {};
for (const n of finalNodes) {
  colRows[n.col] = (colRows[n.col] || 0);
  n.row = colRows[n.col]++;
}

// ── 5. Tab membership ────────────────────────────────────────────────────────
function tabsFor(n) {
  const t = ['overview'];
  const lower = (n.path || '').toLowerCase();
  if (lower.includes('screens/main/'))                        t.push('catalog', 'shop');
  if (n.type === 'screen' && !lower.includes('screens/main/'))t.push('onboarding');
  if (n.type === 'screen' && /discover|catalog|recipedetail|guest/i.test(n.id)) t.push('catalog');
  if (n.type === 'screen' && /shop|mealplan|scan|profile/i.test(n.id))          t.push('shop');
  if (n.type === 'admin')                                     t.push('admin');
  if (n.type === 'fn')                                        t.push('enrich');
  if (n.type === 'comp' || n.type === 'lib' || n.type === 'ctx' || n.type === 'entry'
      || n.type === 'data' || n.type === 'coll' || n.type === 'ext') {
    // include in every tab — they're shared
    t.push('onboarding', 'catalog', 'shop', 'admin', 'enrich');
  }
  return Array.from(new Set(t));
}

for (const n of finalNodes) n.tabs = tabsFor(n);

// ── 6. Merge in overrides (plain English, bugs, fixes) ──────────────────────
const overrides = fs.existsSync(OVERRIDES_PATH) ? JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8')) : {};
for (const n of finalNodes) {
  const o = overrides[n.id];
  if (!o) continue;
  if (o.plain || o.does) {
    n.doc = {};
    if (o.plain) n.doc.plain = o.plain;
    if (o.does)  n.doc.does  = o.does;
  }
  if (o.bugs && o.bugs.length)   n.bugs = o.bugs;
  if (o.fixes && o.fixes.length) n.fixes = o.fixes;
}

// ── 7. Edge kinds — promote "hot path" + enrichment to colored wires ─────────
const HOT_PATH = new Set([
  'DiscoverScreen->firestore', 'firestore->recipes_collection',
  'firestore->firebase', 'firebase->ext_firebase',
  'ScanScreen->gemini', 'gemini->ext_gemini',
  'RecipeDetailScreen->dietSwaps', 'ShopScreen->ingredientParser',
]);
const GOLD_PATH = new Set([
  'fn_index->classifyDietTags', 'fn_index->classifyProtein', 'fn_index->fetchDescription',
  'classifyDietTags->ext_claude', 'classifyDietTags->dietRules',
  'classifyDietTags->recipes_collection', 'classifyProtein->recipes_collection',
  'fetchDescription->recipes_collection',
]);
for (const e of edges) {
  const k = `${e[0]}->${e[1]}`;
  if (HOT_PATH.has(k))   e[2] = 'red';
  if (GOLD_PATH.has(k))  e[2] = 'gold';
}

// drop edges whose endpoints don't exist as nodes
const nodeIds = new Set(finalNodes.map(n => n.id));
const finalEdges = edges.filter(([a, b]) => nodeIds.has(a) && nodeIds.has(b));

// ── 8. Write into HTML between markers ───────────────────────────────────────
function fmtNodes(nodes) {
  return nodes.map(n => '  ' + JSON.stringify(n)).join(',\n');
}
function fmtEdges(es) {
  return es.map(e => '  ' + JSON.stringify(e)).join(',\n');
}

if (!fs.existsSync(OUT)) {
  console.error(`Architecture map HTML not found at ${OUT}`);
  process.exit(1);
}

let html = fs.readFileSync(OUT, 'utf8');

const nodesBlock = `const NODES = [\n${fmtNodes(finalNodes)}\n];`;
const edgesBlock = `const EDGES = [\n${fmtEdges(finalEdges)}\n];`;

html = html.replace(
  /const NODES = \[[\s\S]*?\n\];/,
  nodesBlock
);
html = html.replace(
  /const EDGES = \[[\s\S]*?\n\];/,
  edgesBlock
);

// Stamp build time at the top of the body
const stamp = `<!-- regenerated ${new Date().toISOString()} by scripts/generate-architecture-map.js -->`;
html = html.replace(/<!-- regenerated [^>]*-->\n?/, '');
html = html.replace('<body>', `<body>\n${stamp}`);

fs.writeFileSync(OUT, html);
console.log(`✓ regenerated ${path.relative(ROOT, OUT)}`);
console.log(`  ${finalNodes.length} nodes · ${finalEdges.length} edges`);
