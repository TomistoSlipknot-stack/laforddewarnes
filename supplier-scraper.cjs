// ─── SUPPLIER SCRAPER ─────────────────────────────────────────────────────
// Ultra-conservative stock checker for Forcor / Fordmata / FNX / Taraborelli.
// The user's uncle said the accounts are "gold" — we prioritize never losing
// them over any other concern. All limits are deliberately low.
//
// Rules (all enforced below):
//   - Daily cap per supplier: 50 requests (way below human browsing volume)
//   - Minimum gap between requests to the same supplier: 30 seconds
//   - Active hours: 09:00 – 19:00 America/Argentina/Buenos_Aires
//   - Lock per part: 50 concurrent clients clicking → 1 real request
//   - Auto-disable on 403 / captcha / "login required" for 24h
//   - Cache TTL in Mongo: 12 hours (reduces request count drastically)
//   - Warm-up: hit supplier homepage once per day before first real request
//   - Cookies/session expire detection → alert Juan
//
// Adapters per supplier live at the bottom. Each one expects cookies set
// via env vars (FORCOR_COOKIE, FORDMATA_COOKIE, FNX_COOKIE, TARABORELLI_COOKIE).
// If cookies are absent, the adapter returns { disabled: true } so the
// frontend shows the WhatsApp/Chat fallback.

const https = require('https');
const http = require('http');
const { URL } = require('url');

const SUPPLIERS = ['forcor', 'fordmata', 'fnx', 'taraborelli'];
const DAILY_CAP = 50;
const MIN_GAP_MS = 30 * 1000;
const ACTIVE_HOUR_START = 9;   // inclusive (AR time)
const ACTIVE_HOUR_END = 19;    // exclusive
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const AUTO_DISABLE_MS = 24 * 60 * 60 * 1000;

// ─── STATE (in-memory, reset on restart) ─────────────────────────────────
// Per-supplier counters reset at midnight AR time.
const state = {};
for (const s of SUPPLIERS) {
  state[s] = {
    dayKey: '',         // YYYY-MM-DD in AR
    count: 0,
    lastRequestAt: 0,
    disabledUntil: 0,   // ms epoch
    disabledReason: '',
    warmedUpKey: '',    // last YYYY-MM-DD we did the warm-up ping
  };
}

// Per-part in-flight locks: sku -> { promise, startedAt }
const inflight = new Map();

function nowAR() {
  // America/Argentina/Buenos_Aires is UTC-3 year-round
  const d = new Date();
  const ar = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return ar;
}
function arDayKey() {
  const d = nowAR();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}
function arHour() { return nowAR().getUTCHours(); }
function inActiveHours() {
  const h = arHour();
  return h >= ACTIVE_HOUR_START && h < ACTIVE_HOUR_END;
}
function resetIfNewDay(supplier) {
  const key = arDayKey();
  if (state[supplier].dayKey !== key) {
    state[supplier].dayKey = key;
    state[supplier].count = 0;
  }
}

// Alert hook — the server wires this to WhatsApp/email at boot time.
let alertFn = (level, msg) => console.log('[scraper alert]', level, msg);
function setAlertFn(fn) { if (typeof fn === 'function') alertFn = fn; }

function isSupplierUsable(supplier) {
  if (!SUPPLIERS.includes(supplier)) return { ok: false, reason: 'unknown_supplier' };
  resetIfNewDay(supplier);
  const s = state[supplier];
  if (s.disabledUntil > Date.now()) return { ok: false, reason: 'auto_disabled', until: s.disabledUntil, detail: s.disabledReason };
  if (!inActiveHours()) return { ok: false, reason: 'outside_hours' };
  if (s.count >= DAILY_CAP) return { ok: false, reason: 'daily_cap_reached' };
  if (Date.now() - s.lastRequestAt < MIN_GAP_MS) return { ok: false, reason: 'min_gap', waitMs: MIN_GAP_MS - (Date.now() - s.lastRequestAt) };
  const adapter = adapters[supplier];
  if (!adapter || !adapter.hasCredentials()) return { ok: false, reason: 'no_credentials' };
  return { ok: true };
}

