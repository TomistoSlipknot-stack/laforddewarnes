import { useState, useRef, useEffect, useMemo } from 'react';
import { authFetch } from './App.jsx';

const EJEMPLOS_EMPLEADO = [
  { cmd: 'filtro aceite ranger', desc: 'Buscar pieza por nombre y modelo' },
  { cmd: 'EB3G-6714-BA', desc: 'Buscar por numero de pieza' },
  { cmd: 'stock ranger', desc: 'Ver stock de un modelo' },
  { cmd: 'precio pastillas freno', desc: 'Ver precio de una pieza' },
  { cmd: 'venta Carlos 45000 filtro aceite', desc: 'Registrar venta rapida' },
];

const EJEMPLOS_JEFE = [
  ...EJEMPLOS_EMPLEADO,
  { cmd: 'crear empleado Pedro pedro1234', desc: 'Crear cuenta de empleado' },
  { cmd: 'ventas hoy', desc: 'Ver ventas del dia' },
  { cmd: 'subir precios 10% ranger', desc: 'Subir precios 10% a un modelo' },
  { cmd: 'empleados', desc: 'Ver lista de empleados' },
];

export default function BuscadorIA({ catalogo, modelos, theme, userName, esJefe, network, onRegisterSale }) {
  const t = theme || {};
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Welcome message
  useEffect(() => {
    setMessages([{
      id: 0, from: 'bot',
      text: `Hola ${userName || 'crack'}! Soy el asistente de La Ford de Warnes.\n\nEscribi lo que necesites y te ayudo. Puedo buscar piezas, ver precios, registrar ventas y mas.\n\nEjemplos:\n${(esJefe ? EJEMPLOS_JEFE : EJEMPLOS_EMPLEADO).map(e => '  "' + e.cmd + '" → ' + e.desc).join('\n')}`
    }]);
  }, []);

  // Flatten all parts
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

  const addMsg = (from, text) => setMessages(prev => [...prev, { id: Date.now() + Math.random(), from, text }]);
  const addResult = (text, items) => setMessages(prev => [...prev, { id: Date.now() + Math.random(), from: 'bot', text, items }]);

  const parsePrice = (p) => parseInt(String(p).replace(/\D/g, '')) || 0;

  const processCommand = async (raw) => {
    const q = raw.trim().toLowerCase();
    if (!q) return;

    addMsg('user', raw.trim());
    setTyping(true);

    await new Promise(r => setTimeout(r, 300 + Math.random() * 400));

    // ── VENTA RAPIDA ──
    const ventaMatch = q.match(/^venta\s+(.+?)\s+(\d[\d.]*)\s*(.*)?$/i);
    if (ventaMatch) {
      const cliente = ventaMatch[1].trim();
      const monto = parseInt(ventaMatch[2].replace(/\./g, ''));
      const notas = ventaMatch[3] || '';
      try {
        await authFetch('/api/sales-history', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientName: cliente, total: monto, notes: `${notas}. Via asistente. Atendido por ${userName}`.trim() }),
        });
        addMsg('bot', `Venta registrada!\n\nCliente: ${cliente}\nMonto: $${monto.toLocaleString('es-AR')}\n${notas ? 'Notas: ' + notas + '\n' : ''}\nEl jefe la va a ver en su Dashboard.`);
      } catch { addMsg('bot', 'Error al registrar la venta. Intenta de nuevo.'); }
      setTyping(false);
      return;
    }

    // ── VENTAS HOY ──
    if (q.includes('ventas hoy') || q.includes('ventas del dia') || q === 'ventas') {
      try {
        const res = await authFetch('/api/sales-history');
        const data = await res.json();
        const today = new Date().toDateString();
        const todaySales = (data.recent || []).filter(s => new Date(s.date).toDateString() === today);
        const total = todaySales.reduce((s, v) => s + (v.total || 0), 0);
        addMsg('bot', todaySales.length > 0
          ? `Ventas de hoy: ${todaySales.length}\nTotal: $${total.toLocaleString('es-AR')}\n\n${todaySales.map(s => '  ' + (s.clientName || 'Anonimo') + ' → $' + (s.total || 0).toLocaleString('es-AR')).join('\n')}`
          : 'No hay ventas registradas hoy.'
        );
      } catch { addMsg('bot', 'No pude obtener las ventas. Intenta de nuevo.'); }
      setTyping(false);
      return;
    }

    // ── CREAR EMPLEADO (jefe only) ──
    if (esJefe && q.startsWith('crear empleado')) {
      const parts = raw.trim().split(/\s+/).slice(2);
      if (parts.length < 2) {
        addMsg('bot', 'Formato: "crear empleado [nombre] [contrasena]"\nEj: "crear empleado Pedro pedro1234"');
        setTyping(false); return;
      }
      const nombre = parts[0];
      const pass = parts[1];
      try {
        const res = await authFetch('/api/accounts/employee', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nombre, user: nombre.toLowerCase(), pass }),
        });
        const data = await res.json();
        addMsg('bot', data.ok
          ? `Empleado creado!\n\nNombre: ${nombre}\nUsuario: ${nombre.toLowerCase()}\nContrasena: ${pass}\n\nYa puede iniciar sesion.`
          : 'Error: ' + (data.error || 'No se pudo crear')
        );
      } catch { addMsg('bot', 'Error de conexion. Intenta de nuevo.'); }
      setTyping(false);
      return;
    }

    // ── LISTA EMPLEADOS (jefe only) ──
    if (esJefe && (q === 'empleados' || q === 'lista empleados' || q.includes('ver empleados'))) {
      try {
        const res = await authFetch('/api/accounts');
        const data = await res.json();
        const emps = data.employees || [];
        addMsg('bot', emps.length > 0
          ? `Empleados (${emps.length}):\n\n${emps.map(e => '  ' + e.name + ' (@' + e.user + ')').join('\n')}`
          : 'No hay empleados creados.'
        );
      } catch { addMsg('bot', 'Error al obtener empleados.'); }
      setTyping(false);
      return;
    }

    // ── SUBIR PRECIOS (jefe only) ──
    if (esJefe && q.match(/subir precios?\s+(\d+)%?\s*(.*)?/i)) {
      const m = q.match(/subir precios?\s+(\d+)%?\s*(.*)?/i);
      const pct = parseInt(m[1]);
      const modeloQ = m[2]?.trim();
      let count = 0;
      const targets = modeloQ
        ? Object.entries(catalogo).filter(([id]) => id.includes(modeloQ) || (modelos.find(mm => mm.id === id)?.nombre || '').toLowerCase().includes(modeloQ))
        : Object.entries(catalogo);
      for (const [, parts] of targets) {
        for (const p of parts) {
          const num = parsePrice(p.precio);
          if (num) { p.precio = '$' + Math.round(num * (1 + pct / 100)).toLocaleString('es-AR'); count++; }
        }
      }
      addMsg('bot', `Precios subidos ${pct}%${modeloQ ? ' para ' + modeloQ : ''}\n${count} piezas actualizadas.\n\nLos cambios se ven en el catalogo y en Stock.`);
      setTyping(false);
      return;
    }

    // ── BAJAR PRECIOS (jefe only) ──
    if (esJefe && q.match(/bajar precios?\s+(\d+)%?\s*(.*)?/i)) {
      const m = q.match(/bajar precios?\s+(\d+)%?\s*(.*)?/i);
      const pct = parseInt(m[1]);
      const modeloQ = m[2]?.trim();
      let count = 0;
      const targets = modeloQ
        ? Object.entries(catalogo).filter(([id]) => id.includes(modeloQ) || (modelos.find(mm => mm.id === id)?.nombre || '').toLowerCase().includes(modeloQ))
        : Object.entries(catalogo);
      for (const [, parts] of targets) {
        for (const p of parts) {
          const num = parsePrice(p.precio);
          if (num) { p.precio = '$' + Math.round(num * (1 - pct / 100)).toLocaleString('es-AR'); count++; }
        }
      }
      addMsg('bot', `Precios bajados ${pct}%${modeloQ ? ' para ' + modeloQ : ''}\n${count} piezas actualizadas.\n\nLos cambios se ven en el catalogo y en Stock.`);
      setTyping(false);
      return;
    }

    // ── STOCK DE MODELO ──
    if (q.startsWith('stock ')) {
      const modeloQ = q.replace('stock ', '').trim();
      const modelo = modelos.find(m => m.nombre.toLowerCase().includes(modeloQ) || m.id.includes(modeloQ));
      if (modelo) {
        const parts = catalogo[modelo.id] || [];
        const inStock = parts.filter(p => p.stock > 0);
        addMsg('bot', `Stock de ${modelo.nombre} (${modelo.año}):\n\nTotal piezas: ${parts.length}\nEn stock: ${inStock.length}\n${inStock.length > 0 ? '\nPiezas disponibles:\n' + inStock.slice(0, 15).map(p => '  ' + p.nombre + ' → ' + p.stock + ' unid. (' + p.precio + ')').join('\n') + (inStock.length > 15 ? '\n  ...y ' + (inStock.length - 15) + ' mas' : '') : '\nNo hay piezas en stock para este modelo.'}`);
      } else {
        addMsg('bot', `No encontre el modelo "${modeloQ}". Proba con: ${modelos.slice(0, 8).map(m => m.nombre).join(', ')}...`);
      }
      setTyping(false);
      return;
    }

    // ── BUSCAR PIEZA (default - SMART SEARCH) ──
    // Normalize: remove all separators (-/.) for comparison
    const normalize = (s) => (s || '').toLowerCase().replace(/[-/.\\s]/g, '');

    // Check if query contains multiple part numbers (comma separated)
    const queries = q.includes(',') ? q.split(',').map(s => s.trim()).filter(Boolean) : [q];
    let allResults = [];

    for (const singleQ of queries) {
      const sq = singleQ.toLowerCase().trim();
      const sqNorm = normalize(sq);

      const found = allParts.filter(p => {
        const pNorm = normalize(p.numero_parte);
        const pName = p.nombre.toLowerCase();
        const pModel = (p.modelo_nombre || '').toLowerCase();
        const pCat = (p.cat || '').toLowerCase();

        // 1. Exact part number match (normalized - ignores -/.)
        if (sqNorm.length > 3 && pNorm.includes(sqNorm)) return true;
        // 2. Part number with separators
        if (sq.length > 3 && (p.numero_parte || '').toLowerCase().includes(sq)) return true;
        // 3. Name match
        if (pName.includes(sq)) return true;
        // 4. Category match
        if (pCat.includes(sq)) return true;
        // 5. Multi-word: all words must match across name+model+part
        if (sq.includes(' ')) {
          const words = sq.split(/\s+/);
          const haystack = pName + ' ' + pModel + ' ' + (p.numero_parte || '').toLowerCase() + ' ' + pCat;
          if (words.every(w => haystack.includes(w))) return true;
        }
        // 6. Model + anything: "ranger filtro", "ecosport freno"
        if (sq.includes(' ')) {
          const words = sq.split(/\s+/);
          const modelMatch = words.some(w => pModel.includes(w));
          const otherWords = words.filter(w => !pModel.includes(w));
          if (modelMatch && otherWords.length > 0) {
            const haystack = pName + ' ' + pCat + ' ' + (p.numero_parte || '').toLowerCase();
            if (otherWords.every(w => haystack.includes(w))) return true;
          }
        }
        // 7. Compatible models search: "ranger 2023"
        if (p.aplicativos?.some(a => a.toLowerCase().includes(sq))) return true;
        return false;
      });

      allResults.push(...found);
    }

    // Deduplicate by numero_parte
    const seen = new Set();
    const results = allResults.filter(r => {
      const key = r.numero_parte + '_' + r.modelo_nombre;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 20);

    if (results.length > 0) {
      const label = queries.length > 1
        ? `Encontre ${results.length} resultado${results.length > 1 ? 's' : ''} para ${queries.length} busquedas:`
        : `Encontre ${results.length} resultado${results.length > 1 ? 's' : ''} para "${raw.trim()}":`;
      addResult(label, results.map(r => ({
          nombre: r.nombre,
          numero_parte: r.numero_parte,
          modelo: r.modelo_nombre,
          precio: r.precio,
          precio_oem: r.precio_oem,
          stock: r.stock,
          aplicativos: r.aplicativos,
        }))
      );
    } else {
      addMsg('bot', `No encontre nada para "${raw.trim()}".\n\nPodés buscar:\n  • Nombre: "filtro aceite"\n  • Codigo: "mb3z2200a" (con o sin guiones)\n  • Varios codigos: "mb3z2200a, fl3z2c444b"\n  • Modelo + pieza: "ranger freno"\n  • Categoria: "frenos", "motor"\n\nO comandos:\n  "venta Carlos 45000" → registrar venta\n  "stock ranger" → ver stock`);
    }

    setTyping(false);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    processCommand(input);
    setInput('');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: t.bg || '#fafafa' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid ' + (t.cardBorder || '#e0e0e0'), background: t.card || '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #003478, #0060c0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 16 }}>🤖</span>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text || '#333' }}>Asistente Ford</div>
            <div style={{ fontSize: 11, color: t.textSecondary || '#888' }}>Busca piezas, registra ventas, consulta stock</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.from === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '12px 16px', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line',
              background: msg.from === 'user' ? '#003478' : (t.card || '#fff'),
              border: msg.from === 'user' ? 'none' : '1px solid ' + (t.cardBorder || '#e0e0e0'),
              borderRadius: msg.from === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
              color: msg.from === 'user' ? '#fff' : (t.text || '#333'),
            }}>
              {msg.text}
            </div>
            {/* Results table */}
            {msg.items && msg.items.length > 0 && (
              <div style={{ maxWidth: '90%', marginTop: 8, background: t.card || '#fff', border: '1px solid ' + (t.cardBorder || '#e0e0e0'), borderRadius: 12, overflow: 'hidden' }}>
                {msg.items.map((item, i) => (
                  <div key={i} style={{ padding: '10px 14px', borderBottom: i < msg.items.length - 1 ? '1px solid ' + (t.cardBorder || '#f0f0f0') : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.stock > 0 ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text || '#333' }}>{item.nombre}</div>
                      <div style={{ fontSize: 11, color: t.textSecondary || '#888' }}>{item.numero_parte} · {item.aplicativos?.length > 1 ? item.aplicativos.slice(0,4).join(' / ') : item.modelo}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>{item.precio}</div>
                      {item.precio_oem && <div style={{ fontSize: 10, color: t.textMuted || '#999', textDecoration: 'line-through' }}>OEM {item.precio_oem}</div>}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: item.stock > 0 ? '#22c55e' : (t.textMuted || '#999'), minWidth: 20, textAlign: 'right' }}>
                      {item.stock > 0 ? item.stock : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ background: t.card || '#fff', border: '1px solid ' + (t.cardBorder || '#e0e0e0'), borderRadius: '4px 14px 14px 14px', padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#003478', animation: 'typeDot 1s ease infinite', animationDelay: '0s' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#003478', animation: 'typeDot 1s ease infinite', animationDelay: '.2s' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#003478', animation: 'typeDot 1s ease infinite', animationDelay: '.4s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick examples */}
      {messages.length <= 1 && (
        <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(esJefe ? ['filtro aceite ranger', 'mb3z2200a', 'stock ecosport', 'ventas hoy', 'mb3z2200a, fl3z2c444b'] : ['filtro aceite ranger', 'mb3z2200a', 'mb3z2200a, fl3z2c444b', 'stock ecosport', 'pastillas freno']).map(ex => (
            <button key={ex} onClick={() => { setInput(ex); setTimeout(() => { processCommand(ex); setInput(''); }, 100); }}
              style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, border: '1px solid ' + (t.cardBorder || '#e0e0e0'), borderRadius: 20, background: t.card || '#fff', color: '#003478', cursor: 'pointer', fontFamily: 'inherit' }}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid ' + (t.cardBorder || '#e0e0e0'), background: t.card || '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
            placeholder={esJefe ? 'Busca pieza, registra venta, crea empleado...' : 'Busca pieza, consulta stock, registra venta...'}
            style={{ flex: 1, padding: '12px 16px', fontSize: 14, border: '1px solid ' + (t.cardBorder || '#e0e0e0'), borderRadius: 12, background: t.bg || '#fafafa', color: t.text || '#333', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={handleSend} disabled={!input.trim() || typing}
            style={{ width: 44, height: 44, borderRadius: 12, background: input.trim() && !typing ? '#003478' : (t.cardBorder || '#ccc'), border: 'none', cursor: input.trim() && !typing ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" /></svg>
          </button>
        </div>
      </div>

      <style>{`@keyframes typeDot{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}`}</style>
    </div>
  );
}
