import { useState, useEffect } from 'react';
import { authFetch } from './App.jsx';

const STATUS_FLOW = ['pendiente', 'pagado', 'preparando', 'listo', 'enviado', 'entregado'];

const STATUS_CONFIG = {
  pendiente:  { label: 'Pendiente',  color: '#eab308', bg: 'rgba(234,179,8,.12)', icon: '\u23F3' },
  pagado:     { label: 'Pagado',     color: '#3b82f6', bg: 'rgba(59,130,246,.12)', icon: '\uD83D\uDCB3' },
  preparando: { label: 'Preparando', color: '#f97316', bg: 'rgba(249,115,22,.12)', icon: '\uD83D\uDD27' },
  listo:      { label: 'Listo',      color: '#22c55e', bg: 'rgba(34,197,94,.12)', icon: '\u2705' },
  enviado:    { label: 'Enviado',    color: '#a855f7', bg: 'rgba(168,85,247,.12)', icon: '\uD83D\uDE9A' },
  entregado:  { label: 'Entregado',  color: '#6b7280', bg: 'rgba(107,114,128,.12)', icon: '\uD83C\uDFC1' },
  cancelado:  { label: 'Cancelado',  color: '#ef4444', bg: 'rgba(239,68,68,.12)', icon: '\u274C' },
};

const NEXT_ACTION_LABEL = {
  pendiente:  'Confirmar Pago',
  pagado:     'Empezar a Preparar',
  preparando: 'Marcar como Listo',
  listo:      'Marcar Enviado',
  listo_local: 'Marcar Entregado',
  enviado:    'Confirmar Entrega',
};

const TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'pagado', label: 'Pagados' },
  { key: 'preparando', label: 'Preparando' },
  { key: 'listo', label: 'Listos' },
  { key: 'enviado', label: 'Enviados' },
  { key: 'entregado', label: 'Entregados' },
];

