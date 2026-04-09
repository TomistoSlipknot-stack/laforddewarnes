// ─── BUSCADOR CHAT (Fase 7) ───────────────────────────────────────────────
// Conversational AI search. Sits next to the existing SearchAutocomplete bar.
// - Talks to /api/buscador-ia-v2 which uses Claude with tool use.
// - Renders inline product cards pulled from tool results.
// - Shows cart-proposal with explicit confirmation before adding anything.
// - Persists the last 24h of conversation in localStorage.
import { useState, useRef, useEffect } from 'react';

const STORAGE_KEY = 'fw_buscador_chat_v2';
const TTL_MS = 24 * 60 * 60 * 1000;

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessionId: null, messages: [] };
    const data = JSON.parse(raw);
    if (!data || !data.updatedAt || Date.now() - data.updatedAt > TTL_MS) return { sessionId: null, messages: [] };
    return data;
  } catch { return { sessionId: null, messages: [] }; }
}
function saveHistory(sessionId, messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, messages: messages.slice(-40), updatedAt: Date.now() }));
  } catch {}
}
function newSessionId() {
  return 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export default function BuscadorChat({ theme, userName, role, onOpenPart, onAddToCart, onOpenChat }) {
  const initial = loadHistory();
  const [sessionId, setSessionId] = useState(initial.sessionId || newSessionId());
  const [messages, setMessages] = useState(initial.messages || []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(initial.messages && initial.messages.length > 0);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const t = theme || {};

  useEffect(() => { saveHistory(sessionId, messages); }, [sessionId, messages]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  const send = async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;
    const userMsg = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setExpanded(true);
    setLoading(true);
    try {
      const resp = await fetch('/api/buscador-ia-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          role: role || 'client',
          userName: userName || null,
          sessionId,
        }),
      });
      const d = await resp.json();
      if (!resp.ok || !d.ok) {
        setMessages(m => [...m, { role: 'assistant', content: d.error || 'Error temporal. Probá de nuevo en un momento.', error: true }]);
      } else {
        setMessages(m => [...m, {
          role: 'assistant',
          content: d.response || '...',
          cards: d.cards || [],
          proposals: d.proposals || [],
          meta: d.meta || {},
        }]);
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: 'No pude conectar con el asistente. Revisa tu conexión.', error: true }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
    }
  };

  const confirmProposal = (proposal, msgIdx) => {
    if (!onAddToCart) return;
    onAddToCart({
      sku: proposal.sku,
      numero_parte: proposal.numero_parte,
      nombre: proposal.nombre,
      precio: proposal.precio,
      qty: proposal.cantidad || 1,
    });
    // Mark proposal as confirmed so the button disappears
    setMessages(m => m.map((mm, i) => {
      if (i !== msgIdx) return mm;
      return { ...mm, proposals: (mm.proposals || []).map(p => p.sku === proposal.sku ? { ...p, confirmed: true } : p) };
    }));
    // Auto-reply from the assistant confirming the action
    setMessages(m => [...m, { role: 'assistant', content: `✓ Listo, agregué ${proposal.cantidad || 1} × ${proposal.nombre} al carrito. ¿Algo más que necesites?`, system: true }]);
  };

  const declineProposal = (proposal, msgIdx) => {
    setMessages(m => m.map((mm, i) => {
      if (i !== msgIdx) return mm;
      return { ...mm, proposals: (mm.proposals || []).filter(p => p.sku !== proposal.sku) };
    }));
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId(newSessionId());
    setExpanded(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const bg = t.card || '#fff';
  const border = t.cardBorder || '#e0e0e0';
  const text = t.text || '#222';
  const textSec = t.textSecondary || '#666';
  const accent = '#003478';

  return (
    <div style={{ width: '100%', marginTop: 10 }}>
      {/* Header trigger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: bg, border: '2px solid ' + border, borderRadius: 12, cursor: expanded ? 'default' : 'pointer' }}
           onClick={() => !expanded && setExpanded(true)}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg,#003478,#0066cc)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v4"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: text }}>Asistente inteligente</div>
          <div style={{ fontSize: 11, color: textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Preguntame en lenguaje natural: "filtro de aire para mi ranger 2018 diesel"
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={(e) => { e.stopPropagation(); clearChat(); }}
                  style={{ background: 'transparent', border: '1px solid ' + border, borderRadius: 6, padding: '6px 10px', fontSize: 11, color: textSec, cursor: 'pointer', fontFamily: 'inherit' }}>
            Nueva consulta
          </button>
        )}
        {!expanded && messages.length === 0 && (
          <div style={{ fontSize: 11, fontWeight: 700, color: accent, padding: '6px 12px', border: '1px solid ' + accent, borderRadius: 6 }}>Empezar</div>
        )}
      </div>

      {/* Chat body */}
      {expanded && (
        <div style={{ marginTop: 10, background: bg, border: '1px solid ' + border, borderRadius: 12, overflow: 'hidden' }}>
          <div ref={scrollRef} style={{ padding: 14, maxHeight: 440, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 12px', color: textSec, fontSize: 13 }}>
                <div style={{ marginBottom: 10 }}>👋 Contame qué necesitás y lo busco por vos.</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {['filtro aceite ranger', 'pastillas freno ecosport', 'correa distribucion focus', 'bujias transit'].map(ex => (
                    <button key={ex} onClick={() => send(ex)} style={{ background: 'transparent', border: '1px solid ' + border, borderRadius: 20, padding: '6px 12px', fontSize: 11, color: textSec, cursor: 'pointer', fontFamily: 'inherit' }}>{ex}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  background: m.role === 'user' ? accent : (m.error ? '#fee' : (m.system ? '#ecfdf5' : t.bg || '#f5f7fa')),
                  color: m.role === 'user' ? '#fff' : (m.error ? '#991b1b' : text),
                  padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.content}
                </div>
                {/* Product cards rendered inline from tool results */}
                {m.role === 'assistant' && Array.isArray(m.cards) && m.cards.length > 0 && (
                  <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8, marginTop: 4 }}>
                    {m.cards.slice(0, 6).map((c, j) => (
                      <div key={j} style={{ background: t.bg || '#f5f7fa', border: '1px solid ' + border, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', lineHeight: 1.3 }}>{c.categoria || ''}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: text, lineHeight: 1.3, maxHeight: 48, overflow: 'hidden' }}>{c.nombre}</div>
                        <div style={{ fontSize: 10, color: textSec }}>{c.numero_parte || c.sku}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: text, marginTop: 2 }}>${Number(c.precio || 0).toLocaleString('es-AR')}</div>
                        {c.tiene_detalles && <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 700 }}>✓ Compatibilidad verificada</div>}
                        <button onClick={() => onOpenPart && onOpenPart(c)} style={{ marginTop: 4, background: accent, border: 'none', borderRadius: 6, padding: '6px 0', fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Ver detalle</button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Cart proposals (require confirmation) */}
                {m.role === 'assistant' && Array.isArray(m.proposals) && m.proposals.filter(p => !p.confirmed).length > 0 && (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    {m.proposals.filter(p => !p.confirmed).map((p, j) => (
                      <div key={j} style={{ background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', marginBottom: 4 }}>Propuesta del asistente — necesita tu confirmación</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: text, marginBottom: 2 }}>{p.nombre}</div>
                        <div style={{ fontSize: 11, color: textSec, marginBottom: 2 }}>Cantidad: {p.cantidad || 1} · ${Number(p.precio || 0).toLocaleString('es-AR')}</div>
                        {p.razon && <div style={{ fontSize: 11, color: textSec, fontStyle: 'italic', marginBottom: 8 }}>"{p.razon}"</div>}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => confirmProposal(p, i)} style={{ flex: 1, background: '#16a34a', border: 'none', borderRadius: 6, padding: '9px 0', fontSize: 12, fontWeight: 800, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>✓ Sí, agregar</button>
                          <button onClick={() => declineProposal(p, i)} style={{ flex: 1, background: 'transparent', border: '1px solid ' + border, borderRadius: 6, padding: '9px 0', fontSize: 12, fontWeight: 700, color: textSec, cursor: 'pointer', fontFamily: 'inherit' }}>No</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* No-results fallback: offer WhatsApp + chat */}
                {m.role === 'assistant' && m.meta && m.meta.noResults && (
                  <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                    <a href={'https://wa.me/5491162756333?text=' + encodeURIComponent('Hola! Busqué "' + (messages[i - 1]?.content || '') + '" en la web y no encontré. ¿Me pueden ayudar?')} target="_blank" rel="noopener noreferrer"
                       style={{ background: '#25d366', color: '#fff', borderRadius: 6, padding: '9px 0', fontSize: 12, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}>📱 WhatsApp a Juan</a>
                    {onOpenChat && (
                      <button onClick={() => onOpenChat(messages[i - 1]?.content || '')} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 6, padding: '9px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>💬 Chat con la tienda</button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: t.bg || '#f5f7fa', borderRadius: '14px 14px 14px 4px', alignSelf: 'flex-start', maxWidth: '85%' }}>
                <div style={{ width: 14, height: 14, border: '2px solid ' + accent, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                <span style={{ fontSize: 12, color: textSec }}>Pensando...</span>
              </div>
            )}
          </div>
          {/* Input */}
          <div style={{ padding: 10, borderTop: '1px solid ' + border, display: 'flex', gap: 8, background: t.bg || '#f8f9fa' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Seguí preguntando..."
              disabled={loading}
              style={{ flex: 1, border: '1px solid ' + border, borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', background: bg, color: text, outline: 'none' }}
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
                    style={{ background: loading || !input.trim() ? '#ccc' : accent, border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
