// ─── BUSCADOR IA (Fase 7) ─────────────────────────────────────────────────
// Server-side tool implementations exposed to Claude via tool_use.
// The endpoint in server.cjs loops Claude <-> these tools until the model
// says end_turn (or we hit max iterations).
//
// Tools implemented:
//   1. search_parts            — fuzzy text search with filters
//   2. filter_by_compatibility — match against detalles[] for modelo+año+motor
//   3. get_part_details        — full info for a single SKU
//   4. suggest_alternatives    — same category/model, different SKU
//   5. consultar_stock_ahora   — live stock via Fase 5 supplier-scraper
//   6. proponer_agregar_carrito — returns a proposal the frontend shows
//                                 with confirmation (never auto-adds)

const path = require('path');
const fs = require('fs');

// ─── CATALOG LOADING ──────────────────────────────────────────────────────
// The catalog JSON is the same file the frontend imports. We load it once
// at server boot. It can be hot-reloaded by calling reloadCatalog() after
// running scripts/merge-details.cjs or scripts/enrich-basic.cjs.
const CATALOG_PATH = path.join(__dirname, 'src', 'catalogo-ford.json');
let catalogRaw = {};
let catalogFlat = [];    // { sku, nombre, precio, cat, modelo_nombre, modelos_comp, detalles, stock, desc, foto_cdn, numero_parte }
let catalogBySku = {};

function reloadCatalog() {
  try {
    const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    catalogRaw = raw;
    catalogFlat = [];
    catalogBySku = {};
    for (const [modeloKey, arr] of Object.entries(raw)) {
      if (!Array.isArray(arr)) continue;
      for (const p of arr) {
        const part = {
          sku: String(p.sku || p.nro || ''),
          nombre: p.nombre || '',
          precio: p.precio_juan || p.precio_ford || 0,
          precio_ford: p.precio_ford || null,
          cat: p.cat || '',
          modelo_nombre: p.modelo_nombre || modeloKey,
          modelo_key: modeloKey,
          modelos_comp: Array.isArray(p.modelos_comp) ? p.modelos_comp : [],
          detalles: Array.isArray(p.detalles) ? p.detalles : [],
          stock: typeof p.stock === 'number' ? p.stock : 0,
          desc: p.desc || '',
          foto_cdn: p.foto_cdn || '',
          numero_parte: String(p.nro || p.numero_parte || p.sku || ''),
        };
        catalogFlat.push(part);
        if (part.sku) catalogBySku[part.sku] = part;
        if (part.numero_parte && !catalogBySku[part.numero_parte]) catalogBySku[part.numero_parte] = part;
      }
    }
    console.log(`[buscador-ia] catalog loaded: ${catalogFlat.length} parts`);
    return catalogFlat.length;
  } catch (e) {
    console.error('[buscador-ia] catalog load error:', e.message);
    return 0;
  }
}
reloadCatalog();

// ─── FUZZY SEARCH HELPERS ─────────────────────────────────────────────────
// No external lib — a cheap Levenshtein + substring scoring that's good
// enough for typos ("ranjer"→"ranger") and synonym-ish matches.
function normalize(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[-/.,_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 3) return 99;  // early out
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b[i - 1] === a[j - 1]
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[b.length][a.length];
}
function tokenMatchScore(tokens, haystack) {
  if (!haystack) return 0;
  const h = normalize(haystack);
  let score = 0;
  for (const t of tokens) {
    if (!t || t.length < 2) continue;
    if (h.includes(t)) { score += 10; continue; }
    // fuzzy: check each word in haystack vs this token
    const words = h.split(' ');
    let bestDist = 99;
    for (const w of words) {
      if (Math.abs(w.length - t.length) <= 2) {
        const d = levenshtein(w, t);
        if (d < bestDist) bestDist = d;
      }
    }
    if (bestDist <= 1) score += 6;
    else if (bestDist <= 2 && t.length >= 5) score += 3;
  }
  return score;
}

// Known synonyms/aliases — stock Ford slang & common client wording
const ALIAS = {
  'aseite': 'aceite', 'aseyte': 'aceite', 'aceyte': 'aceite',
  'filto': 'filtro', 'fltro': 'filtro',
  'ranjer': 'ranger', 'rangger': 'ranger',
  'eco sport': 'ecosport',
  'carter': 'carter motor',
  'pastilla de freno': 'pastillas freno',
  'pastillas': 'pastillas freno',
  'disco': 'disco freno',
  'correa': 'correa distribucion',
  'bateria': 'bateria',
  'kit embrague': 'embrague',
  'bobina': 'bobina encendido',
  'inyector': 'inyectores',
  'amortiguador': 'amortiguadores',
  'bujia': 'bujias',
  'bujía': 'bujias',
};
function expandAliases(q) {
  let out = normalize(q);
  for (const [from, to] of Object.entries(ALIAS)) {
    if (out.includes(from)) out = out + ' ' + to;
  }
  return out;
}

