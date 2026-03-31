import { useState, useRef } from 'react';
import { authFetch } from './App.jsx';

export default function AdminStock({ modelos, catalogo, onUpdatePart, onBulkPrice, imgModelos }) {
  const [catFilter, setCatFilter] = useState('all');
  const [selModelo, setSelModelo] = useState(null);
  const [editPart, setEditPart] = useState(null);
  const [bulkPct, setBulkPct] = useState('');
  const [search, setSearch] = useState('');
  const fileRef = useRef(null);

  const categorias = [...new Set(modelos.map(m => m.cat))];
  const filteredModelos = catFilter === 'all' ? modelos : modelos.filter(m => m.cat === catFilter);
  const sq = search.toLowerCase();
  const searchedModelos = sq ? filteredModelos.filter(m => m.nombre.toLowerCase().includes(sq) || m.id.toLowerCase().includes(sq)) : filteredModelos;

  const partsForModel = selModelo ? (catalogo[selModelo.id] || []) : [];

  const searchedParts = sq && selModelo ? partsForModel.filter(p =>
    p.nombre.toLowerCase().includes(sq) || p.cat.toLowerCase().includes(sq) || p.numero_parte.toLowerCase().includes(sq)
  ) : partsForModel;

  const sc = (stock) => stock > 5 ? '#22c55e' : stock > 0 ? '#f59e0b' : '#ef4444';

  const savePart = () => {
    if (!editPart || !selModelo) return;
    onUpdatePart(selModelo.id, editPart);
    setEditPart(null);
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file || !editPart) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const res = await authFetch('/api/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: ev.target.result, filename: (editPart.numero_parte || 'img').replace(/[^a-zA-Z0-9]/g, '') }),
        });
        const data = await res.json();
        if (data.url) setEditPart({ ...editPart, img_custom: data.url });
      } catch (err) { /* ignore */ }
    };
    reader.readAsDataURL(file);
  };

  const applyBulk = () => {
    const pct = parseFloat(bulkPct);
    if (isNaN(pct)) return;
    onBulkPrice(pct, selModelo?.id || null);
    setBulkPct('');
  };

  // ── MODEL LIST VIEW ──
  if (!selModelo) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--fw-bg, #fafafa)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--fw-text, #333)', marginBottom: 10 }}>Gestionar Stock y Precios</div>
          {/* Category tabs */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            <button onClick={() => setCatFilter('all')} style={{ background: catFilter === 'all' ? '#003478' : 'transparent', border: `1px solid ${catFilter === 'all' ? '#0050a0' : '#e0e0e0'}`, borderRadius: 7, padding: '4px 10px', fontSize: 11, color: catFilter === 'all' ? '#fff' : '#888', cursor: 'pointer', fontFamily: 'inherit' }}>
              Todos ({modelos.length})
            </button>
            {categorias.map(c => {
              const count = modelos.filter(m => m.cat === c).length;
              return (
                <button key={c} onClick={() => setCatFilter(c)} style={{ background: catFilter === c ? '#003478' : 'transparent', border: `1px solid ${catFilter === c ? '#0050a0' : '#e0e0e0'}`, borderRadius: 7, padding: '4px 10px', fontSize: 11, color: catFilter === c ? '#fff' : '#888', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {c} ({count})
                </button>
              );
            })}
          </div>
          {/* Bulk price */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, background: 'var(--fw-card, #fff)', border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 8, padding: '6px 10px' }}>
            <span style={{ fontSize: 11, color: 'var(--fw-textSecondary, #666)', flexShrink: 0 }}>Subir/bajar TODO:</span>
            <input value={bulkPct} onChange={e => setBulkPct(e.target.value)} placeholder="+15 o -10" type="number"
              style={{ width: 70, padding: '4px 8px', fontSize: 13, border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 6, background: 'var(--fw-bg, #fafafa)', color: 'var(--fw-text, #333)', outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
            <span style={{ fontSize: 13, color: 'var(--fw-textSecondary, #888)' }}>%</span>
            <button onClick={applyBulk} disabled={!bulkPct.trim()} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 6, background: bulkPct.trim() ? '#003478' : '#ccc', color: '#fff', cursor: bulkPct.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              Aplicar
            </button>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar modelo..."
            style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 8, background: 'var(--fw-card, #fff)', color: 'var(--fw-text, #333)', outline: 'none', fontFamily: 'inherit' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {categorias.filter(c => catFilter === 'all' || c === catFilter).map(cat => {
            const ms = searchedModelos.filter(m => m.cat === cat);
            if (!ms.length) return null;
            return (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#003478', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #e0e0e0' }}>{cat}</div>
                {ms.map(m => {
                  const parts = catalogo[m.id] || [];
                  const inStock = parts.filter(p => p.stock > 0).length;
                  const hasAnyStock = parts.some(p => p.stock > 0);
                  const imgSrc = imgModelos && imgModelos[m.id];
                  return (
                    <div key={m.id} onClick={() => { setSelModelo(m); setSearch(''); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--fw-card, #fff)', border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 10, marginBottom: 4, cursor: 'pointer', transition: 'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--fw-bg, #f0f4f8)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--fw-card, #fff)'}>
                      <div style={{ width: 60, height: 42, borderRadius: 8, overflow: 'hidden', background: m.color, flexShrink: 0 }}>
                        {imgSrc && <img src={imgSrc} alt={m.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fw-text, #333)' }}>{m.nombre}</div>
                        <div style={{ fontSize: 11, color: 'var(--fw-textSecondary, #777)' }}>{m.año} · {parts.length} repuestos</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {hasAnyStock
                          ? <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>{inStock} en stock</div>
                          : <div style={{ fontSize: 11, color: 'var(--fw-textSecondary, #999)' }}>Sin cargar</div>
                        }
                        <div style={{ fontSize: 10, color: 'var(--fw-textMuted, #888)' }}>{parts.length} piezas</div>
                      </div>
                      <div style={{ color: 'var(--fw-textSecondary, #999)', fontSize: 16 }}>›</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── PARTS LIST VIEW (for selected model) ──
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--fw-bg, #fafafa)' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={() => setSelModelo(null)} style={{ background: 'none', border: 'none', color: '#003478', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>← Volver</button>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--fw-text, #333)' }}>{selModelo.nombre}</span>
            <span style={{ fontSize: 12, color: 'var(--fw-textSecondary, #777)', marginLeft: 8 }}>{selModelo.año} · {partsForModel.length} repuestos</span>
          </div>
        </div>
        {/* Bulk for this model */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, background: 'var(--fw-card, #fff)', border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 8, padding: '6px 10px' }}>
          <span style={{ fontSize: 11, color: 'var(--fw-textSecondary, #666)', flexShrink: 0 }}>Precios {selModelo.nombre}:</span>
          <input value={bulkPct} onChange={e => setBulkPct(e.target.value)} placeholder="+15" type="number"
            style={{ width: 60, padding: '4px 8px', fontSize: 13, border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 6, background: 'var(--fw-bg, #fafafa)', color: 'var(--fw-text, #333)', outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
          <span style={{ fontSize: 13, color: 'var(--fw-textSecondary, #888)' }}>%</span>
          <button onClick={applyBulk} disabled={!bulkPct.trim()} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 6, background: bulkPct.trim() ? '#003478' : '#ccc', color: '#fff', cursor: bulkPct.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            Aplicar
          </button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar repuesto..."
          style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 8, background: 'var(--fw-card, #fff)', color: 'var(--fw-text, #333)', outline: 'none', fontFamily: 'inherit' }} />
      </div>

      {/* Parts list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {searchedParts.map((p, i) => (
          <div key={p.numero_parte || i} onClick={() => setEditPart({ ...p })}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--fw-card, #fff)', border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 10, marginBottom: 6, cursor: 'pointer', transition: 'background .1s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--fw-bg, #f0f4f8)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--fw-card, #fff)'}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: sc(p.stock), flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fw-text, #333)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
              <div style={{ fontSize: 12, color: 'var(--fw-textSecondary, #777)', marginTop: 2 }}>{p.cat} · {p.numero_parte}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fw-text, #333)' }}>{p.precio}</div>
              {p.precio_oem && <div style={{ fontSize: 11, color: 'var(--fw-textSecondary, #888)', textDecoration: 'line-through' }}>OEM {p.precio_oem}</div>}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: sc(p.stock), minWidth: 30, textAlign: 'right' }}>{p.stock || 0}</div>
            <div style={{ color: 'var(--fw-text, #333)', fontSize: 12 }}>✏️</div>
          </div>
        ))}
      </div>

      {/* ── EDIT MODAL ── */}
      {editPart && (
        <div onClick={() => setEditPart(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--fw-card, #fff)', border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 16, width: '100%', maxWidth: 480, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--fw-text, #333)', marginBottom: 4 }}>Editar Repuesto</div>
            <div style={{ fontSize: 12, color: 'var(--fw-textSecondary, #777)', marginBottom: 16 }}>{editPart.numero_parte} · {selModelo.nombre}</div>

            {/* Photo */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--fw-textSecondary, #666)', display: 'block', marginBottom: 4 }}>Foto del repuesto</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {(editPart.img_custom) && <img src={editPart.img_custom} alt="" style={{ width: 64, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--fw-cardBorder, #e0e0e0)' }} />}
                <button onClick={() => fileRef.current?.click()} style={{ padding: '8px 14px', fontSize: 12, border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 8, background: 'var(--fw-bg, #fafafa)', color: '#003478', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {editPart.img_custom ? 'Cambiar foto' : 'Subir foto'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
              </div>
            </div>

            {/* Name */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--fw-textSecondary, #666)', display: 'block', marginBottom: 4 }}>Nombre</label>
              <input value={editPart.nombre || ''} onChange={e => setEditPart({ ...editPart, nombre: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 8, background: 'var(--fw-bg, #fafafa)', color: 'var(--fw-text, #333)', outline: 'none', fontFamily: 'inherit' }} />
            </div>

            {/* Prices side by side */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#22c55e', display: 'block', marginBottom: 4 }}>Precio Nuestro (lo que cobra Juan)</label>
                <input value={editPart.precio || ''} onChange={e => setEditPart({ ...editPart, precio: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 16, fontWeight: 700, border: '1px solid #22c55e33', borderRadius: 8, background: 'var(--fw-bg, #fafafa)', color: '#22c55e', outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#003478', display: 'block', marginBottom: 4 }}>Precio OEM Ford (referencia)</label>
                <input value={editPart.precio_oem || ''} onChange={e => setEditPart({ ...editPart, precio_oem: e.target.value })}
                  placeholder="Ej: $180.000"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 16, fontWeight: 700, border: '1px solid #0050a033', borderRadius: 8, background: 'var(--fw-bg, #fafafa)', color: '#003478', outline: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>

            {/* Stock */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--fw-textSecondary, #666)', display: 'block', marginBottom: 4 }}>Stock (unidades disponibles)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setEditPart({ ...editPart, stock: Math.max(0, (editPart.stock || 0) - 1), disponible: Math.max(0, (editPart.stock || 0) - 1) > 0 })}
                    style={{ width: 36, height: 36, border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 8, background: 'var(--fw-bg, #fafafa)', color: '#ef4444', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                  <input type="number" value={editPart.stock ?? 0} onChange={e => setEditPart({ ...editPart, stock: parseInt(e.target.value) || 0, disponible: (parseInt(e.target.value) || 0) > 0 })}
                    style={{ flex: 1, padding: '8px 12px', fontSize: 20, fontWeight: 700, border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 8, background: 'var(--fw-bg, #fafafa)', color: 'var(--fw-text, #333)', outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
                  <button onClick={() => setEditPart({ ...editPart, stock: (editPart.stock || 0) + 1, disponible: true })}
                    style={{ width: 36, height: 36, border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 8, background: 'var(--fw-bg, #fafafa)', color: '#22c55e', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--fw-textSecondary, #666)', display: 'block', marginBottom: 4 }}>Categoria</label>
                <input value={editPart.cat || ''} onChange={e => setEditPart({ ...editPart, cat: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 8, background: 'var(--fw-bg, #fafafa)', color: 'var(--fw-text, #333)', outline: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>

            {/* Status indicator */}
            <div style={{ padding: '8px 12px', background: (editPart.stock || 0) > 0 ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)', border: `1px solid ${(editPart.stock || 0) > 0 ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)'}`, borderRadius: 8, marginBottom: 16, textAlign: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: (editPart.stock || 0) > 0 ? '#22c55e' : '#ef4444' }}>
                {(editPart.stock || 0) > 0 ? `En stock — ${editPart.stock} unidades` : 'SIN STOCK — No disponible'}
              </span>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={savePart} style={{ flex: 1, padding: 12, fontSize: 14, fontWeight: 600, border: 'none', borderRadius: 10, background: '#003478', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                Guardar Cambios
              </button>
              <button onClick={() => setEditPart(null)} style={{ padding: '12px 20px', fontSize: 14, border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 10, background: 'transparent', color: 'var(--fw-textSecondary, #888)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