function markRequest(supplier) {
  resetIfNewDay(supplier);
  state[supplier].count++;
  state[supplier].lastRequestAt = Date.now();
}
function disableSupplier(supplier, reason, ms = AUTO_DISABLE_MS) {
  state[supplier].disabledUntil = Date.now() + ms;
  state[supplier].disabledReason = reason;
  alertFn('WARN', `supplier ${supplier} auto-disabled (${reason}) for ${Math.round(ms / 3600000)}h`);
}

// ─── CORE: consultar stock (with cache + lock) ─────────────────────────
// db: MongoDB db instance (or null)
// partNumber: the SKU we want to check
async function consultarStock(db, partNumber) {
  const sku = String(partNumber || '').trim();
  if (!sku) return { ok: false, error: 'no_sku' };

  // 1) Check cache first
  if (db) {
    try {
      const cached = await db.collection('supplierStockCache').findOne({ _id: sku });
      if (cached && cached.updatedAt && (Date.now() - cached.updatedAt) < CACHE_TTL_MS) {
        return { ok: true, fromCache: true, ageMs: Date.now() - cached.updatedAt, suppliers: cached.suppliers || {} };
      }
    } catch (e) { console.error('[scraper] cache read error:', e.message); }
  }

  // 2) Dedup: if another client is already fetching the same SKU, wait for their result
  if (inflight.has(sku)) {
    try { return await inflight.get(sku).promise; }
    catch { /* fall through to new attempt */ }
  }

  // 3) Fire a fresh fetch
  const p = (async () => {
    const result = { ok: true, fromCache: false, suppliers: {}, consultedAt: Date.now() };
    for (const supplier of SUPPLIERS) {
      const usable = isSupplierUsable(supplier);
      if (!usable.ok) {
        result.suppliers[supplier] = { status: 'unavailable', reason: usable.reason };
        continue;
      }
      // Warm-up once per day so first real request isn't the very first hit
      try { await maybeWarmUp(supplier); }
      catch (e) { console.warn('[scraper warmup]', supplier, e.message); }
      markRequest(supplier);
      try {
        const r = await adapters[supplier].check(sku);
        result.suppliers[supplier] = r;
        // 403 / captcha / login lost → auto-disable
        if (r && r.fatal) {
          disableSupplier(supplier, r.fatalReason || 'fatal');
          if (r.fatalReason === 'session_expired') {
            alertFn('URGENT', `Cookies expiradas en ${supplier}. Por favor re-loggeate en el navegador y actualiza ${supplier.toUpperCase()}_COOKIE en Render.`);
          }
        }
      } catch (e) {
        console.error('[scraper]', supplier, sku, e.message);
        result.suppliers[supplier] = { status: 'error', error: e.message };
      }
    }
    // Build a brand summary from all available suppliers
    const brands = new Set();
    for (const info of Object.values(result.suppliers)) {
      if (info && info.status === 'available' && info.brand) {
        if (info.brand === 'original' || info.brand === 'original_probable') brands.add('original');
        else if (info.brand === 'alternativo') brands.add('alternativo');
        else if (info.brand === 'ambos') { brands.add('original'); brands.add('alternativo'); }
      }
    }
    result.brandSummary = brands.size === 0 ? null
      : brands.has('original') && brands.has('alternativo') ? 'original_y_alternativo'
      : brands.has('original') ? 'original'
      : 'alternativo';

    // Write to cache
    if (db) {
      try {
        await db.collection('supplierStockCache').updateOne(
          { _id: sku },
          { $set: { _id: sku, suppliers: result.suppliers, brandSummary: result.brandSummary, updatedAt: Date.now() } },
          { upsert: true }
        );
      } catch (e) { console.error('[scraper] cache write error:', e.message); }
    }
    return result;
  })();
  inflight.set(sku, { promise: p, startedAt: Date.now() });
  try { return await p; }
  finally { inflight.delete(sku); }
}

