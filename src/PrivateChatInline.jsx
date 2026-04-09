import { useState, useRef, useEffect } from 'react';

export default function PrivateChatInline({ network, userName, pendingConsulta, onConsultaSent, onClose }) {
  const [msgs, setMsgs] = useState(() => {
    try { const saved = localStorage.getItem('fw_chat_msgs'); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem('fw_chat_msgs', JSON.stringify(msgs.slice(-50))); } catch {} }, [msgs]);
  const [inp, setInp] = useState('');
  const [typing, setTyping] = useState(false);
  const [connected, setConnected] = useState(false); // connected to human asesor
  const bottomRef = useRef(null);
  const consultaSentRef = useRef(false);

  const realMessages = network.roomId ? (network.chatMessages[network.roomId] || []) : [];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, realMessages, typing]);

  // Welcome message
  useEffect(() => {
    if (msgs.length === 0) {
      setMsgs([{
        id: 1, from: 'bot',
        text: `Hola${userName ? ' ' + userName : ''}! Soy el asistente de La Ford de Warnes.\n\nContame qué necesitás y te ayudo a encontrarlo. Podés preguntarme cualquier cosa sobre repuestos Ford.\n\nSi preferís hablar con una persona, escribí "asesor".`,
      }]);
    }
  }, []);

  // Handle pending consulta
  useEffect(() => {
    if (pendingConsulta && !consultaSentRef.current) {
      consultaSentRef.current = true;
      setMsgs(prev => [
        ...prev,
        { id: Date.now(), from: 'user', text: pendingConsulta },
      ]);
      // Send to server and ask AI
      network.sendChat('[Consulta de producto]\n' + pendingConsulta);
      askAI(pendingConsulta);
      if (onConsultaSent) onConsultaSent();
      setTimeout(() => { consultaSentRef.current = false; }, 500);
    }
  }, [pendingConsulta]);

  // Show real messages from asesor — merge chronologically with local msgs
  const allMessages = [...msgs];
  for (const rm of realMessages) {
    if (rm.fromRole === 'admin' || rm.fromRole === 'employee') {
      const exists = allMessages.some(m => m.ts === rm.ts && m.text === rm.text);
      if (!exists) {
        allMessages.push({ id: rm.ts, from: 'asesor', fromRole: rm.fromRole, text: rm.text, ts: rm.ts });
      }
    }
  }
  // Sort all messages chronologically so asesor replies appear in the right position
  allMessages.sort((a, b) => (a.ts || a.id || 0) - (b.ts || b.id || 0));

  const addMsg = (from, text) => {
    const now = Date.now();
    setMsgs(prev => [...prev, { id: now + Math.random(), from, text, ts: now }]);
  };

  const askAI = async (userText) => {
    setTyping(true);
    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userText,
          context: `El cliente "${userName || 'anonimo'}" esta chateando con el asistente virtual. Ayudalo a encontrar repuestos, consultar precios, o resolver sus dudas. Si no podes resolver su consulta, sugerile que escriba "asesor" para hablar con una persona.`
        }),
      });
      const data = await res.json();
      if (data.ok && data.response) {
        addMsg('bot', data.response);
      } else {
        addMsg('bot', 'Disculpá, no pude procesar tu consulta. Escribí "asesor" para hablar con una persona, o probá con otra pregunta.');
      }
    } catch {
      addMsg('bot', 'Error de conexión. Probá de nuevo o escribí "asesor" para hablar con una persona.');
    }
    setTyping(false);
  };

  const connectToHuman = () => {
    setConnected(true);
    // Send bot summary to server
    const botSummary = msgs.filter(m => m.from !== 'asesor').map(m => (m.from === 'user' ? 'Cliente: ' : 'Bot: ') + m.text).join('\n');
    if (botSummary) network.sendChat('[Resumen del asistente]\n' + botSummary + '\n\n--- Conectado con asesor ---');
    addMsg('bot', 'Te estoy conectando con un asesor. Escribí tu mensaje abajo y te van a responder pronto.');
  };

  const handleSend = () => {
    const t = inp.trim(); if (!t) return; setInp('');

    // Check if wants human asesor
    if (!connected && (t.toLowerCase().includes('asesor') || t.toLowerCase().includes('persona') || t.toLowerCase().includes('humano') || t.toLowerCase().includes('hablar con'))) {
      addMsg('user', t);
      connectToHuman();
      return;
    }

    if (connected) {
      // Send to human asesor via WebSocket
      addMsg('user', t);
      network.sendChat(t);
      return;
    }

    // AI mode - ask Claude
    addMsg('user', t);
    askAI(t);
  };

  const fmt = ts => ts ? new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--fw-cardBorder, #e0e0e0)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: 'var(--fw-card, #fff)' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#003478,#0050a0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 9, fontStyle: 'italic', fontFamily: 'Georgia,serif' }}>Ford</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fw-text, #333)' }}>La Ford de Warnes</div>
          <div style={{ fontSize: 10, color: connected ? '#22c55e' : '#4a9eff' }}>
            {connected ? 'Chat con asesor' : 'Asistente inteligente'}
          </div>
        </div>
        {!connected && (
          <button onClick={connectToHuman} style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, border: '1px solid #22c55e', borderRadius: 6, background: 'rgba(34,197,94,.1)', color: '#22c55e', cursor: 'pointer', fontFamily: 'inherit' }}>
            Hablar con persona
          </button>
        )}
        {onClose && <button onClick={onClose} style={{ padding: '5px 10px', fontSize: 14, border: 'none', background: 'transparent', color: 'var(--fw-textMuted, #999)', cursor: 'pointer' }}>✕</button>}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allMessages.map((msg) => {
          const isUser = msg.from === 'user';
          const isAsesor = msg.from === 'asesor';
          const isBotAI = msg.from === 'bot';
          return (
            <div key={msg.id}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                {isAsesor && <div style={{ fontSize: 9, color: '#22c55e', marginBottom: 2, paddingLeft: 4, fontWeight: 600 }}>Asesor</div>}
                {isBotAI && <div style={{ fontSize: 9, color: '#4a9eff', marginBottom: 2, paddingLeft: 4 }}>Asistente</div>}
                <div style={{
                  maxWidth: '88%', padding: '10px 14px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line',
                  background: isUser ? '#003478' : isAsesor ? 'var(--fw-card, #e8ffe8)' : 'var(--fw-card, #f5f5f5)',
                  border: `1px solid ${isUser ? '#0050a0' : isAsesor ? 'rgba(34,197,94,.25)' : 'var(--fw-cardBorder, #e0e0e0)'}`,
                  borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                  color: isUser ? '#fff' : 'var(--fw-text, #333)',
                }}>
                  {msg.text}
                </div>
                {msg.ts && <div style={{ fontSize: 8, color: 'var(--fw-textMuted, #ccc)', marginTop: 1 }}>{fmt(msg.ts)}</div>}
              </div>
            </div>
          );
        })}
        {/* Typing indicator */}
        {typing && (
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            <div style={{ background: 'var(--fw-card, #f5f5f5)', border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: '4px 14px 14px 14px', padding: '10px 16px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4a9eff', animation: 'typeDot 1s ease infinite' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4a9eff', animation: 'typeDot 1s ease infinite', animationDelay: '.2s' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4a9eff', animation: 'typeDot 1s ease infinite', animationDelay: '.4s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      {msgs.length <= 2 && !connected && (
        <div style={{ padding: '0 10px 6px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Filtro de aceite Ranger', 'Pastillas de freno', 'Consultar precios', 'Hablar con persona'].map(ex => (
            <button key={ex} onClick={() => {
              if (ex === 'Hablar con persona') { connectToHuman(); return; }
              setInp(ex);
            }}
              style={{ padding: '5px 10px', fontSize: 10, fontWeight: 600, border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 16, background: 'var(--fw-card, #fff)', color: 'var(--fw-text, #666)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--fw-cardBorder, #e0e0e0)', flexShrink: 0, background: 'var(--fw-card, #fafafa)' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--fw-card, #f5f5f5)', border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 10, padding: '3px 3px 3px 10px' }}>
          <input value={inp} onChange={e => setInp(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={connected ? 'Escribí tu mensaje al asesor...' : 'Preguntame lo que necesites...'}
            disabled={typing}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--fw-text, #333)', fontFamily: 'inherit', padding: '8px 0', caretColor: '#003478' }} />
          <button onClick={handleSend} disabled={!inp.trim() || typing}
            style={{ width: 34, height: 34, background: inp.trim() && !typing ? '#003478' : 'var(--fw-cardBorder, #ccc)', border: 'none', borderRadius: 8, cursor: inp.trim() && !typing ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={inp.trim() ? '#fff' : '#666'} strokeWidth="2.5"><path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" /></svg>
          </button>
        </div>
      </div>

      <style>{`@keyframes typeDot{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}`}</style>
    </div>
  );
}
