// La Ford de Warnes - Stock Checker Extension
// Searches suppliers in background tabs when requested

const SUPPLIERS = {
  forcor: {
    name: 'Forcor',
    loginUrl: 'https://wayre.forcor.com.ar/login',
    buildSearchUrl: (nro) => {
      const p = nro.replace(/\//g, '-').split('-');
      return `https://wayre.forcor.com.ar/extranet/productos?producto_filter[prefijo]=${p[0]||''}&producto_filter[basico]=${p[1]||''}&producto_filter[sufijo1]=${p[2]||''}&producto_filter[sufijo2]=${p[3]|''}`;
    },
    parseScript: `
      (function() {
        const rows = document.querySelectorAll('table tbody tr');
        if (rows.length === 0) {
          // Check if we're on login page
          if (document.querySelector('input[type="password"]')) return { needsLogin: true };
          return { found: false, items: [] };
        }
        const items = [];
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            items.push({
              numero: (cells[0]?.innerText || '').trim(),
              desc: (cells[1]?.innerText || '').trim(),
              precio: (cells[2]?.innerText || '').trim(),
              stock: (cells[3]?.innerText || '').trim(),
              available: !(cells[3]?.innerText || '').toLowerCase().includes('sin stock'),
            });
          }
        });
        return { found: items.length > 0, items };
      })()
    `,
  },
  fnx: {
    name: 'FNX',
    loginUrl: 'http://fnx.com.ar/index.php?banner=show',
    buildSearchUrl: (nro) => `http://fnx.com.ar/index.php?pagina=lista-productos&busqueda=${encodeURIComponent(nro)}`,
    parseScript: `
      (function() {
        if (document.querySelector('input[name="usuario"]')) return { needsLogin: true };
        const rows = document.querySelectorAll('table tr, .producto, .item');
        const items = [];
        rows.forEach(row => {
          const text = row.innerText || '';
          if (text.length > 10 && !text.includes('Buscar')) {
            const hasStock = text.toLowerCase().includes('en stock') || text.toLowerCase().includes('disponible');
            const noStock = text.toLowerCase().includes('sin stock') || text.toLowerCase().includes('no disponible');
            items.push({ text: text.substring(0, 200), available: hasStock && !noStock });
          }
        });
        return { found: items.length > 0, items };
      })()
    `,
  },
  fordmata: {
    name: 'Fordmata',
    loginUrl: 'https://fordmata.no-ip.org/ford/extranet/default.asp',
    buildSearchUrl: (nro) => `https://fordmata.no-ip.org/ford/extranet/abmPiezasCliente.asp?g=8`,
    parseScript: `
      (function() {
        if (document.querySelector('input[name="password"]')) return { needsLogin: true };
        const rows = document.querySelectorAll('table tr');
        const items = [];
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            const text = Array.from(cells).map(c => c.innerText.trim()).join(' | ');
            items.push({ text, available: true });
          }
        });
        return { found: items.length > 0, items };
      })()
    `,
  },
  taraborelli: {
    name: 'Taraborelli',
    loginUrl: 'http://repuestos.fordtaraborelli.com/v2/',
    buildSearchUrl: (nro) => `http://repuestos.fordtaraborelli.com/v2/#/listado-repuestos`,
    parseScript: `
      (function() {
        if (document.querySelector('input[type="password"]')) return { needsLogin: true };
        const items = [];
        document.querySelectorAll('tr, .item, .producto, [class*="row"]').forEach(el => {
          const text = el.innerText || '';
          if (text.length > 10) items.push({ text: text.substring(0, 200), available: true });
        });
        return { found: items.length > 0, items };
      })()
    `,
  },
};

// Store for login status
let loggedIn = { forcor: false, fnx: false, fordmata: false, taraborelli: false };

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CHECK_STOCK') {
    checkStock(msg.partNumber).then(sendResponse);
    return true; // Keep channel open for async
  }
  if (msg.type === 'LOGIN_STATUS') {
    sendResponse(loggedIn);
    return true;
  }
  if (msg.type === 'OPEN_LOGIN') {
    chrome.tabs.create({ url: SUPPLIERS[msg.supplier].loginUrl, active: true });
    sendResponse({ ok: true });
    return true;
  }
});

async function checkStock(partNumber) {
  console.log('[FordWarnes] Checking stock for:', partNumber);
  const results = {};

  for (const [id, supplier] of Object.entries(SUPPLIERS)) {
    try {
      const url = supplier.buildSearchUrl(partNumber);
      console.log(`[${supplier.name}] Opening:`, url);

      // Create tab in background
      const tab = await chrome.tabs.create({ url, active: false });

      // Wait for page to load
      await new Promise(r => setTimeout(r, 3000));

      // Execute parse script
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: new Function('return ' + supplier.parseScript),
      });

      const data = result?.result || { found: false, items: [] };

      if (data.needsLogin) {
        loggedIn[id] = false;
        results[id] = { available: false, needsLogin: true, name: supplier.name };
      } else {
        loggedIn[id] = true;
        results[id] = {
          available: data.found && data.items.some(i => i.available),
          items: data.items || [],
          name: supplier.name,
        };
      }

      // Close background tab
      await chrome.tabs.remove(tab.id);
      console.log(`[${supplier.name}]`, data.found ? 'Found items' : 'Nothing found');

      // Small delay between suppliers
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`[${supplier.name}] Error:`, e.message);
      results[id] = { available: false, error: e.message, name: supplier.name };
    }
  }

  console.log('[FordWarnes] Results:', results);
  return results;
}
