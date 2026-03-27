import { useState, useRef } from 'react';

export default function AdminStock({ modelos, catalogo, onUpdatePart, onBulkPrice }) {
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
        const res = await fetch('/api/upload', {
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
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0b0f' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1c2030', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#e0deda', marginBottom: 10 }}>Gestionar Stock y Precios</div>
          {/* Category tabs */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            <button onClick={() => setCatFilter('all')} style={{ background: catFilter === 'all' ? '#003da5' : 'transparent', border: `1px solid ${catFilter === 'all' ? '#1a5cc8' : '#1c2030'}`, borderRadius: 7, padding: '4px 10px', fontSize: 11, color: catFilter === 'all' ? '#fff' : '#555870', cursor: 'pointer', fontFamily: 'inherit' }}>
              Todos ({modelos.length})
            </button>
            {categorias.map(c => {
              const count = modelos.filter(m => m.cat === c).length;
              return (
                <button key={c} onClick={() => setCatFilter(c)} style={{ background: catFilter === c ? '#003da5' : 'transparent', border: `1px solid ${catFilter === c ? '#1a5cc8' : '#1c2030'}`, borderRadius: 7, padding: '4px 10px', fontSize: 11, color: catFilter === c ? '#fff' : '#555870', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {c} ({count})
                </button>
              );
            })}
          </div>
          {/* Bulk price */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, background: '#0f1018', border: '1px solid #1c2030', borderRadius: 8, padding: '6px 10px' }}>
            <span style={{ fontSize: 11, color: '#666', flexShrink: 0 }}>Subir/bajar TODO:</span>
            <input value={bulkPct} onChange={e => setBulkPct(e.target.value)} placeholder="+15 o -10" type="number"
              style={{ width: 70, padding: '4px 8px', fontSize: 13, border: '1px solid #1c2030', borderRadius: 6, background: '#0a0b0f', color: '#fff', outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
            <span style={{ fontSize: 13, color: '#555870' }}>%</span>
            <button onClick={applyBulk} disabled={!bulkPct.trim()} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 6, background: bulkPct.trim() ? '#003da5' : '#1c1c22', color: '#fff', cursor: bulkPct.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              Aplicar
            </button>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar modelo..."
            style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #1c2030', borderRadius: 8, background: '#0f1018', color: '#e0deda', outline: 'none', fontFamily: 'inherit' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {categorias.filter(c => catFilter === 'all' || c === catFilter).map(cat => {
            const ms = searchedModelos.filter(m => m.cat === cat);
            if (!ms.length) return null;
            return (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6699ff', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #181c26' }}>{cat}</div>
                {ms.map(m => {
                  const parts = catalogo[m.id] || [];
                  const inStock = parts.filter(p => p.stock > 0).length;
                  const outStock = parts.filter(p => p.stock === 0).length;
                  return (
                    <div key={m.id} onClick={() => { setSelModelo(m); setSearch(''); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#0f1018', border: '1px solid #181c26', borderRadius: 10, marginBottom: 4, cursor: 'pointer', transition: 'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#12141e'} onMouseLeave={e => e.currentTarget.style.background = '#0f1018'}>
                      <div style={{ width: 50, height: 36, borderRadius: 6, overflow: 'hidden', background: m.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 16, opacity: .5 }}>🚗</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#e0deda' }}>{m.nombre}</div>
                        <div style={{ fontSize: 10, color: '#444860' }}>{m.año} · {parts.length} repuestos</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, color: '#22c55e' }}>{inStock} en stock</div>
                        {outStock > 0 && <div style={{ fontSize: 10, color: '#ef4444' }}>{outStock} agotados</div>}
                      </div>
                      <div style={{ color: '#333', fontSize: 14 }}>→</div>
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0b0f' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1c2030', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={() => setSelModelo(null)} style={{ background: 'none', border: 'none', color: '#6699ff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>← Volver</button>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#e0deda' }}>{selModelo.nombre}</span>
            <span style={{ fontSize: 12, color: '#444860', marginLeft: 8 }}>{selModelo.año} · {partsForModel.length} repuestos</span>
          </div>
        </div>
        {/* Bulk for this model */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, background: '#0f1018', border: '1px solid #1c2030', borderRadius: 8, padding: '6px 10px' }}>
          <span style={{ fontSize: 11, color: '#666', flexShrink: 0 }}>Precios {selModelo.nombre}:</span>
          <input value={bulkPct} onChange={e => setBulkPct(e.target.value)} placeholder="+15" type="number"
            style={{ width: 60, padding: '4px 8px', fontSize: 13, border: '1px solid #1c2030', borderRadius: 6, background: '#0a0b0f', color: '#fff', outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
          <span style={{ fontSize: 13, color: '#555870' }}>%</span>
          <button onClick={applyBulk} disabled={!bulkPct.trim()} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 6, background: bulkPct.trim() ? '#003da5' : '#1c1c22', color: '#fff', cursor: bulkPct.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
            Aplicar
          </button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar repuesto..."
          style={{ width: '100%', padding: '8px 12px', fontSize: 13, border: '1px solid #1c2030', borderRadius: 8, background: '#0f1018', color: '#e0deda', outline: 'none', fontFamily: 'inherit' }} />
      </div>

      {/* Parts list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {searchedParts.map((p, i) => (
          <div key={p.numero_parte || i} onClick={() => setEditPart({ ...p })}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#0f1018', border: '1px solid #181c26', borderRadius: 8, marginBottom: 3, cursor: 'pointer', transition: 'background .1s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#12141e'} onMouseLeave={e => e.currentTarget.style.background = '#0f1018'}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc(p.stock), flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
              <div style={{ fontSize: 10, color: '#444860' }}>{p.cat} · {p.numero_parte}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e0deda' }}>{p.precio}</div>
              {p.precio_oem && <div style={{ fontSize: 9, color: '#555870', textDecoration: 'line-through' }}>OEM {p.precio_oem}</div>}
            </div>
            <div style={{ fontSize: 11, color: sc(p.stock), minWidth: 30, textAlign: 'right' }}>{p.stock}</div>
            <div style={{ color: '#333', fontSize: 12 }}>✏️</div>
          </div>
        ))}
      </div>

      {/* ── EDIT MODAL ── */}
      {editPart && (
        <div onClick={() => setEditPart(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f1018', border: '1px solid #1c2030', borderRadius: 16, width: '100%', maxWidth: 480, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#e0deda', marginBottom: 4 }}>Editar Repuesto</div>
            <div style={{ fontSize: 12, color: '#444860', marginBottom: 16 }}>{editPart.numero_parte} · {selModelo.nombre}</div>

            {/* Photo */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Foto del repuesto</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {(editPart.img_custom) && <img src={editPart.img_custom} alt="" style={{ width: 64, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid #1c2030' }} />}
                <button onClick={() => fileRef.current?.click()} style={{ padding: '8px 14px', fontSize: 12, border: '1px solid #1c2030', borderRadius: 8, background: '#0a0b0f', color: '#6699ff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {editPart.img_custom ? 'Cambiar foto' : 'Subir foto'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
              </div>
            </div>

            {/* Name */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Nombre</label>
              <input value={editPart.nombre || ''} onChange={e => setEditPart({ ...editPart, nombre: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid #1c2030', borderRadius: 8, background: '#0a0b0f', color: '#fff', outline: 'none', fontFamily: 'inherit' }} />
            </div>

            {/* Prices side by side */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#22c55e', display: 'block', marginBottom: 4 }}>Precio Nuestro (lo que cobra Juan)</label>
                <input value={editPart.precio || ''} onChange={e => setEditPart({ ...editPart, precio: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 16, fontWeight: 700, border: '1px solid #22c55e33', borderRadius: 8, background: '#0a0b0f', color: '#22c55e', outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#6699ff', display: 'block', marginBottom: 4 }}>Precio OEM Ford (referencia)</label>
                <input value={editPart.precio_oem || ''} onChange={e => setEditPart({ ...editPart, precio_oem: e.target.value })}
                  placeholder="Ej: $180.000"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 16, fontWeight: 700, border: '1px solid #1a5cc833', borderRadius: 8, background: '#0a0b0f', color: '#6699ff', outline: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>

            {/* Stock */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Stock (unidades disponibles)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setEditPart({ ...editPart, stock: Math.max(0, (editPart.stock || 0) - 1), disponible: Math.max(0, (editPart.stock || 0) - 1) > 0 })}
                    style={{ width: 36, height: 36, border: '1px solid #1c2030', borderRadius: 8, background: '#0a0b0f', color: '#ef4444', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                  <input type="number" value={editPart.stock ?? 0} onChange={e => setEditPart({ ...editPart, stock: parseInt(e.target.value) || 0, disponible: (parseInt(e.target.value) || 0) > 0 })}
                    style={{ flex: 1, padding: '8px 12px', fontSize: 20, fontWeight: 700, border: '1px solid #1c2030', borderRadius: 8, background: '#0a0b0f', color: '#fff', outline: 'none', fontFamily: 'inherit', textAlign: 'center' }} />
                  <button onClick={() => setEditPart({ ...editPart, stock: (editPart.stock || 0) + 1, disponible: true })}
                    style={{ width: 36, height: 36, border: '1px solid #1c2030', borderRadius: 8, background: '#0a0b0f', color: '#22c55e', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 4 }}>Categoria</label>
                <input value={editPart.cat || ''} onChange={e => setEditPart({ ...editPart, cat: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid #1c2030', borderRadius: 8, background: '#0a0b0f', color: '#fff', outline: 'none', fontFamily: 'inherit' }} />
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
              <button onClick={savePart} style={{ flex: 1, padding: 12, fontSize: 14, fontWeight: 600, border: 'none', borderRadius: 10, background: '#003da5', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                Guardar Cambios
              </button>
              <button onClick={() => setEditPart(null)} style={{ padding: '12px 20px', fontSize: 14, border: '1px solid #1c2030', borderRadius: 10, background: 'transparent', color: '#555870', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
