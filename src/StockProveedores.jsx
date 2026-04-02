import { useState, useMemo } from 'react';
import { authFetch } from './App.jsx';

const SUPPLIERS = [
  { id: 'forcor', name: 'Forcor', color: '#3b82f6', buildUrl: (nro) => {
    const p = nro.replace(/\//g, '-').split('-');
    return `https://wayre.forcor.com.ar/extranet/productos?producto_filter[prefijo]=${p[0]||''}&producto_filter[basico]=${p[1]||''}&producto_filter[sufijo1]=${p[2]||''}&producto_filter[sufijo2]=${p[3]||''}`;
  }},
  { id: 'fordmata', name: 'Fordmata', color: '#f97316', buildUrl: (nro) => {
    return `https://fordmata.no-ip.org/ford/extranet/abmPiezasCliente.asp?g=8`;
  }},
  { id: 'fnx', name: 'FNX', color: '#22c55e', buildUrl: (nro) => {
    return `http://fnx.com.ar/index.php?pagina=lista-productos&busqueda=${encodeURIComponent(nro)}`;
  }},
  { id: 'taraborelli', name: 'Taraborelli', color: '#a855f7', buildUrl: (nro) => {
    return `http://repuestos.fordtaraborelli.com/v2/#/listado-repuestos`;
  }},
];

export default function StockProveedores({ catalogo, modelos, theme }) {
  const t = theme || {};
  const [search, setSearch] = useState('');
  const [stockData, setStockData] = useState({});
  const [loading, setLoading] = useState(false);

  // Flatten catalog
  const allParts = useMemo(() => {
    const list = [];
    for (const [modelId, parts] of Object.entries(catalogo || {})) {
      const modelo = (modelos || []).find(m => m.id === modelId);
      for (const p of parts) {
        list.push({ ...p, modelo_id: modelId, modelo_nombre: modelo?.nombre || modelId });
      }
    }
    return list;
  }, [catalogo, modelos]);

  const normalize = (s) => (s || '').toLowerCase().replace(/[-/.\\s]/g, '');
  const sq = search.toLowerCase().trim();
  const sqNorm = normalize(sq);

  const results = sq.length > 2 ? allParts.filter(p => {
    const pNorm = normalize(p.numero_parte);
    const pName = (p.nombre || '').toLowerCase();
    if (sqNorm.length > 3 && pNorm.includes(sqNorm)) return true;
    if ((p.numero_parte || '').toLowerCase().includes(sq)) return true;
    if (pName.includes(sq)) return true;
    if (sq.includes(' ')) {
      const words = sq.split(/\s+/);
      const hay = pName + ' ' + (p.modelo_nombre || '') + ' ' + (p.numero_parte || '').toLowerCase();
      return words.every(w => hay.includes(w));
    }
    return false;
  }).slice(0, 20) : [];

  const openSupplier = (supplier, partNumber) => {
    window.open(supplier.buildUrl(partNumber), '_blank');
  };

  const openAllSuppliers = (partNumber) => {
    SUPPLIERS.forEach(s => {
      setTimeout(() => window.open(s.buildUrl(partNumber), '_blank'), 100);
    });
  };

  const markStock = async (partNumber, supplierId, hasStock, precio) => {
    const key = partNumber + '_' + supplierId;
    const newData = { ...stockData, [key]: { hasStock, precio: precio || '', updatedAt: Date.now(), by: 'staff' } };
    setStockData(newData);
    // Save to server
    try {
      await authFetch('/api/supplier-stock-mark', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partNumber, supplier: supplierId, hasStock, precio }),
      });
    } catch {}
  };

  const getStockMark = (partNumber, supplierId) => {
    return stockData[partNumber + '_' + supplierId];
  };

  // Load saved stock data on mount
  useState(() => {
    authFetch('/api/supplier-stock').then(r => r.json()).then(d => {
      if (d.stock) {
        const flat = {};
        for (const [part, data] of Object.entries(d.stock)) {
          if (data.suppliers) {
            for (const [sup, info] of Object.entries(data.suppliers)) {
              flat[part + '_' + sup] = { hasStock: info.available, precio: info.precio || '', updatedAt: info.checkedAt };
            }
          }
        }
        setStockData(flat);
      }
    }).catch(() => {});
  });

  const parsePrice = (p) => parseInt(String(p).replace(/\D/g, '')) || 0;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: t.bg || '#fafafa' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + (t.cardBorder || '#e0e0e0'), background: t.card || '#fff', flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: t.text || '#333' }}>Stock Proveedores</div>
        <div style={{ fontSize: 12, color: t.textSecondary || '#888', marginTop: 2 }}>
          Busca una pieza → abre los proveedores → marca si hay stock
        </div>

        {/* Search */}
        <div style={{ marginTop: 12 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar pieza por nombre o codigo..."
            style={{
              width: '100%', padding: '14px 18px', fontSize: 15, fontWeight: 500,
              border: '2px solid ' + (t.cardBorder || '#e0e0e0'), borderRadius: 12,
              background: t.bg || '#fafafa', color: t.text || '#333',
              outline: 'none', fontFamily: 'inherit',
            }} />
        </div>

        {/* Supplier legend */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {SUPPLIERS.map(s => (
            <span key={s.id} style={{
              fontSize: 11, fontWeight: 700, color: s.color,
              background: s.color + '18', padding: '3px 10px', borderRadius: 6,
            }}>{s.name}</span>
          ))}
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {results.length === 0 && sq.length > 2 && (
          <div style={{ textAlign: 'center', padding: 40, color: t.textMuted || '#999', fontSize: 14 }}>
            No se encontró "{search}" en el catálogo
          </div>
        )}
        {results.length === 0 && sq.length <= 2 && (
          <div style={{ textAlign: 'center', padding: 40, color: t.textMuted || '#999' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Busca una pieza</div>
            <div style={{ fontSize: 12 }}>Escribí el nombre o código (ej: "filtro aceite" o "mb3z2200a")</div>
          </div>
        )}

        {results.map((part, i) => (
          <div key={i} style={{
            background: t.card || '#fff', border: '1px solid ' + (t.cardBorder || '#e0e0e0'),
            borderRadius: 14, padding: 16, marginBottom: 12,
          }}>
            {/* Part info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: t.text || '#333' }}>{part.nombre}</div>
                <div style={{ fontSize: 12, color: t.textSecondary || '#888', marginTop: 2 }}>
                  {part.numero_parte} · {part.aplicativos?.slice(0, 3).join(' / ') || part.modelo_nombre}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>{part.precio}</div>
                <div style={{ fontSize: 10, color: t.textMuted || '#999' }}>Nuestro precio</div>
              </div>
            </div>

            {/* Open all button */}
            <button onClick={() => openAllSuppliers(part.numero_parte)} style={{
              width: '100%', padding: 12, fontSize: 14, fontWeight: 700,
              border: 'none', borderRadius: 10,
              background: 'linear-gradient(135deg, #003478, #0060c0)', color: '#fff',
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10,
            }}>
              Buscar en todos los proveedores
            </button>

            {/* Individual suppliers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
              {SUPPLIERS.map(sup => {
                const mark = getStockMark(part.numero_parte, sup.id);
                return (
                  <div key={sup.id} style={{
                    border: '2px solid ' + (mark?.hasStock ? '#22c55e' : mark?.hasStock === false ? '#ef4444' : (t.cardBorder || '#e0e0e0')),
                    borderRadius: 10, padding: 10, background: mark?.hasStock ? 'rgba(34,197,94,.06)' : mark?.hasStock === false ? 'rgba(239,68,68,.06)' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: sup.color }}>{sup.name}</span>
                      {mark && (
                        <span style={{ fontSize: 9, color: t.textMuted || '#999' }}>
                          {new Date(mark.updatedAt).toLocaleDateString('es-AR')}
                        </span>
                      )}
                    </div>

                    {/* Open supplier */}
                    <button onClick={() => openSupplier(sup, part.numero_parte)} style={{
                      width: '100%', padding: 8, fontSize: 11, fontWeight: 600,
                      border: '1px solid ' + sup.color + '40', borderRadius: 6,
                      background: sup.color + '10', color: sup.color,
                      cursor: 'pointer', fontFamily: 'inherit', marginBottom: 6,
                    }}>
                      Abrir {sup.name}
                    </button>

                    {/* Mark buttons */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => markStock(part.numero_parte, sup.id, true)} style={{
                        flex: 1, padding: 8, fontSize: 12, fontWeight: 700,
                        border: mark?.hasStock ? '2px solid #22c55e' : '1px solid ' + (t.cardBorder || '#ddd'),
                        borderRadius: 6, background: mark?.hasStock ? '#22c55e' : 'transparent',
                        color: mark?.hasStock ? '#fff' : '#22c55e',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        ✓ Hay
                      </button>
                      <button onClick={() => markStock(part.numero_parte, sup.id, false)} style={{
                        flex: 1, padding: 8, fontSize: 12, fontWeight: 700,
                        border: mark?.hasStock === false ? '2px solid #ef4444' : '1px solid ' + (t.cardBorder || '#ddd'),
                        borderRadius: 6, background: mark?.hasStock === false ? '#ef4444' : 'transparent',
                        color: mark?.hasStock === false ? '#fff' : '#ef4444',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                        ✗ No
                      </button>
                    </div>

                    {/* Price input */}
                    {mark?.hasStock && (
                      <input placeholder="Precio proveedor" value={mark.precio || ''}
                        onChange={e => markStock(part.numero_parte, sup.id, true, e.target.value)}
                        style={{
                          width: '100%', marginTop: 6, padding: '6px 8px', fontSize: 11,
                          border: '1px solid ' + (t.cardBorder || '#ddd'), borderRadius: 6,
                          background: t.bg || '#fafafa', color: t.text || '#333',
                          outline: 'none', fontFamily: 'inherit', textAlign: 'center',
                        }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
