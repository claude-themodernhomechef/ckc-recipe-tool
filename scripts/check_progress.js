/**
 * check_progress.js — prints a live status snapshot of all batch jobs
 */
const fs   = require('fs');
const path = require('path');

const EDAMAM_PROG    = path.join(__dirname, '../data/edamam_progress.json');
const SERVINGS_PROG  = path.join(__dirname, '../data/servings_progress.json');
const INGREDIENT_PROG = path.join(__dirname, '../data/ingredient_db_v2_progress.json');
const CHROME_RESULTS = path.join(__dirname, '../data/chrome_results.json');

function bar(done, total, width = 24) {
  const pct  = total > 0 ? done / total : 0;
  const fill = Math.round(pct * width);
  return '[' + '█'.repeat(fill) + '░'.repeat(width - fill) + '] ' + String(done).padStart(4) + '/' + total + ' (' + Math.round(pct * 100) + '%)';
}

function etaMins(done, total, secsPerItem) {
  if (done === 0) return '—';
  if (done >= total) return 'done';
  const secs = (total - done) * secsPerItem;
  if (secs < 60) return `~${Math.round(secs)}s`;
  return `~${Math.round(secs / 60)}m`;
}

function isRunning(scriptName) {
  const { execSync } = require('child_process');
  try { return execSync(`ps aux | grep ${scriptName} | grep -v grep`).toString().trim().length > 0; } catch(e) { return false; }
}

function status(running, done, total) {
  if (running) return '🟢 running ';
  if (done >= total) return '✅ complete';
  return '🔴 stopped ';
}

// ── Edamam ────────────────────────────────────────────────────────────────────
let edamamDone = 0, edamamTotal = 1074, edamamOk = 0, edamamFail = 0;
try {
  const prog = JSON.parse(fs.readFileSync(EDAMAM_PROG, 'utf8'));
  edamamDone = Object.keys(prog).length;
  edamamOk   = Object.values(prog).filter(r => r.status === 'ok').length;
  edamamFail = Object.values(prog).filter(r => r.status !== 'ok').length;
} catch(e) {}

// ── Puppeteer servings ────────────────────────────────────────────────────────
let puppetDone = 0, puppetTotal = 1062, puppetOk = 0, puppetFail = 0;
try {
  const prog = JSON.parse(fs.readFileSync(SERVINGS_PROG, 'utf8'));
  const processed = Object.values(prog).filter(r =>
    ['jsonld','meta','text','dom_selector','needs_manual'].includes(r.source)
  );
  puppetOk   = Math.max(0, processed.filter(r => r.servings !== null && r.source !== 'needs_manual').length - 16);
  puppetFail = processed.filter(r => r.source === 'needs_manual').length;
  puppetDone = puppetOk + puppetFail;
} catch(e) {}

// ── Chrome profile servings ───────────────────────────────────────────────────
let chromeDone = 0, chromeTotal = 288, chromeOk = 0, chromeFail = 0;
try {
  const results = JSON.parse(fs.readFileSync(CHROME_RESULTS, 'utf8'));
  chromeDone = Object.keys(results).length;
  chromeOk   = Object.values(results).filter(r => r.servings !== null).length;
  chromeFail = Object.values(results).filter(r => !r.servings).length;
} catch(e) {}

// ── Ingredient DB V2 ──────────────────────────────────────────────────────────
let ingDone = 0, ingTotal = 2260, ingFound = 0, ingMissed = 0;
try {
  const prog = JSON.parse(fs.readFileSync(INGREDIENT_PROG, 'utf8'));
  ingDone   = Object.keys(prog).length;
  ingFound  = Object.values(prog).filter(r => r.status === 'ok').length;
  ingMissed = Object.values(prog).filter(r => r.status !== 'ok').length;
} catch(e) {}

const ingMatchRate = ingDone > 0 ? Math.round(ingFound / ingDone * 100) : 0;

// ── Process statuses ──────────────────────────────────────────────────────────
const edamamRunning  = isRunning('run_edamam_batch');
const puppetRunning  = isRunning('scrape_servings_puppeteer');
const chromeRunning  = isRunning('scrape_servings_chrome');
const ingRunning     = isRunning('build_ingredient_db');

// ── Print ─────────────────────────────────────────────────────────────────────
const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
console.log('');
console.log('┌──────────────────────────────────────────────────────┐');
console.log('│          NUTRITION PIPELINE — LIVE STATUS            │');
console.log('│                    ' + now + '                        │');
console.log('├──────────────────────────────────────────────────────┤');
console.log('│                                                       │');
console.log('│  🥗 EDAMAM nutrition    ' + status(edamamRunning, edamamDone, edamamTotal) + '                │');
console.log('│  ' + bar(edamamDone, edamamTotal) + '                     │');
console.log('│  ✓ ' + String(edamamOk).padEnd(5) + ' success  ✗ ' + String(edamamFail).padEnd(5) + ' failed               │');
console.log('│                                                       │');
console.log('│  🔍 PUPPETEER servings  ' + status(puppetRunning, puppetDone, puppetTotal) + '                │');
console.log('│  ' + bar(puppetDone, puppetTotal) + '                     │');
console.log('│  ✓ ' + String(puppetOk).padEnd(5) + ' scraped  ✗ ' + String(puppetFail).padEnd(5) + ' manual               │');
console.log('│                                                       │');
console.log('│  🌐 CHROME servings     ' + status(chromeRunning, chromeDone, chromeTotal) + '                │');
console.log('│  ' + bar(chromeDone, chromeTotal) + '                     │');
console.log('│  ✓ ' + String(chromeOk).padEnd(5) + ' found    ✗ ' + String(chromeFail).padEnd(5) + ' not found  ETA: ' + etaMins(chromeDone, chromeTotal, 1.8).padEnd(5) + ' │');
console.log('│                                                       │');
console.log('│  📦 INGREDIENT DB V2    ' + status(ingRunning, ingDone, ingTotal) + '                │');
console.log('│  ' + bar(ingDone, ingTotal) + '                     │');
console.log('│  ✓ ' + String(ingFound).padEnd(5) + ' found    match rate: ' + String(ingMatchRate).padEnd(3) + '%  ETA: ' + etaMins(ingDone, ingTotal, 1.3).padEnd(5) + ' │');
console.log('│                                                       │');
console.log('└──────────────────────────────────────────────────────┘');
