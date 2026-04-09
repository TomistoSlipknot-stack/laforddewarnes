#!/usr/bin/env node
// Fase 6A: enriquece catalogo-ford.json con los modelos basicos que estan
// en tiendaford_ar_repuestos.json. Solo sobrescribe modelos_comp si el
// destino tiene la lista vacia o mas corta que la fuente.
// Uso: node scripts/enrich-basic.cjs
const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '..', 'src', 'catalogo-ford.json');
const TIENDAFORD_PATH = process.argv[2] || 'C:/Users/Usuario/Downloads/tiendaford_ar_repuestos.json';

function main() {
  if (!fs.existsSync(TIENDAFORD_PATH)) {
    console.error('[enrich-basic] no encuentro', TIENDAFORD_PATH);
    process.exit(1);
  }
  const tienda = JSON.parse(fs.readFileSync(TIENDAFORD_PATH, 'utf8'));
  const bySku = {};
  for (const p of (tienda.productos || [])) {
    if (p.numero_pieza) bySku[String(p.numero_pieza)] = p;
  }
  console.log('[enrich-basic] tiendaford productos:', Object.keys(bySku).length);

  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  let enriched = 0, untouched = 0, missing = 0;
  for (const [modeloKey, arr] of Object.entries(catalog)) {
    if (!Array.isArray(arr)) continue;
    for (const part of arr) {
      const sku = String(part.sku || '');
      const src = bySku[sku];
      if (!src) { missing++; continue; }
      const srcModelos = Array.isArray(src.modelos) ? src.modelos : [];
      const dstModelos = Array.isArray(part.modelos_comp) ? part.modelos_comp : [];
      if (srcModelos.length > dstModelos.length) {
        part.modelos_comp = srcModelos;
        enriched++;
      } else {
        untouched++;
      }
      // Also enrich description if empty in destination
      if ((!part.desc || part.desc.length < 10) && src.descripcion) {
        part.desc = src.descripcion;
      }
    }
  }
  // Backup
  const bak = CATALOG_PATH + '.bak-' + Date.now();
  fs.copyFileSync(CATALOG_PATH, bak);
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog));
  console.log('[enrich-basic] enriched:', enriched, 'untouched:', untouched, 'not in tiendaford:', missing);
  console.log('[enrich-basic] backup ->', bak);
  console.log('[enrich-basic] escrito ->', CATALOG_PATH);
}

main();
