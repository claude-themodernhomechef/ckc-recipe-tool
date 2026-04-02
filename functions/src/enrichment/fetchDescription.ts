/**
 * fetchDescription — TypeScript port of fetch_descriptions.py
 * Fetches og:description (or meta description) from a recipe URL.
 * Trims to ~200 chars at a sentence boundary.
 */

import * as https from 'https';
import * as http from 'http';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Returns false if the string looks like a ratings placeholder rather than a real description. */
function isRealDescription(s: string | undefined | null): boolean {
  if (!s || !s.trim()) return false;
  if (/^\d[\d,]*\s+ratings?$/i.test(s.trim())) return false;
  return true;
}

/** Fetch raw HTML from a URL with a timeout. */
function fetchHtml(url: string, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,*/*' } }, (res) => {
      // Follow single redirect
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        fetchHtml(res.headers.location, timeoutMs).then(resolve).catch(reject);
        return;
      }
      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

/** Extract og:description or meta description from raw HTML. */
function extractMetaDescription(html: string): string | null {
  // og:description
  let m = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (!m) {
    m = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  }
  // fallback: name="description"
  if (!m) {
    m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  }
  if (!m) {
    m = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  }
  return m ? m[1].replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').trim() : null;
}

/** Trim description to ~200 chars at a sentence boundary. */
function trimDescription(desc: string): string {
  if (desc.length <= 200) return desc;
  const cut = desc.slice(0, 200).lastIndexOf('.');
  return cut > 80 ? desc.slice(0, cut + 1) : desc.slice(0, 200);
}

/**
 * Fetch the og:description for a recipe URL.
 * Returns null if not found or if the existing description is already real.
 */
export async function fetchDescription(
  url: string,
  existingDescription?: string | null,
): Promise<string | null> {
  if (isRealDescription(existingDescription)) return null; // already has one

  try {
    const html = await fetchHtml(url);
    const desc = extractMetaDescription(html);
    if (!desc) return null;
    return trimDescription(desc);
  } catch {
    return null;
  }
}
