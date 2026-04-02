import { useState, useEffect, useMemo } from 'react';
import { authFetch } from './App.jsx';

/* ---- tiny CSS-in-JS keyframes (injected once) ---- */
const ANIM_ID = 'admin-dash-anims';
if (typeof document !== 'undefined' && !document.getElementById(ANIM_ID)) {
  const style = document.createElement('style');
  style.id = ANIM_ID;
  style.textContent = `
    @keyframes adFadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes adPulse  { 0%,100%{ transform:scale(1); } 50%{ transform:scale(1.06); } }
    @keyframes adBarGrow { from { transform:scaleY(0); } to { transform:scaleY(1); } }
    .ad-card:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,.08) !important; }
  `;
  document.head.appendChild(style);
}

/* ---- SVG icon helpers (inline, no library) ---- */
const Icon = ({ d, color = 'currentColor', size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const icons = {
  sales:    'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  week:     'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z',
  search:   'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  clients:  'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  trophy:   'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 22V12M14 22V12M6 2h12v7a6 6 0 0 1-12 0V2z',
};

export default function AdminDashboard({ theme }) {
  const [sales, setSales] = useState({ today: { count: 0, total: 0 }, week: { count: 0 }, recent: [] });
  const [popular, setPopular] = useState([]);
  const [clients, setClients] = useState([]);
  const [editNote, setEditNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [saleForm, setSaleForm] = useState({ client: '', total: '', notes: '' });
  const t = theme || {};

  useEffect(() => {
    authFetch('/api/sales-history').then(r => r.json()).then(d => { if (d.today) setSales(d); }).catch(() => {});
    fetch('/api/popular-products').then(r => r.json()).then(d => setPopular(d.popular || [])).catch(() => {});
    authFetch('/api/frequent-clients').then(r => r.json()).then(d => { if (d.clients) setClients(d.clients); }).catch(() => {});
  }, []);

  const addSale = async () => {
    if (!saleForm.total) return;
    await authFetch('/api/sales-history', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName: saleForm.client || 'Cliente', total: parseInt(saleForm.total) || 0, notes: saleForm.notes }),
    });
    setSaleForm({ client: '', total: '', notes: '' });
    authFetch('/api/sales-history').then(r => r.json()).then(d => { if (d.today) setSales(d); });
    authFetch('/api/frequent-clients').then(r => r.json()).then(d => { if (d.clients) setClients(d.clients); });
  };

  const saveNote = async (name) => {
    await authFetch('/api/client-notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName: name, note: noteText }),
    });
    setEditNote(null);
    authFetch('/api/frequent-clients').then(r => r.json()).then(d => { if (d.clients) setClients(d.clients); });
  };

  /* ---- Last 7 days sales aggregation ---- */
  const last7Days = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
      days.push({ key, label, total: 0 });
    }
    (sales.recent || []).forEach(s => {
      const sKey = new Date(s.date).toISOString().slice(0, 10);
      const bucket = days.find(d => d.key === sKey);
      if (bucket) bucket.total += (s.total || 0);
    });
    return days;
  }, [sales.recent]);

  const chartMax = Math.max(...last7Days.map(d => d.total), 1);

  /* ---- Top selling products ---- */
  const topProducts = useMemo(() => {
    const map = {};
    (sales.recent || []).forEach(s => {
      const name = (s.notes || s.clientName || 'Sin detalle').trim();
      if (!name) return;
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [sales.recent]);

  /* ---- Export CSV ---- */
  const exportCSV = () => {
    const header = 'Fecha,Cliente,Total,Notas\n';
    const rows = (sales.recent || []).map(s => {
      const date = new Date(s.date).toLocaleDateString('es-AR');
      const client = (s.clientName || '').replace(/,/g, ' ');
      const notes = (s.notes || '').replace(/,/g, ' ').replace(/\n/g, ' ');
      return `${date},${client},${s.total || 0},${notes}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---- Styles ---- */
  const cardStyle = {
    background: 'var(--fw-card, #fff)',
    border: '1px solid var(--fw-cardBorder, #e0e0e0)',
    borderRadius: 12,
    padding: 20,
    transition: 'transform .2s, box-shadow .2s',
    animation: 'adFadeUp .4s ease both',
  };
  const labelStyle = { fontSize: 11, color: 'var(--fw-textSecondary, #888)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 };
  const valueStyle = { fontSize: 28, fontWeight: 800, color: 'var(--fw-text, #333)', lineHeight: 1.1 };
  const inputStyle = {
    flex: 1, minWidth: 120, padding: '8px 12px', fontSize: 13,
    border: '1px solid var(--fw-cardBorder, #ddd)', borderRadius: 8,
    background: 'var(--fw-inputBg, #fafafa)', color: 'var(--fw-text, #333)',
    outline: 'none', fontFamily: 'inherit',
  };
  const btnPrimary = {
    padding: '8px 18px', fontSize: 13, fontWeight: 700, border: 'none',
    borderRadius: 8, background: '#003478', color: '#fff', cursor: 'pointer',
    fontFamily: 'inherit', transition: 'background .2s',
  };

  const statCards = [
    { label: 'Ventas hoy', value: sales.today.count, sub: `$${(sales.today?.total ?? 0).toLocaleString('es-AR')}`, subColor: '#16a34a', icon: icons.sales, iconBg: '#e0f2fe', iconColor: '#003478' },
    { label: 'Ventas esta semana', value: sales.week.count, icon: icons.week, iconBg: '#fef3c7', iconColor: '#d97706' },
    { label: 'Busquedas populares', value: popular.length, icon: icons.search, iconBg: '#ede9fe', iconColor: '#7c3aed' },
    { label: 'Clientes frecuentes', value: clients.length, icon: icons.clients, iconBg: '#fce7f3', iconColor: '#db2777' },
  ];

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fw-text, #333)', margin: 0 }}>Dashboard</h3>
        <button onClick={exportCSV} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 6, background: '#16a34a' }}>
          <Icon d={icons.download} color="#fff" size={15} />
          Exportar Ventas
        </button>
      </div>

      {/* ---- Stats cards ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 22 }}>
        {statCards.map((c, i) => (
          <div key={i} className="ad-card" style={{ ...cardStyle, display: 'flex', gap: 14, alignItems: 'center', animationDelay: `${i * .07}s` }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon d={c.icon} color={c.iconColor} size={20} />
            </div>
            <div>
              <div style={labelStyle}>{c.label}</div>
              <div style={valueStyle}>{c.value}</div>
              {c.sub && <div style={{ fontSize: 13, fontWeight: 700, color: c.subColor, marginTop: 2 }}>{c.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* ---- Sales chart (last 7 days) ---- */}
      <div className="ad-card" style={{ ...cardStyle, marginBottom: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#003478', marginBottom: 14 }}>Ventas - Ultimos 7 dias</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
          {last7Days.map((d, i) => {
            const pct = d.total / chartMax;
            const barH = Math.max(pct * 120, d.total > 0 ? 6 : 2);
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fw-text, #333)' }}>
                  {d.total > 0 ? `$${d.total.toLocaleString('es-AR')}` : ''}
                </span>
                <div style={{
                  width: '100%', maxWidth: 40, height: barH, borderRadius: 4,
                  background: d.total > 0 ? '#003478' : 'var(--fw-cardBorder, #e0e0e0)',
                  transformOrigin: 'bottom', animation: 'adBarGrow .5s ease both',
                  animationDelay: `${i * .06}s`, transition: 'height .3s',
                }} />
                <span style={{ fontSize: 10, color: 'var(--fw-textSecondary, #888)' }}>{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Register sale ---- */}
      <div className="ad-card" style={{ ...cardStyle, marginBottom: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#003478', marginBottom: 10 }}>Registrar venta</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={saleForm.client} onChange={e => setSaleForm({ ...saleForm, client: e.target.value })} placeholder="Cliente" style={inputStyle} />
          <input value={saleForm.total} onChange={e => setSaleForm({ ...saleForm, total: e.target.value })} placeholder="Monto $" type="number" style={{ ...inputStyle, flex: 'none', width: 110 }} />
          <input value={saleForm.notes} onChange={e => setSaleForm({ ...saleForm, notes: e.target.value })} placeholder="Notas (opcional)" style={inputStyle} />
          <button onClick={addSale} style={btnPrimary}>+ Registrar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {/* ---- Top selling products ---- */}
        <div className="ad-card" style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Icon d={icons.trophy} color="#d97706" size={18} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#003478' }}>Productos mas vendidos</span>
          </div>
          {topProducts.length === 0 && <div style={{ color: 'var(--fw-textMuted, #999)', fontSize: 13 }}>Sin datos todavia</div>}
          {topProducts.map((p, i) => {
            const pct = topProducts.length > 0 ? (p.count / topProducts[0].count) * 100 : 0;
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 13, color: 'var(--fw-text, #333)', fontWeight: 500 }}>{p.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#003478' }}>{p.count}x</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--fw-cardBorder, #e8e8e8)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: 'linear-gradient(90deg, #003478, #0050b3)', transition: 'width .4s ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ---- Popular searches ---- */}
        <div className="ad-card" style={cardStyle}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#003478', marginBottom: 10 }}>Mas buscado</div>
          {popular.length === 0 && <div style={{ color: 'var(--fw-textMuted, #999)', fontSize: 13 }}>Sin datos todavia</div>}
          {popular.slice(0, 10).map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--fw-cardBorder, #eee)' }}>
              <span style={{ fontSize: 13, color: 'var(--fw-text, #333)' }}>{p.term}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#003478' }}>{p.count}x</span>
            </div>
          ))}
        </div>

        {/* ---- Frequent clients with notes ---- */}
        <div className="ad-card" style={cardStyle}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#003478', marginBottom: 10 }}>Clientes frecuentes</div>
          {clients.length === 0 && <div style={{ color: 'var(--fw-textMuted, #999)', fontSize: 13 }}>Sin datos todavia</div>}
          {clients.slice(0, 10).map((c, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--fw-cardBorder, #eee)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fw-text, #333)' }}>{c.name}</span>
                <span style={{ fontSize: 11, color: '#003478' }}>{c.count} compra{c.count !== 1 ? 's' : ''}</span>
              </div>
              {c.notes && <div style={{ fontSize: 11, color: 'var(--fw-textSecondary, #888)', marginTop: 2 }}>&#128221; {c.notes}</div>}
              {editNote === c.name ? (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Nota sobre este cliente..."
                    style={{ ...inputStyle, minWidth: 80, padding: '4px 8px', fontSize: 11, borderRadius: 6 }} />
                  <button onClick={() => saveNote(c.name)} style={{ fontSize: 10, padding: '4px 8px', background: '#003478', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>OK</button>
                  <button onClick={() => setEditNote(null)} style={{ fontSize: 10, padding: '4px 8px', background: 'transparent', color: 'var(--fw-textMuted, #999)', border: '1px solid var(--fw-cardBorder, #ddd)', borderRadius: 6, cursor: 'pointer' }}>X</button>
                </div>
              ) : (
                <button onClick={() => { setEditNote(c.name); setNoteText(c.notes || ''); }} style={{ fontSize: 10, color: '#003478', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}>
                  {c.notes ? 'Editar nota' : '+ Agregar nota'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* ---- Recent sales ---- */}
        <div className="ad-card" style={cardStyle}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#003478', marginBottom: 10 }}>Ultimas ventas</div>
          {sales.recent.length === 0 && <div style={{ color: 'var(--fw-textMuted, #999)', fontSize: 13 }}>Sin ventas registradas</div>}
          {sales.recent.slice(0, 10).map((s, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--fw-cardBorder, #eee)' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fw-text, #333)' }}>{s.clientName}</div>
                <div style={{ fontSize: 10, color: 'var(--fw-textMuted, #999)' }}>{new Date(s.date).toLocaleDateString('es-AR')}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>${s.total?.toLocaleString('es-AR')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
