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
    // Write to cache
    if (db) {
      try {
        await db.collection('supplierStockCache').updateOne(
          { _id: sku },
          { $set: { _id: sku, suppliers: result.suppliers, updatedAt: Date.now() } },
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
      await httpRequest('https://wayre.forcor.com.ar/', { headers: { Cookie: process.env.FORCOR_COOKIE } });
    },
    async check(sku) {
      if (!this.hasCredentials()) return { status: 'unknown', reason: 'no_credentials' };
      const searchUrl = (process.env.FORCOR_SEARCH_URL || 'https://wayre.forcor.com.ar/buscar?q={SKU}').replace('{SKU}', encodeURIComponent(sku));
      const res = await httpRequest(searchUrl, { headers: { Cookie: process.env.FORCOR_COOKIE } });
      const fatal = detectFatal(res);
      if (fatal) return { status: 'error', fatal: true, fatalReason: fatal };
      // TODO: parse response body to extract stock qty / precio.
      // Forcor uses the "wayre" ERP (B2B portal) — likely has a product card
      // with stock number. Once Juan gives us a sample SKU + expected response,
      // fill in the selector here.
      return { status: 'unknown', mode: 'numeric', qty: null, precio: null, note: 'parser_pending' };
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
      await httpRequest('https://repuestos.fordtaraborelli.com/', { headers: { Cookie: process.env.TARABORELLI_COOKIE } });
    },
    async check(sku) {
      if (!this.hasCredentials()) return { status: 'unknown', reason: 'no_credentials' };
      const searchUrl = (process.env.TARABORELLI_SEARCH_URL || 'https://repuestos.fordtaraborelli.com/buscar?codigo={SKU}').replace('{SKU}', encodeURIComponent(sku));
      const res = await httpRequest(searchUrl, { headers: { Cookie: process.env.TARABORELLI_COOKIE } });
      const fatal = detectFatal(res);
      if (fatal) return { status: 'error', fatal: true, fatalReason: fatal };
      return { status: 'unknown', mode: 'thumbs', thumbs: null, precio: null, note: 'parser_pending' };
    },
  },
};

module.exports = { consultarStock, getStatus, setAlertFn, SUPPLIERS, DAILY_CAP, CACHE_TTL_MS };
