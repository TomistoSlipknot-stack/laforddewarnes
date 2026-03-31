import { useState, useEffect } from 'react';
import { authFetch } from './App.jsx';

const STATUS_CONFIG = {
  pendiente:  { label: 'Pendiente',  color: '#eab308', bg: '#fefce8' },
  pagado:     { label: 'Pagado',     color: '#3b82f6', bg: '#eff6ff' },
  preparando: { label: 'Preparando', color: '#f97316', bg: '#fff7ed' },
  listo:      { label: 'Listo',      color: '#22c55e', bg: '#f0fdf4' },
  enviado:    { label: 'Enviado',    color: '#a855f7', bg: '#faf5ff' },
  entregado:  { label: 'Entregado',  color: '#6b7280', bg: '#f3f4f6' },
  cancelado:  { label: 'Cancelado',  color: '#ef4444', bg: '#fef2f2' },
};

const TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'pagado', label: 'Pagados' },
  { key: 'preparando', label: 'Preparando' },
  { key: 'enviado', label: 'Enviados' },
  { key: 'entregado', label: 'Entregados' },
];

export default function PedidosPanel({ theme, esJefe }) {
  const [pedidos, setPedidos] = useState([]);
  const [tab, setTab] = useState('todos');
  const [imgModal, setImgModal] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPedidos = async () => {
    try {
      const res = await authFetch('/api/pedidos');
      const data = await res.json();
      if (Array.isArray(data)) setPedidos(data);
      else if (Array.isArray(data.pedidos)) setPedidos(data.pedidos);
    } catch (e) {
      console.error('Error fetching pedidos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidos();
    const interval = setInterval(fetchPedidos, 15000);
    return () => clearInterval(interval);
  }, []);

  const changeStatus = async (orderId, status) => {
    try {
      await authFetch('/api/pedidos/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status }),
      });
      fetchPedidos();
    } catch (e) {
      console.error('Error updating status:', e);
    }
  };

  const openWhatsApp = (phone, pedido) => {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const statusLabel = STATUS_CONFIG[pedido.status]?.label || pedido.status;
    const msg = encodeURIComponent(
      `Hola! Tu pedido #${String(pedido.numero || pedido.id || '').padStart(4, '0')} ` +
      `tiene estado: *${statusLabel}*. Ford Warnes Repuestos.`
    );
    window.open(`https://wa.me/54${cleanPhone}?text=${msg}`, '_blank');
  };

  const pendingCount = pedidos.filter(p => p.status === 'pendiente').length;

  const filtered = tab === 'todos'
    ? pedidos
    : pedidos.filter(p => p.status === tab);

  const formatDate = (ts) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
  };

  const formatOrderNum = (p) => '#' + String(p.numero || p.id || 0).padStart(4, '0');

  const isEnvio = (p) => p.metodo_entrega === 'envio' || p.envio || p.direccion;

  // ── Styles ──
  const s = {
    container: {
      height: '100%', display: 'flex', flexDirection: 'column',
      background: theme.bg, color: theme.text,
    },
    header: {
      padding: '14px 18px', borderBottom: `1px solid ${theme.cardBorder}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
    },
    title: { fontWeight: 700, fontSize: 18 },
    badge: {
      background: '#eab308', color: '#000', borderRadius: 12,
      padding: '2px 10px', fontSize: 13, fontWeight: 600,
    },
    tabs: {
      display: 'flex', gap: 4, padding: '10px 18px', overflowX: 'auto',
      borderBottom: `1px solid ${theme.cardBorder}`, flexShrink: 0,
    },
    tab: (active) => ({
      padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
      border: 'none', whiteSpace: 'nowrap',
      background: active ? theme.text : 'transparent',
      color: active ? theme.bg : theme.textSecondary,
      transition: 'all .15s',
    }),
    list: {
      flex: 1, overflowY: 'auto', padding: 18, display: 'flex',
      flexDirection: 'column', gap: 14,
    },
    card: {
      background: theme.card, border: `1px solid ${theme.cardBorder}`,
      borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
    },
    cardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    statusBadge: (status) => {
      const c = STATUS_CONFIG[status] || STATUS_CONFIG.pendiente;
      return {
        display: 'inline-block', padding: '3px 10px', borderRadius: 8, fontSize: 12,
        fontWeight: 600, color: c.color, background: c.bg, border: `1px solid ${c.color}40`,
      };
    },
    btn: (bg, fg) => ({
      padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
      fontSize: 13, fontWeight: 600, background: bg, color: fg || '#fff',
      transition: 'opacity .15s',
    }),
    btnRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    itemsTable: { width: '100%', fontSize: 13, borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '4px 8px', color: theme.textMuted, fontWeight: 600, borderBottom: `1px solid ${theme.cardBorder}` },
    td: { padding: '4px 8px', borderBottom: `1px solid ${theme.cardBorder}22` },
    comprobante: {
      width: 60, height: 60, objectFit: 'cover', borderRadius: 6, cursor: 'pointer',
      border: `1px solid ${theme.cardBorder}`,
    },
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    },
    overlayImg: { maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 },
  };

  // ── Action buttons per status ──
  const renderActions = (p) => {
    const actions = [];
    const st = p.status;
    const id = p._id || p.id;

    if (st === 'pendiente') {
      actions.push(
        <button key="confirmar" style={s.btn('#3b82f6')} onClick={() => changeStatus(id, 'pagado')}>
          Confirmar Pago
        </button>
      );
    }
    if (st === 'pagado') {
      actions.push(
        <button key="preparando" style={s.btn('#f97316')} onClick={() => changeStatus(id, 'preparando')}>
          Preparando
        </button>
      );
    }
    if (st === 'preparando') {
      actions.push(
        <button key="listo" style={s.btn('#22c55e')} onClick={() => changeStatus(id, 'listo')}>
          Listo para entrega
        </button>
      );
    }
    if (st === 'listo') {
      if (isEnvio(p)) {
        actions.push(
          <button key="enviado" style={s.btn('#a855f7')} onClick={() => changeStatus(id, 'enviado')}>
            Enviado
          </button>
        );
      } else {
        actions.push(
          <button key="entregado" style={s.btn('#6b7280')} onClick={() => changeStatus(id, 'entregado')}>
            Entregado
          </button>
        );
      }
    }
    if (st === 'enviado') {
      actions.push(
        <button key="entregado" style={s.btn('#6b7280')} onClick={() => changeStatus(id, 'entregado')}>
          Entregado
        </button>
      );
    }

    // WhatsApp button
    if (p.telefono || p.cliente_telefono) {
      actions.push(
        <button key="wa" style={s.btn('#25d366')} onClick={() => openWhatsApp(p.telefono || p.cliente_telefono, p)}>
          WhatsApp
        </button>
      );
    }

    // Cancel - always available unless already cancelled/entregado
    if (st !== 'cancelado' && st !== 'entregado') {
      actions.push(
        <button key="cancelar" style={s.btn('#ef4444')} onClick={() => changeStatus(id, 'cancelado')}>
          Cancelar
        </button>
      );
    }

    return actions;
  };

  // ── Render ──
  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.title}>Pedidos</span>
        {pendingCount > 0 && (
          <span style={s.badge}>{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {TABS.map(t => (
          <button key={t.key} style={s.tab(tab === t.key)} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={s.list}>
        {loading && <div style={{ textAlign: 'center', color: theme.textMuted, padding: 40 }}>Cargando pedidos...</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: theme.textMuted, padding: 40 }}>No hay pedidos en esta categoria.</div>
        )}

        {filtered.map((p, idx) => {
          const clientName = p.cliente_nombre || p.nombre_cliente || p.cliente || 'Sin nombre';
          const clientPhone = p.telefono || p.cliente_telefono || '';
          const items = p.items || p.productos || [];
          const total = p.total || items.reduce((s, i) => s + (i.precio || 0) * (i.qty || i.cantidad || 1), 0);
          const envio = isEnvio(p);
          const direccion = p.direccion || p.direccion_envio || '';
          const comprobante = p.comprobante || p.comprobante_url || '';

          return (
            <div key={p._id || p.id || idx} style={s.card}>
              {/* Top row: order number + status + date */}
              <div style={s.cardRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{formatOrderNum(p)}</span>
                  <span style={s.statusBadge(p.status)}>{STATUS_CONFIG[p.status]?.label || p.status}</span>
                </div>
                <span style={{ fontSize: 12, color: theme.textMuted }}>{formatDate(p.createdAt || p.fecha || p.timestamp)}</span>
              </div>

              {/* Client info */}
              <div style={{ fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>{clientName}</span>
                {clientPhone && (
                  <>
                    {' \u2014 '}
                    <a
                      href={`https://wa.me/54${clientPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#25d366', textDecoration: 'none', fontWeight: 500 }}
                    >
                      {clientPhone}
                    </a>
                  </>
                )}
              </div>

              {/* Items */}
              {items.length > 0 && (
                <table style={s.itemsTable}>
                  <thead>
                    <tr>
                      <th style={s.th}>Producto</th>
                      <th style={s.th}>N. Parte</th>
                      <th style={{ ...s.th, textAlign: 'center' }}>Cant.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i}>
                        <td style={s.td}>{item.nombre || item.name || '-'}</td>
                        <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12 }}>{item.numero_parte || item.part_number || '-'}</td>
                        <td style={{ ...s.td, textAlign: 'center' }}>{item.qty || item.cantidad || 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Total + delivery */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#22c55e' }}>
                  ${typeof total === 'number' ? total.toLocaleString('es-AR') : total}
                </span>
                <span style={{ fontSize: 13, color: theme.textSecondary }}>
                  {envio ? (
                    <>{'\uD83D\uDE9A'} Env\u00EDo{direccion ? ` \u2014 ${direccion}` : ''}</>
                  ) : (
                    <>{'\uD83C\uDFEA'} Recoger en local</>
                  )}
                </span>
              </div>

              {/* Comprobante thumbnail */}
              {comprobante && (
                <div>
                  <img
                    src={comprobante}
                    alt="Comprobante"
                    style={s.comprobante}
                    onClick={() => setImgModal(comprobante)}
                  />
                </div>
              )}

              {/* Actions */}
              <div style={s.btnRow}>
                {renderActions(p)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Image modal */}
      {imgModal && (
        <div style={s.overlay} onClick={() => setImgModal(null)}>
          <img src={imgModal} alt="Comprobante" style={s.overlayImg} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
