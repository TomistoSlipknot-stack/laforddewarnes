import { generatePresupuesto } from "./GeneratePDF.jsx";
import { useState } from 'react';

export default function Cart({ items, onRemove, onClear, onConsultar, onCheckout, theme }) {
  const [open, setOpen] = useState(false);
  const t = theme || {};
  const total = items.reduce((sum, item) => {
    const num = parseInt(String(item.precio).replace(/\D/g, ''));
    return sum + (num || 0);
  }, 0);

  if (items.length === 0 && !open) return null;

  return (
    <>
      {/* Floating cart button */}
      <button onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 90, right: 20, zIndex: 998,
          background: '#003478', color: '#fff', border: 'none',
          borderRadius: '50%', width: 56, height: 56, cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,.2)', transition: 'transform .2s',
        }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
        <span style={{ fontSize: 8, fontWeight: 800, marginTop: 1 }}>{items.length}</span>
        {items.length > 0 && (
          <div style={{ position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11, background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, border: '2px solid #fff' }}>
            {items.length}
          </div>
        )}
      </button>

      {/* Cart panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 155, right: 20, width: 360, maxHeight: '60vh',
          background: t.card || '#fff', border: `1px solid ${t.cardBorder || '#e0e0e0'}`,
          borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,.15)', zIndex: 999,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.cardBorder || '#e0e0e0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: t.text || '#333' }}>
              Mi Lista ({items.length})
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>

          {/* Items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
            {items.length === 0 && (
              <div style={{ textAlign: 'center', color: '#999', padding: 30, fontSize: 13 }}>
                Tu lista esta vacia. Agrega productos desde el catalogo.
              </div>
            )}
            {items.map((item, i) => (
              <div key={item.numero_parte || i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                borderBottom: i < items.length - 1 ? `1px solid ${t.cardBorder || '#eee'}` : 'none',
              }}>
                {item.foto && <img src={item.foto} alt="" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 4, background: '#f5f5f5' }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text || '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</div>
                  <div style={{ fontSize: 10, color: t.textSecondary || '#888' }}>{item.numero_parte} · {item.modelo_nombre}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text || '#333' }}>{item.precio}</div>
                </div>
                <button onClick={() => onRemove(item.numero_parte)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14, padding: 4 }}>✕</button>
              </div>
            ))}
          </div>

          {/* Footer with total + actions */}
          {items.length > 0 && (
            <div style={{ padding: '12px 18px', borderTop: `1px solid ${t.cardBorder || '#e0e0e0'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.text || '#333' }}>Total estimado:</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: t.text || '#333' }}>
                  ${total.toLocaleString('es-AR')}
                </span>
              </div>
              {/* Main action: Realizar Pedido */}
              {onCheckout && <button onClick={() => { onCheckout(); setOpen(false); }}
                style={{ width: '100%', padding: 14, fontSize: 15, fontWeight: 800, border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, #003478, #0055b0)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>
                Realizar Pedido y Pagar
              </button>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => {
                  const msg = 'Hola! Quiero consultar por estos productos:\n' +
                    items.map(it => '- ' + it.nombre + ' (N° ' + it.numero_parte + ') ' + it.precio).join('\n') +
                    '\nTotal estimado: $' + total.toLocaleString('es-AR');
                  onConsultar(msg);
                  setOpen(false);
                }}
                  style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 8, background: '#003478', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Consultar todo
                </button>
                <a href={`https://wa.me/5491162756333?text=${encodeURIComponent(
                  'Hola La Ford de Warnes! Quiero consultar por:\n' +
                  items.map(it => '- ' + it.nombre + ' (' + it.numero_parte + ') ' + it.precio).join('\n') +
                  '\nTotal: $' + total.toLocaleString('es-AR')
                )}`} target="_blank" rel="noopener noreferrer"
                  style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 8, background: '#25d366', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                  WhatsApp
                </a>
                <button onClick={() => generatePresupuesto(items, "")}
                  style={{ padding: "10px 12px", fontSize: 12, border: "1px solid #003478", borderRadius: 8, background: "transparent", color: "#003478", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                  PDF
                </button>
                <button onClick={onClear}
                  style={{ padding: '10px 12px', fontSize: 12, border: `1px solid ${t.cardBorder || '#ddd'}`, borderRadius: 8, background: 'transparent', color: '#999', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Vaciar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
