import { useState, useEffect } from 'react';
import { authFetch } from './App.jsx';

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

  const cardStyle = { background: 'var(--fw-card, #fff)', border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 10, padding: 18 };
  const labelStyle = { fontSize: 12, color: 'var(--fw-textSecondary, #888)', marginBottom: 4 };
  const valueStyle = { fontSize: 24, fontWeight: 800, color: 'var(--fw-text, #333)' };

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fw-text, #333)', marginBottom: 16 }}>Dashboard</h3>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Ventas hoy</div>
          <div style={valueStyle}>{sales.today.count}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>${(sales.today?.total ?? 0).toLocaleString('es-AR')}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Ventas esta semana</div>
          <div style={valueStyle}>{sales.week.count}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Busquedas populares</div>
          <div style={valueStyle}>{popular.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Clientes frecuentes</div>
          <div style={valueStyle}>{clients.length}</div>
        </div>
      </div>

      {/* Register sale */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#003478', marginBottom: 10 }}>Registrar venta</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={saleForm.client} onChange={e => setSaleForm({ ...saleForm, client: e.target.value })} placeholder="Cliente"
            style={{ flex: 1, minWidth: 120, padding: '8px 12px', fontSize: 13, border: '1px solid var(--fw-cardBorder, #ddd)', borderRadius: 8, background: 'var(--fw-inputBg, #fafafa)', color: 'var(--fw-text, #333)', outline: 'none', fontFamily: 'inherit' }} />
          <input value={saleForm.total} onChange={e => setSaleForm({ ...saleForm, total: e.target.value })} placeholder="Monto $" type="number"
            style={{ width: 100, padding: '8px 12px', fontSize: 13, border: '1px solid var(--fw-cardBorder, #ddd)', borderRadius: 8, background: 'var(--fw-inputBg, #fafafa)', color: 'var(--fw-text, #333)', outline: 'none', fontFamily: 'inherit' }} />
          <input value={saleForm.notes} onChange={e => setSaleForm({ ...saleForm, notes: e.target.value })} placeholder="Notas (opcional)"
            style={{ flex: 1, minWidth: 120, padding: '8px 12px', fontSize: 13, border: '1px solid var(--fw-cardBorder, #ddd)', borderRadius: 8, background: 'var(--fw-inputBg, #fafafa)', color: 'var(--fw-text, #333)', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={addSale} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 8, background: '#003478', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
            + Registrar
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {/* Popular searches */}
        <div style={cardStyle}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#003478', marginBottom: 10 }}>Mas buscado</div>
          {popular.length === 0 && <div style={{ color: 'var(--fw-textMuted, #999)', fontSize: 13 }}>Sin datos todavia</div>}
          {popular.slice(0, 10).map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--fw-cardBorder, #eee)' }}>
              <span style={{ fontSize: 13, color: 'var(--fw-text, #333)' }}>{p.term}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#003478' }}>{p.count}x</span>
            </div>
          ))}
        </div>

        {/* Frequent clients with notes */}
        <div style={cardStyle}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#003478', marginBottom: 10 }}>Clientes frecuentes</div>
          {clients.length === 0 && <div style={{ color: 'var(--fw-textMuted, #999)', fontSize: 13 }}>Sin datos todavia</div>}
          {clients.slice(0, 10).map((c, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--fw-cardBorder, #eee)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fw-text, #333)' }}>{c.name}</span>
                <span style={{ fontSize: 11, color: '#003478' }}>{c.count} compra{c.count !== 1 ? 's' : ''}</span>
              </div>
              {c.notes && <div style={{ fontSize: 11, color: 'var(--fw-textSecondary, #888)', marginTop: 2 }}>📝 {c.notes}</div>}
              {editNote === c.name ? (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Nota sobre este cliente..."
                    style={{ flex: 1, padding: '4px 8px', fontSize: 11, border: '1px solid var(--fw-cardBorder, #ddd)', borderRadius: 6, background: 'var(--fw-inputBg, #fafafa)', color: 'var(--fw-text, #333)', outline: 'none', fontFamily: 'inherit' }} />
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

        {/* Recent sales */}
        <div style={cardStyle}>
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