export default function PedidosPanel({ theme, esJefe }) {
  const [pedidos, setPedidos] = useState([]);
  const [tab, setTab] = useState('todos');
  const [imgModal, setImgModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [encargados, setEncargados] = useState({});
  const [staffName] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      return u.nombre || u.name || 'Staff';
    } catch { return 'Staff'; }
  });

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

  const getNextStatus = (p) => {
    const st = p.estado;
    if (st === 'cancelado' || st === 'entregado') return null;
    if (st === 'listo') {
      return isEnvio(p) ? 'enviado' : 'entregado';
    }
    const idx = STATUS_FLOW.indexOf(st);
    if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[idx + 1];
  };

  const buildWhatsAppMsg = (p, newStatus) => {
    const clientName = p.cliente?.nombre || p.cliente_nombre || '';
    const orderNum = 'PED-' + String(p.numero || p.id || 0).padStart(4, '0');
    const statusLabel = STATUS_CONFIG[newStatus]?.label || newStatus;
    return `Hola ${clientName}! Tu pedido #${orderNum} cambio a *${statusLabel}*. La Ford de Warnes.`;
  };

  const openWhatsAppNotify = (p, newStatus) => {
    const phone = p.cliente?.telefono || p.telefono || '';
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const msg = encodeURIComponent(buildWhatsAppMsg(p, newStatus));
    window.open(`https://wa.me/54${cleanPhone}?text=${msg}`, '_blank');
  };

  const changeStatus = async (orderId, status, pedido) => {
    try {
      await authFetch('/api/pedidos/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status }),
      });
      if (pedido) {
        openWhatsAppNotify(pedido, status);
      }
      fetchPedidos();
    } catch (e) {
      console.error('Error updating status:', e);
    }
  };

  const claimOrder = async (p) => {
    const id = p._id || p.id;
    try {
      await authFetch('/api/pedidos/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, status: p.estado, encargado: staffName }),
      });
      setEncargados(prev => ({ ...prev, [id]: staffName }));
    } catch (e) {
      console.error('Error claiming order:', e);
    }
  };

  const openWhatsApp = (phone, pedido) => {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const statusLabel = STATUS_CONFIG[pedido.estado]?.label || pedido.estado;
    const msg = encodeURIComponent(
      `Hola! Tu pedido #${String(pedido.numero || pedido.id || '').padStart(4, '0')} ` +
      `tiene estado: *${statusLabel}*. Ford Warnes Repuestos.`
    );
    window.open(`https://wa.me/54${cleanPhone}?text=${msg}`, '_blank');
  };

  const pendingCount = pedidos.filter(p => p.estado === 'pendiente').length;
  const filtered = tab === 'todos' ? pedidos : pedidos.filter(p => p.estado === tab);

  const formatDate = (ts) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return ts; }
  };

  const formatOrderNum = (p) => 'PED-' + String(p.numero || p.id || 0).padStart(4, '0');
  const isEnvio = (p) => p.metodo_entrega === 'envio' || p.envio || p.direccion;

  // ── Status Stepper ──
  const renderStepper = (p) => {
    const currentIdx = STATUS_FLOW.indexOf(p.estado);
    const isCancelled = p.estado === 'cancelado';

    // For envio orders: show full flow. For local: skip "enviado"
    const flow = isEnvio(p)
      ? STATUS_FLOW
      : STATUS_FLOW.filter(s => s !== 'enviado');

    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0, width: '100%',
        padding: '8px 0', overflowX: 'auto',
      }}>
        {flow.map((status, i) => {
          const cfg = STATUS_CONFIG[status];
          const flowIdx = STATUS_FLOW.indexOf(status);
          const isActive = p.estado === status;
          const isPast = !isCancelled && currentIdx >= 0 && flowIdx < currentIdx;
          const isFuture = !isCancelled && currentIdx >= 0 && flowIdx > currentIdx;

          return (
            <div key={status} style={{ display: 'flex', alignItems: 'center', flex: i < flow.length - 1 ? 1 : 'none' }}>
              {/* Step circle */}
              <div style={{
                width: isActive ? 32 : 24,
                height: isActive ? 32 : 24,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isActive ? 14 : 11,
                fontWeight: 700,
                flexShrink: 0,
                background: isCancelled ? '#ef444420' : isActive ? cfg.color : isPast ? cfg.color + '30' : theme.card,
                color: isCancelled ? '#ef4444' : isActive ? '#fff' : isPast ? cfg.color : theme.textMuted,
                border: `2px solid ${isCancelled ? '#ef4444' : isActive ? cfg.color : isPast ? cfg.color + '60' : theme.cardBorder}`,
                transition: 'all .2s',
                position: 'relative',
              }}
                title={cfg.label}
              >
                {isPast ? '\u2713' : cfg.icon}
              </div>

              {/* Connector line */}
              {i < flow.length - 1 && (
                <div style={{
                  flex: 1, height: 3, minWidth: 12,
                  background: isPast && !isCancelled
                    ? `linear-gradient(90deg, ${cfg.color}80, ${STATUS_CONFIG[flow[i + 1]]?.color || '#ccc'}40)`
                    : theme.cardBorder + '60',
                  borderRadius: 2,
                  transition: 'all .2s',
                }} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Styles ──
  const isDark = theme.bg === '#000' || theme.bg === '#111' || theme.bg === '#0a0a0a' ||
    (theme.bg && theme.bg.toLowerCase() < '#333');

  const s = {
    container: {
      height: '100%', display: 'flex', flexDirection: 'column',
      background: theme.bg, color: theme.text,
    },
    header: {
      padding: '16px 20px', borderBottom: `1px solid ${theme.cardBorder}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
    },
    title: { fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' },
    badge: {
      background: '#eab308', color: '#000', borderRadius: 20,
      padding: '4px 14px', fontSize: 13, fontWeight: 700,
      animation: 'pulse 2s infinite',
    },
    tabs: {
      display: 'flex', gap: 4, padding: '10px 20px', overflowX: 'auto',
      borderBottom: `1px solid ${theme.cardBorder}`, flexShrink: 0,
    },
    tab: (active) => ({
      padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
      border: 'none', whiteSpace: 'nowrap',
      background: active ? theme.text : 'transparent',
      color: active ? theme.bg : theme.textSecondary,
      transition: 'all .15s',
    }),
    list: {
      flex: 1, overflowY: 'auto', padding: 20, display: 'flex',
      flexDirection: 'column', gap: 16,
    },
    card: {
      background: theme.card, border: `1px solid ${theme.cardBorder}`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: isDark ? '0 2px 8px rgba(0,0,0,.3)' : '0 2px 8px rgba(0,0,0,.06)',
    },
    cardHeader: (status) => ({
      padding: '14px 18px',
      borderBottom: `1px solid ${theme.cardBorder}`,
      background: (STATUS_CONFIG[status]?.color || '#666') + '08',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      flexWrap: 'wrap', gap: 8,
    }),
    cardBody: {
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14,
    },
    cardFooter: {
      padding: '12px 18px',
      borderTop: `1px solid ${theme.cardBorder}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 10,
      background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.015)',
    },
    orderNum: {
      fontWeight: 800, fontSize: 18, fontFamily: 'monospace', letterSpacing: '0.02em',
    },
    statusBadge: (status) => {
      const c = STATUS_CONFIG[status] || STATUS_CONFIG.pendiente;
      return {
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 12px', borderRadius: 20, fontSize: 12,
        fontWeight: 700, color: c.color, background: c.bg,
        border: `1.5px solid ${c.color}40`,
      };
    },
    clientRow: {
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    },
    clientName: { fontWeight: 700, fontSize: 15 },
    whatsappLink: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      color: '#25d366', textDecoration: 'none', fontWeight: 600, fontSize: 13,
      padding: '3px 10px', borderRadius: 6,
      background: '#25d36612', border: '1px solid #25d36630',
      transition: 'all .15s',
    },
    itemsTable: {
      width: '100%', fontSize: 13, borderCollapse: 'collapse',
      borderRadius: 8, overflow: 'hidden',
    },
    th: {
      textAlign: 'left', padding: '8px 10px', fontWeight: 700, fontSize: 11,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      color: theme.textMuted, background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
      borderBottom: `1px solid ${theme.cardBorder}`,
    },
    td: {
      padding: '7px 10px', borderBottom: `1px solid ${theme.cardBorder}22`,
    },
    comprobante: {
      width: 64, height: 64, objectFit: 'cover', borderRadius: 8, cursor: 'pointer',
      border: `2px solid ${theme.cardBorder}`, transition: 'transform .15s',
    },
    nextStepBtn: (color) => ({
      padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
      fontSize: 14, fontWeight: 700, color: '#fff', background: color,
      display: 'inline-flex', alignItems: 'center', gap: 8,
      boxShadow: `0 2px 8px ${color}40`,
      transition: 'all .15s',
      letterSpacing: '0.01em',
    }),
    claimBtn: {
      padding: '8px 18px', borderRadius: 8, border: '2px solid #3b82f6',
      cursor: 'pointer', fontSize: 13, fontWeight: 700,
      color: '#3b82f6', background: '#3b82f610',
      transition: 'all .15s',
    },
    claimedBadge: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      color: '#3b82f6', background: '#3b82f615', border: '1px solid #3b82f630',
    },
    cancelLink: {
      background: 'none', border: 'none', cursor: 'pointer',
      color: '#ef4444', fontSize: 12, fontWeight: 600,
      textDecoration: 'underline', textUnderlineOffset: '2px',
      padding: '4px 8px', transition: 'opacity .15s',
    },
    totalPrice: {
      fontWeight: 800, fontSize: 18, color: '#22c55e',
      fontFamily: 'monospace',
    },
    deliveryBadge: (isEnvio) => ({
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
      color: isEnvio ? '#a855f7' : '#f97316',
      background: isEnvio ? '#a855f710' : '#f9731610',
      border: `1px solid ${isEnvio ? '#a855f730' : '#f9731630'}`,
    }),
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    },
    overlayImg: { maxWidth: '90vw', maxHeight: '90vh', borderRadius: 10 },
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
        {TABS.map(t => {
          const count = t.key === 'todos'
            ? pedidos.length
            : pedidos.filter(p => p.estado === t.key).length;
          return (
            <button key={t.key} style={s.tab(tab === t.key)} onClick={() => setTab(t.key)}>
              {t.label} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div style={s.list}>
        {loading && (
          <div style={{ textAlign: 'center', color: theme.textMuted, padding: 60, fontSize: 15 }}>
            Cargando pedidos...
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: theme.textMuted, padding: 60, fontSize: 15 }}>
            No hay pedidos en esta categoria.
          </div>
        )}

        {filtered.map((p, idx) => {
          const id = p._id || p.id;
          const clientName = p.cliente?.nombre || p.cliente_nombre || 'Sin nombre';
          const clientPhone = p.cliente?.telefono || p.telefono || '';
          const items = p.items || p.productos || [];
          const total = p.total || items.reduce((sum, i) => sum + (i.precio || 0) * (i.qty || i.cantidad || 1), 0);
          const envio = isEnvio(p);
          const direccion = p.direccion || p.direccion_envio || '';
          const comprobante = p.comprobante || p.comprobante_url || '';
          const nextStatus = getNextStatus(p);
          const nextCfg = nextStatus ? STATUS_CONFIG[nextStatus] : null;
          const encargado = p.encargado || encargados[id];
          const isFinal = p.estado === 'entregado' || p.estado === 'cancelado';

          // Determine next action label
          let nextLabel = '';
          if (nextStatus) {
            if (p.estado === 'listo' && !envio) {
              nextLabel = NEXT_ACTION_LABEL['listo_local'];
            } else {
              nextLabel = NEXT_ACTION_LABEL[p.estado] || `Cambiar a ${nextCfg?.label}`;
            }
          }

          return (
            <div key={id || idx} style={s.card}>
              {/* Card Header: Order number + status badge + date */}
              <div style={s.cardHeader(p.estado)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={s.orderNum}>{formatOrderNum(p)}</span>
                  <span style={s.statusBadge(p.estado)}>
                    {STATUS_CONFIG[p.estado]?.icon} {STATUS_CONFIG[p.estado]?.label || p.estado}
                  </span>
                  {encargado && (
                    <span style={s.claimedBadge}>
                      {'\uD83D\uDC64'} {encargado}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500 }}>
                  {formatDate(p.createdAt || p.fecha || p.timestamp)}
                </span>
              </div>

              {/* Card Body */}
              <div style={s.cardBody}>
                {/* Progress stepper */}
                {!isFinal && renderStepper(p)}

                {/* Client info row */}
                <div style={s.clientRow}>
                  <span style={s.clientName}>{clientName}</span>
                  {clientPhone && (
                    <a
                      href={`https://wa.me/54${clientPhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={s.whatsappLink}
                    >
                      {'\uD83D\uDCF1'} {clientPhone}
                    </a>
                  )}
                </div>

                {/* Items table */}
                {items.length > 0 && (
                  <table style={s.itemsTable}>
                    <thead>
                      <tr>
                        <th style={s.th}>Producto</th>
                        <th style={s.th}>N. Parte</th>
                        <th style={{ ...s.th, textAlign: 'center' }}>Cant.</th>
                        <th style={{ ...s.th, textAlign: 'right' }}>Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={i}>
                          <td style={s.td}>{item.nombre || item.name || '-'}</td>
                          <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12, color: theme.textSecondary }}>
                            {item.numero_parte || item.part_number || '-'}
                          </td>
                          <td style={{ ...s.td, textAlign: 'center', fontWeight: 600 }}>
                            {item.qty || item.cantidad || 1}
                          </td>
                          <td style={{ ...s.td, textAlign: 'right', fontFamily: 'monospace' }}>
                            {item.precio ? `$${Number(item.precio).toLocaleString('es-AR')}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Total + delivery + comprobante row */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  flexWrap: 'wrap', gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={s.totalPrice}>
                      ${typeof total === 'number' ? total.toLocaleString('es-AR') : total}
                    </span>
                    <span style={s.deliveryBadge(envio)}>
                      {envio ? '\uD83D\uDE9A' : '\uD83C\uDFEA'}{' '}
                      {envio ? 'Envio' : 'Retira en local'}
                    </span>
                  </div>

                  {comprobante && (
                    <img
                      src={comprobante}
                      alt="Comprobante"
                      style={s.comprobante}
                      onClick={() => setImgModal(comprobante)}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    />
                  )}
                </div>

                {direccion && envio && (
                  <div style={{
                    fontSize: 13, color: theme.textSecondary, padding: '6px 10px',
                    background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
                    borderRadius: 6, borderLeft: '3px solid #a855f7',
                  }}>
                    {'\uD83D\uDCCD'} {direccion}
                  </div>
                )}
              </div>

              {/* Card Footer: main action + claim + cancel */}
              <div style={s.cardFooter}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Next step button */}
                  {nextStatus && (
                    <button
                      style={s.nextStepBtn(nextCfg.color)}
                      onClick={() => changeStatus(id, nextStatus, p)}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      {nextCfg.icon} {nextLabel}
                    </button>
                  )}

                  {/* Encargarme button */}
                  {!encargado && !isFinal && (
                    <button
                      style={s.claimBtn}
                      onClick={() => claimOrder(p)}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = '#3b82f6';
                        e.currentTarget.style.color = '#fff';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = '#3b82f610';
                        e.currentTarget.style.color = '#3b82f6';
                      }}
                    >
                      {'\uD83D\uDE4B'} Encargarme de este pedido
                    </button>
                  )}

                  {/* WhatsApp manual button */}
                  {(clientPhone) && (
                    <button
                      style={{
                        ...s.nextStepBtn('#25d366'),
                        padding: '8px 14px', fontSize: 13,
                        boxShadow: '0 2px 6px #25d36640',
                      }}
                      onClick={() => openWhatsApp(clientPhone, p)}
                    >
                      {'\uD83D\uDCAC'} WhatsApp
                    </button>
                  )}
                </div>

                {/* Cancel link */}
                {!isFinal && (
                  <button
                    style={s.cancelLink}
                    onClick={() => {
                      if (window.confirm('Cancelar este pedido?')) {
                        changeStatus(id, 'cancelado', p);
                      }
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    Cancelar pedido
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Image modal */}
      {imgModal && (
        <div style={s.overlay} onClick={() => setImgModal(null)}>
          <img
            src={imgModal}
            alt="Comprobante"
            style={s.overlayImg}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