// ─── TOOL 1: search_parts ─────────────────────────────────────────────────
function tool_search_parts(input) {
  const query = String(input.query || '').trim();
  const modelo = input.modelo ? normalize(input.modelo) : '';
  const categoria = input.categoria ? normalize(input.categoria) : '';
  const anio = input.anio ? Number(input.anio) : null;
  const motor = input.motor ? normalize(input.motor) : '';
  const limit = Math.min(Math.max(Number(input.limit) || 8, 1), 15);

  if (!query && !modelo && !categoria) return { ok: false, error: 'Sin criterios de busqueda' };

  const expanded = expandAliases(query);
  const tokens = expanded.split(' ').filter(t => t.length >= 2);
  const scored = [];

  for (const p of catalogFlat) {
    if (modelo) {
      const mKey = normalize(p.modelo_key);
      const mNombre = normalize(p.modelo_nombre);
      const mComp = p.modelos_comp.map(normalize);
      if (!mKey.includes(modelo) && !mNombre.includes(modelo) && !mComp.some(m => m.includes(modelo) || modelo.includes(m))) continue;
    }
    if (categoria) {
      if (!normalize(p.cat).includes(categoria)) continue;
    }
    if (anio) {
      // match against detalles[] year ranges like "03/2012 - 01/2016"
      const detStr = (p.detalles || []).join(' ');
      if (detStr) {
        const rxes = detStr.match(/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{4})/g);
        if (rxes && rxes.length > 0) {
          let inRange = false;
          for (const r of rxes) {
            const m = r.match(/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{4})/);
            if (!m) continue;
            const from = Number(m[2]), to = Number(m[4]);
            if (anio >= from && anio <= to) { inRange = true; break; }
          }
          if (!inRange) continue;
        }
      }
    }
    if (motor) {
      const detStr = normalize((p.detalles || []).join(' ') + ' ' + p.nombre + ' ' + p.desc);
      if (!detStr.includes(motor)) continue;
    }

    let score = 0;
    score += tokenMatchScore(tokens, p.nombre) * 2;
    score += tokenMatchScore(tokens, p.cat) * 1.5;
    score += tokenMatchScore(tokens, p.desc);
    score += tokenMatchScore(tokens, p.modelo_nombre);
    score += tokenMatchScore(tokens, (p.detalles || []).join(' '));
    // SKU direct match bonus
    const nq = normalize(query).replace(/\s/g, '');
    if (nq.length >= 4) {
      const nSku = normalize(p.sku).replace(/\s/g, '');
      const nNro = normalize(p.numero_parte).replace(/\s/g, '');
      if (nSku.includes(nq) || nNro.includes(nq)) score += 50;
    }
    // Parts with verified detalles outrank those without (all else equal)
    if (p.detalles.length > 0) score += 2;
    if (score > 0) scored.push({ p, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit).map(({ p, score }) => ({
    sku: p.sku,
    nombre: p.nombre,
    precio: p.precio,
    categoria: p.cat,
    modelo: p.modelo_nombre,
    numero_parte: p.numero_parte,
    tiene_detalles: p.detalles.length > 0,
    stock_propio: p.stock,
    score: Math.round(score),
  }));
  return { ok: true, total_encontrado: scored.length, mostrando: top.length, items: top };
}

// ─── TOOL 2: filter_by_compatibility ──────────────────────────────────────
function tool_filter_by_compatibility(input) {
  const modelo = normalize(input.modelo || '');
  const anio = input.anio ? Number(input.anio) : null;
  const motor = normalize(input.motor || '');
  const categoria = input.categoria ? normalize(input.categoria) : '';
  const limit = Math.min(Number(input.limit) || 10, 20);
  if (!modelo) return { ok: false, error: 'Falta modelo' };

  const matches = [];
  for (const p of catalogFlat) {
    if (p.detalles.length === 0) continue;
    const detStr = normalize(p.detalles.join(' '));
    if (!detStr.includes(modelo)) continue;
    if (categoria && !normalize(p.cat).includes(categoria)) continue;
    if (motor && !detStr.includes(motor)) continue;
    if (anio) {
      const rxes = p.detalles.join(' ').match(/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{4})/g);
      if (rxes) {
        let inRange = false;
        for (const r of rxes) {
          const m = r.match(/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{4})/);
          if (!m) continue;
          if (anio >= Number(m[2]) && anio <= Number(m[4])) { inRange = true; break; }
        }
        if (!inRange) continue;
      }
    }
    matches.push(p);
    if (matches.length >= limit) break;
  }
  return {
    ok: true,
    total: matches.length,
    items: matches.map(p => ({
      sku: p.sku, nombre: p.nombre, precio: p.precio, categoria: p.cat,
      numero_parte: p.numero_parte, detalles_relevantes: p.detalles.slice(0, 3),
    })),
  };
}

