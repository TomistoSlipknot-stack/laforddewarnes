import { useState, useMemo, useRef } from 'react';
import { authFetch } from './App.jsx';

const parsePrice = (p) => parseInt(String(p).replace(/\D/g, '')) || 0;

export default function EmpleadoVenta({ catalogo, modelos, theme, userName, onRegisterSale }) {
  const t = theme || {};
  const [query, setQuery] = useState('');
  const [pedido, setPedido] = useState([]);
  const [cliente, setCliente] = useState({ nombre: '', telefono: '', email: '', notas: '' });
  const [comprobante, setComprobante] = useState(null);
  const searchRef = useRef(null);

  // Build flat parts list
  const allParts = useMemo(() => {
    if (!catalogo || !modelos) return [];
    const list = [];
    for (const [modelId, parts] of Object.entries(catalogo)) {
      const modelo = modelos.find(m => m.id === modelId);
      for (const p of parts) {
        list.push({ ...p, modelo_id: modelId, modelo_nombre: modelo?.nombre || modelId });
      }
    }
    return list;
  }, [catalogo, modelos]);

  // Search results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allParts.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      (p.numero_parte && p.numero_parte.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [query, allParts]);

  // Add item to pedido
  function addItem(part) {
    setPedido(prev => {
      const existing = prev.find(i => i.numero_parte === part.numero_parte && i.modelo_id === part.modelo_id);
      if (existing) {
        return prev.map(i =>
          i.numero_parte === part.numero_parte && i.modelo_id === part.modelo_id
            ? { ...i, cantidad: i.cantidad + 1 }
            : i
        );
      }
      return [...prev, { ...part, cantidad: 1 }];
    });
    setQuery('');
    searchRef.current?.focus();
  }

  function updateQty(index, delta) {
    setPedido(prev => {
      const next = [...prev];
      next[index] = { ...next[index], cantidad: Math.max(1, next[index].cantidad + delta) };
      return next;
    });
  }

  function removeItem(index) {
    setPedido(prev => prev.filter((_, i) => i !== index));
  }

  const total = pedido.reduce((sum, i) => sum + parsePrice(i.precio) * i.cantidad, 0);

  // Generate comprobante
  function generarComprobante() {
    setComprobante({
      fecha: new Date().toLocaleString('es-AR'),
      items: [...pedido],
      total,
      cliente: { ...cliente },
      empleado: userName || 'Empleado',
    });
  }

  // WhatsApp message
  function enviarWhatsApp() {
    const lines = [
      '*La Ford de Warnes - Comprobante*',
      `Fecha: ${new Date().toLocaleString('es-AR')}`,
      '',
      ...pedido.map((item, i) =>
        `${i + 1}. ${item.nombre} (${item.numero_parte}) x${item.cantidad} — $${(parsePrice(item.precio) * item.cantidad).toLocaleString('es-AR')}`
      ),
      '',
      `*Total: $${total.toLocaleString('es-AR')}*`,
      '',
      '*Datos de pago:*',
      'Alias: laforddewarnes',
      'CBU: (a confirmar)',
      '',
      `Atendido por: ${userName || 'Empleado'}`,
    ];
    if (cliente.nombre) lines.splice(2, 0, `Cliente: ${cliente.nombre}`);
    const text = encodeURIComponent(lines.join('\n'));
    const phone = cliente.telefono ? cliente.telefono.replace(/\D/g, '') : '';
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  }

  function registrarVenta() {
    if (onRegisterSale) {
      onRegisterSale({
        items: pedido,
        total,
        cliente,
        empleado: userName,
        fecha: new Date().toISOString(),
      });
    }
  }

  function limpiarPedido() {
    setPedido([]);
    setCliente({ nombre: '', telefono: '', email: '', notas: '' });
    setComprobante(null);
  }

  // ---- Styles ----
  const card = {
    background: t.card || '#fff',
    border: `1px solid ${t.cardBorder || '#e0e0e0'}`,
    borderRadius: 14,
    padding: '20px 24px',
    marginBottom: 16,
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    fontSize: 16,
    fontFamily: 'inherit',
    border: `2px solid ${t.cardBorder || '#e0e0e0'}`,
    borderRadius: 12,
    background: t.inputBg || t.card || '#fafafa',
    color: t.text || '#333',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color .15s',
  };

  const btnPrimary = {
    padding: '16px 28px',
    fontSize: 16,
    fontWeight: 700,
    fontFamily: 'inherit',
    border: 'none',
    borderRadius: 12,
    background: t.accent || '#003478',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all .15s',
    touchAction: 'manipulation',
    minHeight: 52,
  };

  const btnSecondary = {
    ...btnPrimary,
    background: '#25d366',
  };

  const btnOutline = {
    ...btnPrimary,
    background: 'transparent',
    border: `2px solid ${t.cardBorder || '#e0e0e0'}`,
    color: t.text || '#333',
  };

  const btnDanger = {
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    border: 'none',
    borderRadius: 8,
    background: 'rgba(220,38,38,.1)',
    color: '#dc2626',
    cursor: 'pointer',
    transition: 'all .15s',
    touchAction: 'manipulation',
  };

  const qtyBtn = {
    width: 40,
    height: 40,
    fontSize: 20,
    fontWeight: 700,
    fontFamily: 'inherit',
    border: `2px solid ${t.cardBorder || '#e0e0e0'}`,
    borderRadius: 10,
    background: t.card || '#fff',
    color: t.text || '#333',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'manipulation',
    transition: 'all .12s',
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px', fontFamily: "'Inter',system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text || '#333', margin: 0 }}>
            Punto de Venta
          </h1>
          <div style={{ fontSize: 13, color: t.textSecondary || '#777', marginTop: 2 }}>
            {userName ? `Vendedor: ${userName}` : 'La Ford de Warnes'}
          </div>
        </div>
        {pedido.length > 0 && (
          <button onClick={limpiarPedido} style={btnDanger}>
            Limpiar pedido
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ ...card, position: 'relative', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.textMuted || '#999'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder="Buscar repuesto por nombre o N\u00BA de parte..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ ...inputStyle, border: 'none', padding: '12px 4px', background: 'transparent' }}
          />
        </div>

        {/* Results dropdown */}
        {results.length > 0 && (
          <div style={{
            position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 50,
            background: t.card || '#fff', border: `1px solid ${t.cardBorder || '#e0e0e0'}`,
            borderRadius: '0 0 14px 14px', boxShadow: t.shadowHover || '0 4px 16px rgba(0,0,0,.08)',
            maxHeight: 360, overflowY: 'auto',
          }}>
            {results.map((p, idx) => (
              <button
                key={`${p.modelo_id}-${p.numero_parte}-${idx}`}
                onClick={() => addItem(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '14px 20px', border: 'none', borderBottom: `1px solid ${t.cardBorder || '#e0e0e0'}`,
                  background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'inherit', transition: 'background .1s', color: t.text || '#333',
                }}
                onMouseEnter={e => e.currentTarget.style.background = t.accentLight || 'rgba(0,52,120,.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{p.nombre}</div>
                  <div style={{ fontSize: 12, color: t.textSecondary || '#777', marginTop: 2 }}>
                    {p.numero_parte} &middot; {p.modelo_nombre}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.accent || '#003478' }}>
                    ${(p.precio || 0).toLocaleString('es-AR')}
                  </div>
                  <div style={{ fontSize: 11, color: p.stock > 0 ? '#16a34a' : '#dc2626', fontWeight: 600, marginTop: 2 }}>
                    {p.stock > 0 ? `Stock: ${p.stock}` : 'Sin stock'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div style={{ padding: '12px 0 4px', fontSize: 13, color: t.textMuted || '#999' }}>
            No se encontraron resultados para "{query}"
          </div>
        )}
      </div>

      {/* Pedido (Order) */}
      <div style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: t.text || '#333', margin: '0 0 16px' }}>
          Pedido actual
          {pedido.length > 0 && (
            <span style={{ fontSize: 13, fontWeight: 500, color: t.textSecondary || '#777', marginLeft: 10 }}>
              ({pedido.length} {pedido.length === 1 ? 'item' : 'items'})
            </span>
          )}
        </h2>

        {pedido.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: t.textMuted || '#999', fontSize: 14 }}>
            Busca un repuesto arriba para agregarlo al pedido
          </div>
        ) : (
          <>
            {pedido.map((item, idx) => (
              <div
                key={`${item.modelo_id}-${item.numero_parte}-${idx}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0',
                  borderBottom: idx < pedido.length - 1 ? `1px solid ${t.cardBorder || '#e0e0e0'}` : 'none',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t.text || '#333' }}>{item.nombre}</div>
                  <div style={{ fontSize: 12, color: t.textSecondary || '#777', marginTop: 2 }}>
                    {item.numero_parte} &middot; {item.modelo_nombre}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => updateQty(idx, -1)} style={qtyBtn}>−</button>
                  <span style={{ minWidth: 32, textAlign: 'center', fontSize: 16, fontWeight: 700, color: t.text || '#333' }}>
                    {item.cantidad}
                  </span>
                  <button onClick={() => updateQty(idx, 1)} style={qtyBtn}>+</button>
                </div>
                <div style={{ width: 90, textAlign: 'right', fontSize: 15, fontWeight: 700, color: t.text || '#333', flexShrink: 0 }}>
                  ${(parsePrice(item.precio) * item.cantidad).toLocaleString('es-AR')}
                </div>
                <button onClick={() => removeItem(idx)} style={btnDanger} title="Quitar">
                  &times;
                </button>
              </div>
            ))}

            {/* Total */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
              padding: '18px 0 4px', gap: 16,
            }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: t.textSecondary || '#777' }}>Total:</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: t.accent || '#003478' }}>
                ${total.toLocaleString('es-AR')}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Client info */}
      {pedido.length > 0 && (
        <div style={card}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: t.text || '#333', margin: '0 0 16px' }}>
            Datos del cliente
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary || '#777', marginBottom: 6 }}>
                Nombre *
              </label>
              <input
                type="text"
                placeholder="Nombre del cliente"
                value={cliente.nombre}
                onChange={e => setCliente(c => ({ ...c, nombre: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary || '#777', marginBottom: 6 }}>
                Tel\u00E9fono / WhatsApp *
              </label>
              <input
                type="tel"
                placeholder="Ej: 5491112345678"
                value={cliente.telefono}
                onChange={e => setCliente(c => ({ ...c, telefono: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary || '#777', marginBottom: 6 }}>
                Email (opcional)
              </label>
              <input
                type="email"
                placeholder="email@ejemplo.com"
                value={cliente.email}
                onChange={e => setCliente(c => ({ ...c, email: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: t.textSecondary || '#777', marginBottom: 6 }}>
                Notas
              </label>
              <input
                type="text"
                placeholder="Observaciones..."
                value={cliente.notas}
                onChange={e => setCliente(c => ({ ...c, notas: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {pedido.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={generarComprobante} style={btnPrimary}>
            Generar Comprobante
          </button>
          <button onClick={enviarWhatsApp} style={btnSecondary}>
            Enviar por WhatsApp
          </button>
          <button
            onClick={registrarVenta}
            style={{ ...btnOutline, borderColor: '#16a34a', color: '#16a34a', fontWeight: 700 }}
          >
            Registrar Venta
          </button>
        </div>
      )}

      {/* Comprobante (Receipt) */}
      {comprobante && (
        <div style={{
          background: t.card || '#fff',
          border: `2px solid ${t.cardBorder || '#e0e0e0'}`,
          borderRadius: 14,
          padding: '28px 28px 24px',
          marginBottom: 20,
          fontFamily: "'Courier New', monospace",
          maxWidth: 520,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '.02em', color: t.text || '#333' }}>
              LA FORD DE WARNES
            </div>
            <div style={{ fontSize: 12, color: t.textSecondary || '#777', marginTop: 4 }}>
              Repuestos Ford &mdash; Buenos Aires
            </div>
            <div style={{
              width: '100%', height: 1,
              background: t.cardBorder || '#e0e0e0',
              margin: '12px 0',
            }} />
            <div style={{ fontSize: 12, color: t.textMuted || '#999' }}>
              {comprobante.fecha}
            </div>
          </div>

          {comprobante.cliente.nombre && (
            <div style={{ fontSize: 13, color: t.text || '#333', marginBottom: 4 }}>
              Cliente: {comprobante.cliente.nombre}
            </div>
          )}
          {comprobante.cliente.telefono && (
            <div style={{ fontSize: 13, color: t.text || '#333', marginBottom: 8 }}>
              Tel: {comprobante.cliente.telefono}
            </div>
          )}

          <div style={{ width: '100%', height: 1, background: t.cardBorder || '#e0e0e0', margin: '8px 0 12px' }} />

          {comprobante.items.map((item, idx) => (
            <div key={idx} style={{
              display: 'flex', justifyContent: 'space-between', fontSize: 13,
              color: t.text || '#333', padding: '4px 0',
            }}>
              <span>{item.cantidad}x {item.nombre}</span>
              <span style={{ fontWeight: 700 }}>${(parsePrice(item.precio) * item.cantidad).toLocaleString('es-AR')}</span>
            </div>
          ))}

          <div style={{ width: '100%', height: 2, background: t.text || '#333', margin: '12px 0 8px' }} />

          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 18, fontWeight: 800, color: t.text || '#333',
          }}>
            <span>TOTAL</span>
            <span>${comprobante.total.toLocaleString('es-AR')}</span>
          </div>

          <div style={{ width: '100%', height: 1, background: t.cardBorder || '#e0e0e0', margin: '12px 0' }} />

          <div style={{ fontSize: 12, color: t.textSecondary || '#777', lineHeight: 1.7 }}>
            <div><strong>Alias MercadoPago:</strong> laforddewarnes</div>
            <div><strong>CBU:</strong> (a confirmar)</div>
          </div>

          <div style={{ width: '100%', height: 1, background: t.cardBorder || '#e0e0e0', margin: '12px 0' }} />

          <div style={{ textAlign: 'center', fontSize: 11, color: t.textMuted || '#999' }}>
            Atendido por: {comprobante.empleado}
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: t.textMuted || '#999', marginTop: 4 }}>
            Gracias por su compra
          </div>
        </div>
      )}
    </div>
  );
}
