/**
 * Forcor Stock Checker - Lightweight (no Puppeteer needed)
 * Uses HTTP requests with cookie session to check stock on Wayre Forcor
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const FORCOR_USER = process.env.FORCOR_USER || 'laforddewarnes@hotmail.com.ar';
const FORCOR_PASS = process.env.FORCOR_PASS || 'laforddewarnes';
const FORCOR_BASE = 'https://wayre.forcor.com.ar';

let sessionCookie = null;
let lastLogin = 0;

function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(url, {
      method: opts.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...(opts.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        'Cookie': sessionCookie || '',
        ...opts.headers,
      },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function login() {
  // Don't login too often
  if (sessionCookie && Date.now() - lastLogin < 1800000) return true; // 30 min

  console.log('[Forcor] Logging in...');
  try {
    // Get login page (for CSRF token if needed)
    const loginPage = await fetch(FORCOR_BASE + '/login');
    const cookies = loginPage.headers['set-cookie'];
    if (cookies) sessionCookie = cookies.map(c => c.split(';')[0]).join('; ');

    // Extract CSRF token if present
    const csrfMatch = loginPage.body.match(/name="_token"\s+value="([^"]+)"/);
    const token = csrfMatch ? csrfMatch[1] : '';

    // POST login
    const body = `email=${encodeURIComponent(FORCOR_USER)}&password=${encodeURIComponent(FORCOR_PASS)}${token ? '&_token=' + encodeURIComponent(token) : ''}`;
    const res = await fetch(FORCOR_BASE + '/login', {
      method: 'POST',
      body,
      headers: { 'Cookie': sessionCookie || '' },
    });

    // Capture session cookies
    if (res.headers['set-cookie']) {
      const newCookies = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
      sessionCookie = sessionCookie ? sessionCookie + '; ' + newCookies : newCookies;
    }

    // Check if login successful (redirect to dashboard)
    if (res.status === 302 || res.status === 200) {
      lastLogin = Date.now();
      console.log('[Forcor] Login successful');
      return true;
    }
    console.log('[Forcor] Login failed, status:', res.status);
    return false;
  } catch (e) {
    console.error('[Forcor] Login error:', e.message);
    return false;
  }
}

function parseOEM(oem) {
  const clean = oem.replace(/\s+/g, '').toUpperCase();
  const parts = clean.split(/[-/]/);
  return {
    prefijo: parts[0] || '',
    basico: parts[1] || '',
    sufijo1: parts[2] || '',
    sufijo2: parts[3] || '',
  };
}

async function searchPart(oem) {
  const p = parseOEM(oem);
  const params = new URLSearchParams({
    'producto_filter[prefijo]': p.prefijo,
    'producto_filter[basico]': p.basico,
    'producto_filter[sufijo1]': p.sufijo1,
    'producto_filter[sufijo2]': p.sufijo2,
  });

  const url = FORCOR_BASE + '/extranet/productos?' + params.toString();
  const res = await fetch(url);

  // Parse HTML table results
  const results = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(res.body)) !== null) {
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
    }
    if (cells.length >= 3) {
      results.push({
        numero: cells[0] || '',
        descripcion: cells[1] || '',
        precio_proveedor: cells[2] || '',
        stock_texto: cells[3] || '',
        disponible: !(cells[3] || '').toLowerCase().includes('sin stock') && cells.length >= 4,
        fuente: 'Forcor',
      });
    }
  }

  return results;
}

async function checkStock(oemList) {
  const loggedIn = await login();
  if (!loggedIn) return {};

  const results = {};
  for (const oem of oemList) {
    try {
      results[oem] = await searchPart(oem);
      await new Promise(r => setTimeout(r, 500)); // Rate limit
    } catch (e) {
      console.error(`[Forcor] Error ${oem}:`, e.message);
      results[oem] = [];
    }
  }
  return results;
}

module.exports = { checkStock, login, searchPart, parseOEM };

if (require.main === module) {
  checkStock(['EB3G-6714-BA']).then(r => {
    console.log(JSON.stringify(r, null, 2));
  });
}