// ─── TOOL 3: get_part_details ─────────────────────────────────────────────
function tool_get_part_details(input) {
  const sku = String(input.sku || '').trim();
  if (!sku) return { ok: false, error: 'Falta SKU' };
  const p = catalogBySku[sku];
  if (!p) return { ok: false, error: 'No encontré esa pieza', sku };
  return {
    ok: true,
    item: {
      sku: p.sku,
      numero_parte: p.numero_parte,
      nombre: p.nombre,
      categoria: p.cat,
      modelo: p.modelo_nombre,
      precio: p.precio,
      stock_propio: p.stock,
      descripcion: p.desc,
      modelos_compatibles: p.modelos_comp,
      detalles_verificados: p.detalles,
      tiene_foto: !!p.foto_cdn,
    },
  };
}

// ─── TOOL 4: suggest_alternatives ─────────────────────────────────────────
function tool_suggest_alternatives(input) {
  const sku = String(input.sku || '').trim();
  const limit = Math.min(Number(input.limit) || 5, 10);
  if (!sku) return { ok: false, error: 'Falta SKU' };
  const base = catalogBySku[sku];
  if (!base) return { ok: false, error: 'No encontré la pieza de referencia' };

  const modeloNorm = normalize(base.modelo_key);
  const catNorm = normalize(base.cat);
  const alts = [];
  for (const p of catalogFlat) {
    if (p.sku === base.sku) continue;
    const sameModel = normalize(p.modelo_key) === modeloNorm
      || base.modelos_comp.map(normalize).some(m => normalize(p.modelo_key).includes(m));
    const sameCat = normalize(p.cat) === catNorm;
    if (sameCat && sameModel) {
      alts.push({
        sku: p.sku, nombre: p.nombre, precio: p.precio, numero_parte: p.numero_parte,
        razon: 'misma categoria y modelo',
      });
    }
    if (alts.length >= limit) break;
  }
  return { ok: true, alternativas: alts };
}

