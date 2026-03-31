/**
 * Forcor Wayre Stock Scraper
 * Checks stock availability on wayre.forcor.com.ar
 * Run: node scraper-forcor.cjs
 *
 * Requires: FORCOR_USER and FORCOR_PASS environment variables
 * Or uses defaults for testing
 */

const puppeteer = require('puppeteer');

const FORCOR_URL = 'https://wayre.forcor.com.ar';
const FORCOR_USER = process.env.FORCOR_USER || 'laforddewarnes@hotmail.com.ar';
const FORCOR_PASS = process.env.FORCOR_PASS || 'laforddewarnes';

// Parse OEM number into parts: "AB39-2K021-BA" → { prefijo: "AB39", basico: "2K021", sufijo1: "BA" }
function parseOEM(oem) {
  const clean = oem.replace(/\s+/g, '').toUpperCase();
  // Try format: PREFIX-BASIC-SUFFIX (e.g., AB39-2K021-BA)
  const parts = clean.split(/[-/]/);
  if (parts.length >= 2) {
    return {
      prefijo: parts[0] || '',
      basico: parts[1] || '',
      sufijo1: parts[2] || '',
      sufijo2: parts[3] || '',
    };
  }
  // Fallback: put everything in basico
  return { prefijo: '', basico: clean, sufijo1: '', sufijo2: '' };
}

async function loginForcor(browser) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  console.log('Logging into Forcor Wayre...');
  await page.goto(FORCOR_URL + '/login', { waitUntil: 'networkidle2', timeout: 30000 });

  // Fill login form
  await page.type('input[name="email"], input[type="email"]', FORCOR_USER, { delay: 50 });
  await page.type('input[name="password"], input[type="password"]', FORCOR_PASS, { delay: 50 });

  // Submit
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    page.click('button[type="submit"], input[type="submit"]'),
  ]);

  console.log('Logged in! URL:', page.url());
  return page;
}

async function searchPart(page, oem) {
  const parts = parseOEM(oem);

  // Build search URL
  const params = new URLSearchParams({
    'producto_filter[prefijo]': parts.prefijo,
    'producto_filter[basico]': parts.basico,
    'producto_filter[sufijo1]': parts.sufijo1,
    'producto_filter[sufijo2]': parts.sufijo2,
    'producto_filter[nombre]': '',
    'producto_filter[descripcion]': '',
  });

  const searchUrl = FORCOR_URL + '/extranet/productos?' + params.toString();
  await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

  // Extract results from the table
  const results = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    const data = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 4) {
        data.push({
          numero_parte: (cells[0]?.textContent || '').trim(),
          descripcion: (cells[1]?.textContent || '').trim(),
          precio: (cells[2]?.textContent || '').trim(),
          stock: (cells[3]?.textContent || '').trim(),
          disponible: !(cells[3]?.textContent || '').toLowerCase().includes('sin stock'),
        });
      }
    });
    return data;
  });

  return results;
}

// Check multiple parts
async function checkStock(oemList) {
  console.log(`Checking ${oemList.length} parts on Forcor...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await loginForcor(browser);
    const results = {};

    for (const oem of oemList) {
      try {
        console.log(`  Searching: ${oem}...`);
        const found = await searchPart(page, oem);
        results[oem] = found;
        // Small delay to not overwhelm the server
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.error(`  Error searching ${oem}:`, e.message);
        results[oem] = [];
      }
    }

    return results;
  } finally {
    await browser.close();
  }
}

// Export for use in server
module.exports = { checkStock, parseOEM, searchPart };

// If run directly, test with a sample part
if (require.main === module) {
  const testParts = ['EB3G-6714-BA', 'AB39-2K021-BA'];
  checkStock(testParts).then(results => {
    console.log('\nResults:');
    console.log(JSON.stringify(results, null, 2));
  }).catch(e => {
    console.error('Error:', e.message);
  });
}
