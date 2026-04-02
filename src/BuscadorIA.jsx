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
      text: esJefe
        ? `Hola Juan! Soy tu asistente personal de La Ford de Warnes.\n\nPuedo ayudarte con todo:\n• Buscar repuestos por nombre, código o modelo\n• Ver stock y precios\n• Registrar ventas\n• Crear empleados\n• Ajustar precios\n\nPreguntame lo que necesites, como si estuvieras hablando con alguien.`
        : `Hola${userName ? ' ' + userName : ''}! Bienvenido a La Ford de Warnes.\n\nSoy el asistente virtual de la tienda. Puedo ayudarte a:\n• Encontrar el repuesto que necesitás\n• Consultar precios y disponibilidad\n• Comparar opciones para tu vehículo\n• Responder tus dudas sobre repuestos Ford\n\nDecime qué necesitás y te ayudo al toque.`
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
    if (esJefe && (q.startsWith('crear empleado') || q.startsWith('crea empleado') || q.startsWith('nuevo empleado') || q.startsWith('agregar empleado'))) {
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

    // ── ALWAYS USE AI + TEXT SEARCH TOGETHER ──
    const normalize = (s) => (s || '').toLowerCase().replace(/[-/.\s]/g, '');

    // Quick text search for context
    const queries = q.includes(',') ? q.split(',').map(s => s.trim()).filter(Boolean) : [q];
    let allResults = [];
    for (const singleQ of queries) {
      const sq = singleQ.toLowerCase().trim();
      const sqNorm = normalize(sq);
      const found = allParts.filter(p => {
        const pNorm = normalize(p.numero_parte);
        const pName = (p.nombre || '').toLowerCase();
        const pModel = (p.modelo_nombre || '').toLowerCase();
        const pCat = (p.cat || '').toLowerCase();
        if (sqNorm.length > 3 && pNorm.includes(sqNorm)) return true;
        if (sq.length > 3 && (p.numero_parte || '').toLowerCase().includes(sq)) return true;
        if (pName.includes(sq)) return true;
        if (pCat.includes(sq)) return true;
        if (p.aplicativos?.some(a => a.toLowerCase().includes(sq))) return true;
        if (sq.includes(' ')) {
          const words = sq.split(/\s+/).filter(w => w.length > 1);
          const hay = pName + ' ' + pModel + ' ' + pCat + ' ' + (p.numero_parte || '').toLowerCase();
          if (words.every(w => hay.includes(w))) return true;
          const modelMatch = words.some(w => pModel.includes(w));
          if (modelMatch) { const other = words.filter(w => !pModel.includes(w)); if (other.every(w => (pName + ' ' + pCat).includes(w))) return true; }
        }
        return false;
      });
      allResults.push(...found);
    }
    const seen = new Set();
    const textResults = allResults.filter(r => { const k = r.numero_parte; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10);

    // Build context for AI
    const context = textResults.length > 0
      ? 'Productos encontrados en el catalogo de La Ford de Warnes:\n' + textResults.map(p => `- ${p.nombre} | Codigo: ${p.numero_parte} | Precio: ${p.precio} | Modelo: ${p.aplicativos?.join(', ') || p.modelo_nombre}`).join('\n')
      : 'No se encontraron productos exactos en el catalogo para esta busqueda.';

    // ALWAYS ask AI for a helpful response
    try {
      const aiRes = await fetch('/api/ai-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: raw.trim(), context, role: esJefe ? 'jefe' : 'empleado', userName }),
      });
      const aiData = await aiRes.json();
      if (aiData.ok && aiData.response) {
        if (textResults.length > 0) {
          addResult(aiData.response, textResults.map(r => ({ nombre: r.nombre, numero_parte: r.numero_parte, modelo: r.modelo_nombre, precio: r.precio, precio_oem: r.precio_oem, stock: r.stock, aplicativos: r.aplicativos })));
        } else {
          addMsg('bot', aiData.response);
        }
      } else {
        // AI failed, show text results or error
        if (textResults.length > 0) {
          addResult(`Encontre ${textResults.length} resultado${textResults.length > 1 ? 's' : ''}:`, textResults.map(r => ({ nombre: r.nombre, numero_parte: r.numero_parte, modelo: r.modelo_nombre, precio: r.precio, precio_oem: r.precio_oem, stock: r.stock, aplicativos: r.aplicativos })));
        } else {
          addMsg('bot', `No encontre resultados para "${raw.trim()}". Probá con otro término o consultá por WhatsApp: 11 6275-6333`);
        }
      }
    } catch {
      if (textResults.length > 0) {
        addResult(`Encontre ${textResults.length} resultado${textResults.length > 1 ? 's' : ''}:`, textResults.map(r => ({ nombre: r.nombre, numero_parte: r.numero_parte, modelo: r.modelo_nombre, precio: r.precio, precio_oem: r.precio_oem, stock: r.stock, aplicativos: r.aplicativos })));
      } else {
        addMsg('bot', `Error de conexión. Consultá por WhatsApp: 11 6275-6333`);
      }
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
          {(esJefe ? ['ventas hoy', 'stock ranger', 'crear empleado', 'subir precios 5%', 'empleados'] : ['stock ranger', 'filtro aceite ecosport', 'pastillas de freno', 'buscar EB3Z2C150A']).map(ex => (
            <button key={ex} onClick={() => { setInput(ex); setTimeout(() => { processCommand(ex); setInput(''); }, 100); }}
              style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, border: '1px solid ' + (t.cardBorder || '#e0e0e0'), borderRadius: 20, background: t.card || '#fff', color: '#4a9eff', cursor: 'pointer', fontFamily: 'inherit' }}>
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
