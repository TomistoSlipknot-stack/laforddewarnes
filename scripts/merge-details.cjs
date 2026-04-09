#!/usr/bin/env node
// Fase 6B: mergea los detalles de compatibilidad verificados por Claude
// extension (desde tiendaford.ar) al catalogo-ford.json.
//
// Acepta uno o varios archivos JSON con este formato:
// {
//   "progress": { "done": N, "total": M, "last_sku": "..." },
//   "results": [
//     { "sku": "655051", "found": true, "url": "...", "nombre_en_sitio": "...",
//       "details": ["FORD KUGA ...", "FORD MONDEO ..."] },
//     { "sku": "734114", "found": false, "url": null, "nombre_en_sitio": null, "details": [] }
//   ]
// }
//
// Uso:
//   node scripts/merge-details.cjs data/results-compatibilidades.json
//   node scripts/merge-details.cjs data/results/*.json
//
// Idempotente: re-ejecutarlo no duplica ni rompe nada. Solo actualiza.
// Se puede correr parcialmente (con 100 SKUs, 500 SKUs, o todos).
const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '..', 'src', 'catalogo-ford.json');

function loadResults(argv) {
  const files = argv.slice(2);
  if (files.length === 0) {
    // Default: look for the single results file
    const def = path.join(__dirname, '..', 'data', 'results-compatibilidades.json');
    if (fs.existsSync(def)) files.push(def);
    else {
      console.error('[merge-details] no me pasaste archivo y no existe data/results-compatibilidades.json');
      process.exit(1);
    }
  }
  const bySku = {};
  let totalParsed = 0, totalSkipped = 0;
  for (const f of files) {
    if (!fs.existsSync(f)) { console.warn('[merge-details] no existe', f); continue; }
    let raw;
    try { raw = fs.readFileSync(f, 'utf8'); }
    catch (e) { console.error('[merge-details] no pude leer', f, e.message); continue; }
    // Tolerate Claude wrapping the JSON in ```json ... ```
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    let data;
    try { data = JSON.parse(raw); }
    catch (e) { console.error('[merge-details] JSON invalido en', f, e.message); continue; }
    const results = Array.isArray(data.results) ? data.results
      : Array.isArray(data) ? data : [];
    for (const r of results) {
      if (!r || !r.sku) { totalSkipped++; continue; }
      const sku = String(r.sku);
      // Last one wins if duplicate across files
      bySku[sku] = {
        found: r.found === true,
        url: r.url || null,
        nombre: r.nombre_en_sitio || null,
        details: Array.isArray(r.details) ? r.details.filter(x => typeof x === 'string' && x.trim()) : [],
      };
      totalParsed++;
    }
    console.log('[merge-details] parsed', results.length, 'from', path.basename(f));
  }
  console.log('[merge-details] total unique SKUs:', Object.keys(bySku).length, 'skipped:', totalSkipped);
  return bySku;
}

function main() {
  const bySku = loadResults(process.argv);
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  let applied = 0, emptied = 0, notFoundInCat = 0, noMatch = 0;
  const usedSkus = new Set();
  for (const arr of Object.values(catalog)) {
    if (!Array.isArray(arr)) continue;
    for (const part of arr) {
      const sku = String(part.sku || '');
      if (!sku || !bySku[sku]) { noMatch++; continue; }
      const r = bySku[sku];
      usedSkus.add(sku);
      if (r.found && r.details.length > 0) {
        part.detalles = r.details;
        applied++;
      } else if (r.found === false) {
        // Product not found in tiendaford — mark so UI shows "consultar a Juan"
        part.detalles_status = 'no_en_tiendaford';
        emptied++;
      } else {
        // Found but empty details section
        part.detalles_status = 'sin_detalles';
        emptied++;
      }
    }
  }
  for (const sku of Object.keys(bySku)) if (!usedSkus.has(sku)) notFoundInCat++;

  const bak = CATALOG_PATH + '.bak-' + Date.now();
  fs.copyFileSync(CATALOG_PATH, bak);
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog));
  console.log('[merge-details] applied details:', applied);
  console.log('[merge-details] marked without details:', emptied);
  console.log('[merge-details] catalog parts with no result yet:', noMatch);
  console.log('[merge-details] result SKUs not in our catalog:', notFoundInCat);
  console.log('[merge-details] backup ->', bak);
  console.log('[merge-details] updated ->', CATALOG_PATH);
}

main();