// ─── TOOL 5: consultar_stock_ahora ────────────────────────────────────────
// Wraps the Fase 5 supplier-scraper. The caller (server.cjs) passes in the
// db instance so we don't import it directly.
async function tool_consultar_stock_ahora(input, context) {
  const sku = String(input.sku || '').trim();
  if (!sku) return { ok: false, error: 'Falta SKU' };
  if (!context || !context.supplierScraper) return { ok: false, error: 'Scraper no disponible' };
  try {
    const r = await context.supplierScraper.consultarStock(context.db, sku);
    // Summarize for Claude
    const summary = [];
    for (const [name, info] of Object.entries(r.suppliers || {})) {
      if (!info) continue;
      if (info.status === 'available') summary.push(`${name}: disponible`);
      else if (info.status === 'unavailable') summary.push(`${name}: ${info.reason}`);
      else if (info.status === 'error') summary.push(`${name}: error`);
      else if (info.status === 'unknown') summary.push(`${name}: sin info verificada`);
    }
    return {
      ok: true,
      from_cache: r.fromCache || false,
      age_hours: r.ageMs ? Math.round(r.ageMs / 3600000 * 10) / 10 : 0,
      resumen: summary.join(' · '),
      suppliers: r.suppliers,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── TOOL 6: proponer_agregar_carrito ─────────────────────────────────────
// This tool does NOT add anything. It emits a "cart proposal" that the
// frontend shows to the user with a confirmation button. The user has to
// click "Sí, agregar" explicitly.
function tool_proponer_agregar_carrito(input) {
  const sku = String(input.sku || '').trim();
  const qty = Math.max(1, Math.min(Number(input.cantidad) || 1, 20));
  const razon = String(input.razon || '').slice(0, 200);
  if (!sku) return { ok: false, error: 'Falta SKU' };
  const p = catalogBySku[sku];
  if (!p) return { ok: false, error: 'No encontré esa pieza' };
  return {
    ok: true,
    proposal: {
      type: 'cart_proposal',
      sku: p.sku,
      numero_parte: p.numero_parte,
      nombre: p.nombre,
      precio: p.precio,
      cantidad: qty,
      razon,
      requiere_confirmacion: true,
    },
    mensaje_para_claude: `Propuesta de carrito registrada. El usuario debe confirmar manualmente con el boton "Si, agregar" antes de que se agregue. No la des por hecha en tu respuesta, presentala como una sugerencia a confirmar.`,
  };
}

// ─── TOOL SCHEMAS (for Claude tool_use) ───────────────────────────────────
const TOOLS = [
  {
    name: 'search_parts',
    description: 'Busca repuestos en el catalogo de La Ford de Warnes con soporte de typos, sinonimos y filtros. Usalo cuando el usuario describe lo que busca en lenguaje natural. Podes combinar "query" (texto libre) con filtros opcionales.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto de busqueda libre, puede tener typos. Ejemplo: "filtro aire" o "correa distribucion".' },
        modelo: { type: 'string', description: 'Modelo de vehiculo (ranger, ecosport, transit, focus, etc). Opcional.' },
        anio: { type: 'number', description: 'Año del vehiculo (ej 2018). Opcional.' },
        motor: { type: 'string', description: 'Motor o combustible (ej "2.2", "diesel", "nafta"). Opcional.' },
        categoria: { type: 'string', description: 'Categoria (filtros, bujias, frenos, etc). Opcional.' },
        limit: { type: 'number', description: 'Cuantos resultados devolver (1-15, default 8).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'filter_by_compatibility',
    description: 'Busca repuestos que estan verificados como compatibles con un vehiculo especifico. Usa el campo "detalles" que viene del catalogo oficial Ford. Usalo cuando el cliente te da modelo+año+motor y queres devolver SOLO lo confirmado.',
    input_schema: {
      type: 'object',
      properties: {
        modelo: { type: 'string', description: 'Modelo del vehiculo. Obligatorio.' },
        anio: { type: 'number', description: 'Año del vehiculo.' },
        motor: { type: 'string', description: 'Motor o combustible.' },
        categoria: { type: 'string', description: 'Categoria del repuesto buscado.' },
        limit: { type: 'number', description: 'Cantidad maxima (1-20, default 10).' },
      },
      required: ['modelo'],
    },
  },
  {
    name: 'get_part_details',
    description: 'Devuelve toda la informacion detallada de una pieza especifica por su SKU. Usalo cuando ya tenes el SKU de un resultado previo y necesitas mas contexto (descripcion, compatibilidad completa, stock propio).',
    input_schema: {
      type: 'object',
      properties: {
        sku: { type: 'string', description: 'SKU de la pieza (viene de otros resultados).' },
      },
      required: ['sku'],
    },
  },
  {
    name: 'suggest_alternatives',
    description: 'Dado un SKU, devuelve otras piezas de la misma categoria y modelo que podrian servir como alternativa. Usalo cuando la pieza buscada no tiene stock o el cliente pide opciones.',
    input_schema: {
      type: 'object',
      properties: {
        sku: { type: 'string', description: 'SKU de referencia.' },
        limit: { type: 'number', description: 'Cantidad de alternativas (1-10, default 5).' },
      },
      required: ['sku'],
    },
  },
  {
    name: 'consultar_stock_ahora',
    description: 'Consulta en tiempo real la disponibilidad en los proveedores externos (Forcor, Fordmata, FNX, Taraborelli). Usa cache de 12h y respeta limites ultra-conservadores. Usalo SOLO cuando el cliente pregunta explicitamente "tenes stock?" o equivalente.',
    input_schema: {
      type: 'object',
      properties: {
        sku: { type: 'string', description: 'SKU a consultar.' },
      },
      required: ['sku'],
    },
  },
  {
    name: 'proponer_agregar_carrito',
    description: 'Propone agregar una pieza al carrito del cliente. IMPORTANTE: esta herramienta NO agrega nada automaticamente — emite una propuesta que el frontend muestra con un boton de confirmacion. En tu respuesta al usuario NO des la accion por hecha, presentala como "te propongo agregar X, ¿confirmas?". Solo usala cuando el usuario dijo explicitamente que quiere agregar algo al carrito.',
    input_schema: {
      type: 'object',
      properties: {
        sku: { type: 'string', description: 'SKU de la pieza a proponer.' },
        cantidad: { type: 'number', description: 'Cantidad (default 1, max 20).' },
        razon: { type: 'string', description: 'Breve justificacion de por que es lo que el cliente busca.' },
      },
      required: ['sku'],
    },
  },
];

// ─── EXECUTE TOOL (dispatcher) ────────────────────────────────────────────
async function executeTool(name, input, context) {
  try {
    switch (name) {
      case 'search_parts': return tool_search_parts(input);
      case 'filter_by_compatibility': return tool_filter_by_compatibility(input);
      case 'get_part_details': return tool_get_part_details(input);
      case 'suggest_alternatives': return tool_suggest_alternatives(input);
      case 'consultar_stock_ahora': return await tool_consultar_stock_ahora(input, context);
      case 'proponer_agregar_carrito': return tool_proponer_agregar_carrito(input);
      default: return { ok: false, error: 'Unknown tool: ' + name };
    }
  } catch (e) {
    console.error('[buscador-ia tool]', name, e);
    return { ok: false, error: 'Tool failed: ' + e.message };
  }
}

module.exports = { TOOLS, executeTool, reloadCatalog, getCatalogSize: () => catalogFlat.length, catalogBySku: () => catalogBySku };
