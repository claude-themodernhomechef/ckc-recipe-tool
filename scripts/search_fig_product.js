/**
 * search_fig_product.js
 * ──────────────────────
 * Searches the Supabase FIG product DB for an ingredient by protocol.
 * Used by the enrichment agent to resolve uncertain diet tags.
 *
 * Usage:
 *   node scripts/search_fig_product.js <ingredient> <protocol>
 *
 * Protocols: GF, DF, V, Vg, K, AIP, LF, LH
 *
 * Output (JSON):
 *   { "compliant": ["Brand Name", ...], "caution": [...], "not_compliant": [...] }
 *
 * Exit codes:
 *   0 — success
 *   1 — error
 */

const fs   = require('fs');
const path = require('path');
const http = require('https');
const url  = require('url');

// Load Supabase creds from functions/.env
const envPath = path.join(__dirname, 'functions', '.env');
const envText = fs.readFileSync(envPath, 'utf8');

function getEnv(key) {
  const m = envText.match(new RegExp(`${key}=(.+)`));
  return m ? m[1].trim() : '';
}

const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_KEY = getEnv('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Supabase credentials not found in functions/.env');
  process.exit(1);
}

const PROTO_FIELD = {
  GF:  'gluten_free',
  DF:  'dairy_free',
  Vg:  'vegan',
  V:   'vegetarian',
  AIP: 'aip_friendly',
  LF:  'low_fodmap',
  LH:  'low_histamine',
  K:   null, // special — uses sugar_free + paleo
};

async function search(ingredient, protocol) {
  const field = PROTO_FIELD[protocol];
  if (field === undefined) {
    console.error(`Unknown protocol: ${protocol}. Use: ${Object.keys(PROTO_FIELD).join(', ')}`);
    process.exit(1);
  }

  const results = { compliant: [], caution: [], not_compliant: [] };

  // Try the full ingredient, then fall back to last 2 words
  const words = ingredient.trim().split(/\s+/);
  const terms = [ingredient.trim()];
  if (words.length > 2) terms.push(words.slice(-2).join(' '));
  if (words.length > 1) terms.push(words[words.length - 1]);

  const select = protocol === 'K'
    ? 'name,brand,sugar_free,paleo'
    : `name,brand,${field}`;

  for (const term of terms) {
    const encoded = encodeURIComponent(term);
    const endpoint = `${SUPABASE_URL}/rest/v1/products?name=ilike.*${encoded}*&select=${select}&limit=20`;

    const data = await fetch(endpoint, SUPABASE_KEY);
    if (!data || data.length === 0) continue;

    for (const p of data) {
      const name = `${p.brand || ''} ${p.name || ''}`.trim();
      let status;

      if (protocol === 'K') {
        const sf = p.sugar_free;
        const pa = p.paleo;
        status = (sf === 'compliant' && pa === 'compliant') ? 'compliant'
               : (sf === 'not_compliant' || pa === 'not_compliant') ? 'not_compliant'
               : 'caution';
      } else {
        status = p[field] || 'unknown';
      }

      if (results[status] !== undefined) results[status].push(name);
    }

    // Stop if we found something
    if (results.compliant.length || results.caution.length || results.not_compliant.length) break;
  }

  return results;
}

function fetch(endpoint, apiKey) {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(endpoint);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    };
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { resolve([]); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const [,, ingredient, protocol] = process.argv;

  if (!ingredient || !protocol) {
    console.error('Usage: node search_fig_product.js <ingredient> <protocol>');
    process.exit(1);
  }

  try {
    const results = await search(ingredient, protocol.toUpperCase());
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Search error:', e.message);
    process.exit(1);
  }
}

main();
