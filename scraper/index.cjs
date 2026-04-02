/**
 * La Ford de Warnes - Stock Checker
 *
 * Runs on Juan's PC. Checks stock from 4 suppliers every 30 minutes.
 * Uploads results to MongoDB Atlas.
 *
 * Usage: node scraper/index.cjs
 * Or double-click: ford-stock.bat
 */

const puppeteer = require('puppeteer');
const { MongoClient } = require('mongodb');

// ─── CONFIG ─────────────────────────────────────────────────────────────
const MONGO_URI = 'mongodb+srv://fordwarnes:q8JDvqAazcuGSOz1@fordwarnes.k9lihgv.mongodb.net/fordwarnes?retryWrites=true&w=majority';
const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
const PRICE_MARKUP = 1.7545; // Costo neto × 1.21 (IVA) × 1.45 (ganancia)

// ─── SUPPLIERS ──────────────────────────────────────────────────────────
const SUPPLIERS = {
  forcor: {
    name: 'Forcor (Wayre)',
    loginUrl: 'https://wayre.forcor.com.ar/login',
    user: 'laforddewarnes@hotmail.com.ar',
    pass: 'laforddewarnes',
  },
  fordmata: {
    name: 'Fordmata',
    loginUrl: 'https://fordmata.no-ip.org/ford/extranet/default.asp',
    user: 'sep2025x',
    pass: 'sep2025x',
  },
  fnx: {
    name: 'FNX',
    loginUrl: 'http://fnx.com.ar/index.php?banner=show',
    user: '2077',
    pass: '20-29863333-8',
  },
  taraborelli: {
    name: 'Taraborelli',
    loginUrl: 'http://repuestos.fordtaraborelli.com/v2/',
    user: '20298633338',
    pass: '123456',
  },
};

// ─── MONGODB ────────────────────────────────────────────────────────────
let db;
async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db('fordwarnes');
  console.log('[DB] MongoDB connected');
}

async function saveStockResults(results) {
  if (!db) return;
  await db.collection('config').updateOne(
    { _id: 'supplierStock' },
    { $set: { data: results, updatedAt: Date.now() } },
    { upsert: true }
  );
  console.log(`[DB] Saved ${Object.keys(results).length} parts to MongoDB`);
}

// ─── FORCOR SCRAPER ─────────────────────────────────────────────────────
async function scrapeForcor(browser, partNumbers) {
  console.log(`\n[Forcor] Starting... (${partNumbers.length} parts)`);
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  try {
    // Login
    await page.goto(SUPPLIERS.forcor.loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.type('input[name="email"], input[type="email"]', SUPPLIERS.forcor.user, { delay: 30 });
    await page.type('input[name="password"], input[type="password"]', SUPPLIERS.forcor.pass, { delay: 30 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      page.click('button[type="submit"], input[type="submit"]').catch(() => page.keyboard.press('Enter')),
    ]);
    console.log('[Forcor] Logged in');

    const results = {};
    let checked = 0;

    for (const oem of partNumbers) {
      try {
        // Parse OEM: "AB39-2K021-BA" → prefijo=AB39, basico=2K021, sufijo1=BA
        const parts = oem.replace(/\//g, '-').split('-');
        const params = new URLSearchParams({
          'producto_filter[prefijo]': parts[0] || '',
          'producto_filter[basico]': parts[1] || '',
          'producto_filter[sufijo1]': parts[2] || '',
          'producto_filter[sufijo2]': parts[3] || '',
        });

        await page.goto('https://wayre.forcor.com.ar/extranet/productos?' + params, {
          waitUntil: 'networkidle2', timeout: 15000,
        });

        // Extract table data
        const data = await page.evaluate(() => {
          const rows = document.querySelectorAll('table tbody tr');
          return Array.from(rows).map(row => {
            const cells = row.querySelectorAll('td');
            return {
              numero: (cells[0]?.innerText || '').trim(),
              desc: (cells[1]?.innerText || '').trim(),
              precio: (cells[2]?.innerText || '').trim(),
              stock: (cells[3]?.innerText || '').trim(),
            };
          }).filter(r => r.numero);
        });

        if (data.length > 0) {
          results[oem] = {
            supplier: 'forcor',
            items: data,
            available: data.some(d => !d.stock.toLowerCase().includes('sin stock')),
            checkedAt: Date.now(),
          };
        }

        checked++;
        if (checked % 50 === 0) console.log(`[Forcor] ${checked}/${partNumbers.length}...`);
        await new Promise(r => setTimeout(r, 800)); // Rate limit
      } catch (e) {
        // Skip failed parts
      }
    }

    console.log(`[Forcor] Done: ${Object.keys(results).length} parts found`);
    return results;
  } catch (e) {
    console.error('[Forcor] Error:', e.message);
    return {};
  } finally {
    await page.close();
  }
}

// ─── MAIN ───────────────────────────────────────────────────────────────
async function loadPartNumbers() {
  if (!db) return [];
  // Load from the catalog in MongoDB
  const doc = await db.collection('config').findOne({ _id: 'stock' });
  if (!doc?.data) return [];

  // Also try loading from local catalog
  try {
    const cat = require('../src/catalogo-ford.json');
    const parts = new Set();
    for (const items of Object.values(cat)) {
      for (const p of items) {
        if (p.nro) parts.add(p.nro);
      }
    }
    console.log(`[Catalog] Loaded ${parts.size} unique part numbers`);
    return [...parts];
  } catch {
    return [];
  }
}

async function runCheck() {
  console.log('\n' + '='.repeat(60));
  console.log(`[Stock Check] Starting at ${new Date().toLocaleString('es-AR')}`);
  console.log('='.repeat(60));

  const partNumbers = await loadPartNumbers();
  if (partNumbers.length === 0) {
    console.log('[!] No part numbers to check');
    return;
  }

  // Take top 200 for frequent checks, full catalog every 6 hours
  const hour = new Date().getHours();
  const isFullCheck = hour % 6 === 0;
  const toCheck = isFullCheck ? partNumbers : partNumbers.slice(0, 200);
  console.log(`[Check] ${isFullCheck ? 'FULL' : 'TOP 200'}: ${toCheck.length} parts`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    // Start with Forcor (the one we know works)
    const forcorResults = await scrapeForcor(browser, toCheck);

    // Merge all results
    const allResults = {};
    for (const [oem, data] of Object.entries(forcorResults)) {
      if (!allResults[oem]) allResults[oem] = { suppliers: {} };
      allResults[oem].suppliers.forcor = data;
    }

    // Save to MongoDB
    await saveStockResults(allResults);
    console.log(`\n[Done] Checked ${toCheck.length} parts, found ${Object.keys(allResults).length} with stock info`);
  } catch (e) {
    console.error('[Error]', e.message);
  } finally {
    await browser.close();
  }
}

// ─── START ──────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  La Ford de Warnes - Stock Checker       ║');
  console.log('║  Checking 4 suppliers every 30 minutes   ║');
  console.log('╚══════════════════════════════════════════╝');

  await connectDB();
  await runCheck(); // Run immediately

  // Schedule every 30 minutes
  setInterval(runCheck, CHECK_INTERVAL);
  console.log(`\n[Schedule] Next check in 30 minutes. Keep this window open.`);
}

main().catch(e => {
  console.error('[Fatal]', e.message);
  process.exit(1);
});