async function maybeWarmUp(supplier) {
  const s = state[supplier];
  const key = arDayKey();
  if (s.warmedUpKey === key) return;
  const adapter = adapters[supplier];
  if (!adapter || !adapter.warmUp) { s.warmedUpKey = key; return; }
  await adapter.warmUp();
  s.warmedUpKey = key;
}

function getStatus() {
  const out = {};
  for (const s of SUPPLIERS) {
    resetIfNewDay(s);
    out[s] = {
      count: state[s].count,
      cap: DAILY_CAP,
      lastRequestAt: state[s].lastRequestAt,
      disabled: state[s].disabledUntil > Date.now(),
      disabledUntil: state[s].disabledUntil,
      disabledReason: state[s].disabledReason,
      hasCredentials: adapters[s] && adapters[s].hasCredentials(),
    };
  }
  return {
    suppliers: out,
    inActiveHours: inActiveHours(),
    hoursWindow: `${ACTIVE_HOUR_START}:00 - ${ACTIVE_HOUR_END}:00 AR`,
    cacheTtlHours: CACHE_TTL_MS / 3600000,
    inflight: inflight.size,
  };
}

// ─── HTTP helper ──────────────────────────────────────────────────────────
function httpRequest(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({
      method: opts.method || 'GET',
      host: u.host,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        ...(opts.headers || {}),
      },
      timeout: 15000,
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// Detects common anti-bot / session-lost responses
function detectFatal(res) {
  if (!res) return null;
  if (res.status === 403) return 'blocked_403';
  if (res.status === 401) return 'session_expired';
  if (res.status === 429) return 'rate_limited';
  const body = (res.body || '').toLowerCase();
  if (body.includes('iniciar sesion') || body.includes('iniciar sesión') || body.includes('login') && body.includes('contrase')) return 'session_expired';
  if (body.includes('captcha') || body.includes('cf-browser-verification')) return 'captcha';
  return null;
}

// ─── ADAPTERS ─────────────────────────────────────────────────────────────
// Each adapter must implement:
//   hasCredentials() -> bool
//   warmUp() -> Promise  (optional: hits homepage to establish session)
//   check(sku) -> Promise<result>
//     result = {
//       status: 'available' | 'unavailable' | 'unknown' | 'error',
//       mode: 'numeric' | 'thumbs' | 'binary',  // how the supplier reports stock
//       qty: number | null,   // only when mode==='numeric'
//       thumbs: number | null, // only when mode==='thumbs' (1,2,3...)
//       precio: string | null,  // WE DO NOT SHOW THIS TO CLIENTS, only to admin
//       fatal: bool, fatalReason: string  (auto-disable signal)
//     }
//
// All adapters are SKELETONS. Fill in the parsing once Juan provides:
//   - the exact search URL per supplier
//   - the fresh session cookies
// Until then, they return { disabled: true } and the frontend falls back
// to WhatsApp/Chat for the user.

const adapters = {
  forcor: {
    hasCredentials() { return !!process.env.FORCOR_COOKIE; },
    async warmUp() {
      if (!this.hasCredentials()) return;
      await httpRequest('https://wayre.forcor.com.ar/extranet/productos', { headers: { Cookie: process.env.FORCOR_COOKIE } });
    },
    async check(sku) {
      if (!this.hasCredentials()) return { status: 'unknown', reason: 'no_credentials' };
      // Forcor search by nombre field (their part number system uses prefijo/basico/sufijo which doesn't match our SKUs)
      const searchUrl = 'https://wayre.forcor.com.ar/extranet/productos?producto_filter%5Bprefijo%5D=&producto_filter%5Bbasico%5D=&producto_filter%5Bsufijo1%5D=&producto_filter%5Bsufijo2%5D=&producto_filter%5Bnombre%5D=' + encodeURIComponent(sku) + '&producto_filter%5Bdescripcion%5D=';
      const res = await httpRequest(searchUrl, { headers: { Cookie: process.env.FORCOR_COOKIE, Accept: 'text/html' } });
      const fatal = detectFatal(res);
      if (fatal) return { status: 'error', fatal: true, fatalReason: fatal };
      try {
        const body = res.body || '';
        if (body.includes('No hay piezas') || body.includes('0 resultados')) {
          return { status: 'unavailable_stock', mode: 'thumbs', thumbs: 0, precio: null };
        }
        // Stock shown as thumbs-up/thumbs-down icons. 2 per row: FORCOR + FORD depot
        const thumbsUp = (body.match(/fa-thumbs-up/g) || []).length;
        const hasStock = thumbsUp > 0;
        // Extract first "Precio de Venta" (3rd price in each row group)
        const priceMatches = body.match(/\$\s*[\d,.]+/g) || [];
        const precioVenta = priceMatches.length >= 3 ? Number(priceMatches[2].replace(/[$\s.]/g, '').replace(',', '.')) : null;
        // Description from first result
        const descMatch = body.match(/<td>\s*\n?\s*([A-Z][A-Z\s]+?)\s*\n/m);
        const desc = descMatch ? descMatch[1].trim() : '';
        return {
          status: hasStock ? 'available' : 'unavailable_stock',
          mode: 'thumbs',
          thumbs: thumbsUp,
          precio: precioVenta,
          brand: detectBrand(desc, sku),
          descripcion: desc,
        };
      } catch (e) {
        console.error('[forcor parser]', e.message);
        return { status: 'error', error: 'parse_failed: ' + e.message };
      }
    },
  },
  fordmata: {
    hasCredentials() { return !!process.env.FORDMATA_COOKIE; },
    async warmUp() {
      if (!this.hasCredentials()) return;
      await httpRequest('https://fordmata.no-ip.org/', { headers: { Cookie: process.env.FORDMATA_COOKIE } });
    },
    async check(sku) {
      if (!this.hasCredentials()) return { status: 'unknown', reason: 'no_credentials' };
      const searchUrl = (process.env.FORDMATA_SEARCH_URL || 'https://fordmata.no-ip.org/search?code={SKU}').replace('{SKU}', encodeURIComponent(sku));
      const res = await httpRequest(searchUrl, { headers: { Cookie: process.env.FORDMATA_COOKIE } });
      const fatal = detectFatal(res);
      if (fatal) return { status: 'error', fatal: true, fatalReason: fatal };
      return { status: 'unknown', mode: 'thumbs', thumbs: null, precio: null, note: 'parser_pending' };
    },
  },
  fnx: {
    hasCredentials() { return !!process.env.FNX_COOKIE; },
    async warmUp() {
      if (!this.hasCredentials()) return;
      await httpRequest('https://fnx.com.ar/', { headers: { Cookie: process.env.FNX_COOKIE } });
    },
    async check(sku) {
      if (!this.hasCredentials()) return { status: 'unknown', reason: 'no_credentials' };
      const searchUrl = (process.env.FNX_SEARCH_URL || 'https://fnx.com.ar/producto/{SKU}').replace('{SKU}', encodeURIComponent(sku));
      const res = await httpRequest(searchUrl, { headers: { Cookie: process.env.FNX_COOKIE } });
      const fatal = detectFatal(res);
      if (fatal) return { status: 'error', fatal: true, fatalReason: fatal };
      return { status: 'unknown', mode: 'numeric', qty: null, precio: null, note: 'parser_pending' };
    },
  },
  taraborelli: {
    hasCredentials() { return !!process.env.TARABORELLI_COOKIE; },
    async warmUp() {
      if (!this.hasCredentials()) return;
      await httpRequest('http://repuestos.fordtaraborelli.com/v2/', {
        headers: { Cookie: process.env.TARABORELLI_COOKIE, Referer: 'http://repuestos.fordtaraborelli.com/v2/' },
      });
    },
    async check(sku) {
      if (!this.hasCredentials()) return { status: 'unknown', reason: 'no_credentials' };
      // Taraborelli uses a multipart POST to listado-repuestos.php
      const boundary = '----FormBound' + Date.now();
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="busqueda"\r\n\r\n${sku}\r\n--${boundary}\r\nContent-Disposition: form-data; name="tipoBusqueda"\r\n\r\ncodigo\r\n--${boundary}--\r\n`;
      const res = await httpRequest('http://repuestos.fordtaraborelli.com/lib/backend/listado-repuestos.php', {
        method: 'POST',
        headers: {
          Cookie: process.env.TARABORELLI_COOKIE,
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          Origin: 'http://repuestos.fordtaraborelli.com',
          Referer: 'http://repuestos.fordtaraborelli.com/v2/',
          Accept: '*/*',
        },
        body,
      });
      const fatal = detectFatal(res);
      if (fatal) return { status: 'error', fatal: true, fatalReason: fatal };
      try {
        const json = JSON.parse(res.body);
        if (json.state !== 200 || !Array.isArray(json.data) || json.data.length === 0) {
          return { status: 'unavailable_stock', mode: 'binary', qty: null, precio: null, note: 'no_results' };
        }
        // Parse the first matching result
        const item = json.data[0];
        const precioNeto = Number(item.precio) || 0;
        // stock_ce contains HTML: '<span class="text-gray">...Sin Stock</span>' or a number/green icon
        const stockCeHtml = String(item.stock_ce || '');
        const stockFabrica = String(item.stock_fabrica || '');
        const hasCeStock = !stockCeHtml.toLowerCase().includes('sin stock');
        const hasFabricaStock = stockFabrica.toLowerCase().includes('s');
        const available = hasCeStock || hasFabricaStock;
        // Extract numeric stock from HTML if present (some results show a number)
        const numMatch = stockCeHtml.match(/>(\d+)</);
        const numericQty = numMatch ? Number(numMatch[1]) : null;
        const desc = (item.descripcion || '').trim();
        const codigo = (item.codigo || '').trim();
        return {
          status: available ? 'available' : 'unavailable_stock',
          mode: numericQty != null ? 'numeric' : 'binary',
          qty: numericQty,
          precio: precioNeto > 0 ? precioNeto : null,
          brand: detectBrand(desc, codigo),
          hasCeStock,
          hasFabricaStock,
          descripcion: desc,
        };
      } catch (e) {
        console.error('[taraborelli parser]', e.message);
        return { status: 'error', error: 'parse_failed: ' + e.message };
      }
    },
  },
};

// ─── BRAND DETECTION ──────────────────────────────────────────────────────
// Detect whether a part description / code indicates Original Ford or aftermarket.
// This runs on the description returned by each supplier.
const ORIGINAL_KEYWORDS = ['original', 'motorcraft', 'genuino', 'genuina', 'ford original', 'oem', 'fomoco'];
const AFTERMARKET_KEYWORDS = ['alternativ', 'generico', 'generica', 'reemplazo', 'competencia', 'economy'];
function detectBrand(desc, codigo) {
  const text = ((desc || '') + ' ' + (codigo || '')).toLowerCase();
  const isOriginal = ORIGINAL_KEYWORDS.some(k => text.includes(k));
  const isAftermarket = AFTERMARKET_KEYWORDS.some(k => text.includes(k));
  if (isOriginal && !isAftermarket) return 'original';
  if (isAftermarket && !isOriginal) return 'alternativo';
  if (isOriginal && isAftermarket) return 'ambos';
  // Default: if it's from a Ford-specific supplier catalog and no keyword,
  // it's likely original (these are Ford OEM part numbers)
  return 'original_probable';
}

module.exports = { consultarStock, getStatus, setAlertFn, detectBrand, SUPPLIERS, DAILY_CAP, CACHE_TTL_MS };
