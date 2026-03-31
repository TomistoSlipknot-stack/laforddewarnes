import { useState, useRef, useEffect } from 'react';

const STEPS = [
  { id: 'inicio', bot: 'Hola! Soy el asistente de Ford de Warnes. En que te puedo ayudar?', options: ['Comprar un repuesto', 'Consultar precio', 'Hablar con Juan'] },
  { id: 'modelo', bot: 'Para que modelo de Ford?', options: ['F-150', 'Ranger', 'Explorer', 'Mustang', 'EcoSport', 'Focus', 'Ka', 'Bronco', 'Escape', 'Fiesta', 'Transit', 'Falcon', 'Otro'] },
  { id: 'pieza', bot: 'Que pieza necesitas? Escribila abajo.' },
  { id: 'cuando', bot: 'Para cuando?', options: ['Hoy', 'Maniana', 'Esta semana', 'No tengo apuro'] },
  { id: 'contacto', bot: 'Tu nombre y telefono para que Juan te contacte:' },
];

export default function PrivateChatInline({ network, userName }) {
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState('');
  const [step, setStep] = useState(0);
  const [orderData, setOrderData] = useState({});
  const [botMode, setBotMode] = useState(true);
  const bottomRef = useRef(null);

  const realMessages = network.roomId ? (network.chatMessages[network.roomId] || []) : [];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, realMessages]);

  useEffect(() => {
    if (botMode && msgs.length === 0) {
      setTimeout(() => setMsgs([{ id: 1, from: 'bot', text: STEPS[0].bot, options: STEPS[0].options }]), 400);
    }
  }, []);

  const addMsg = (from, text, options) => setMsgs(prev => [...prev, { id: Date.now() + Math.random(), from, text, options }]);

  const handleOption = (option) => {
    addMsg('user', option);
    if (step === 0) {
      if (option === 'Hablar con Juan') { setBotMode(false); setTimeout(() => addMsg('bot', 'Conectado con Juan. Escribile abajo.'), 500); return; }
      setOrderData(d => ({ ...d, tipo: option }));
      setTimeout(() => addMsg('bot', STEPS[1].bot, STEPS[1].options), 600);
      setStep(1);
    } else if (step === 1) {
      setOrderData(d => ({ ...d, modelo: option }));
      setTimeout(() => addMsg('bot', STEPS[2].bot), 600);
      setStep(2);
    } else if (step === 3) {
      setOrderData(d => ({ ...d, cuando: option }));
      setTimeout(() => addMsg('bot', STEPS[4].bot), 600);
      setStep(4);
    }
  };

  const handleSend = () => {
    const t = inp.trim(); if (!t) return; setInp('');
    if (!botMode) { network.sendChat(t); return; }
    addMsg('user', t);
    if (step === 2) {
      setOrderData(d => ({ ...d, pieza: t }));
      setTimeout(() => addMsg('bot', STEPS[3].bot, STEPS[3].options), 600);
      setStep(3);
    } else if (step === 4) {
      const order = { ...orderData, contacto: t };
      const summary = `NUEVO PEDIDO:\nCliente: ${userName || 'Sin nombre'}\nTipo: ${order.tipo}\nModelo: ${order.modelo}\nPieza: ${order.pieza}\nPara: ${order.cuando}\nContacto: ${order.contacto}`;
      network.sendChat(summary);
      setTimeout(() => {
        addMsg('bot', `Pedido enviado a Juan!\n\nModelo: ${order.modelo}\nPieza: ${order.pieza}\nPara: ${order.cuando}\n\nJuan te va a responder por aca.`);
        setBotMode(false);
      }, 800);
      setStep(5);
    }
  };

  const fmt = ts => new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  const allMessages = [...msgs];
  if (!botMode) {
    for (const rm of realMessages) {
      if (rm.fromRole !== 'admin') continue;
      allMessages.push({ id: rm.ts, from: 'juan', text: rm.text, ts: rm.ts });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: '#fff' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#003478,#0050a0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 9, fontStyle: 'italic', fontFamily: 'Georgia,serif' }}>Ford</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fw-text, #333)' }}>Ford de Warnes</div>
          <div style={{ fontSize: 10, color: botMode ? '#003478' : '#22c55e' }}>{botMode ? 'Asistente' : 'Chat con Juan'}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allMessages.map((msg) => {
          const isUser = msg.from === 'user';
          const isJuan = msg.from === 'juan';
          return (
            <div key={msg.id}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', animation: 'msg-in .2s ease' }}>
                {isJuan && <div style={{ fontSize: 9, color: '#fbbf24', marginBottom: 2, paddingLeft: 4, fontWeight: 600 }}>Juan</div>}
                {msg.from === 'bot' && <div style={{ fontSize: 9, color: '#003478', marginBottom: 2, paddingLeft: 4 }}>Asistente</div>}
                <div style={{
                  maxWidth: '88%', padding: '8px 12px', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-line',
                  background: isUser ? '#003478' : isJuan ? '#e8ffe8' : '#f5f5f5',
                  border: `1px solid ${isUser ? '#0050a0' : isJuan ? '#b0d8b0' : '#e0e0e0'}`,
                  borderRadius: isUser ? '10px 3px 10px 10px' : '3px 10px 10px 10px',
                  color: isUser ? '#fff' : isJuan ? '#2a6b2a' : '#444',
                }}>{msg.text}</div>
                {msg.ts && <div style={{ fontSize: 8, color: 'var(--fw-textMuted, #ccc)', marginTop: 1 }}>{fmt(msg.ts)}</div>}
              </div>
              {msg.options && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, paddingLeft: 4 }}>
                  {msg.options.map((opt, oi) => (
                    <button key={oi} onClick={() => handleOption(opt)}
                      style={{ background: 'rgba(0,61,165,.06)', border: '1px solid rgba(0,61,165,.2)', borderRadius: 16, padding: '5px 10px', fontSize: 11, color: '#003478', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .1s' }}>
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '8px 10px', borderTop: '1px solid #e0e0e0', flexShrink: 0, background: '#fafafa' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--fw-inputBg, #f5f5f5)', border: '1px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 10, padding: '3px 3px 3px 10px' }}>
          <input value={inp} onChange={e => setInp(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={botMode ? (step === 2 ? 'Ej: Filtro de aceite...' : step === 4 ? 'Carlos 1155551234' : 'Escribi...') : 'Mensaje a Juan...'}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--fw-text, #333)', fontFamily: 'inherit', padding: '8px 0', caretColor: '#003478' }} />
          <button onClick={handleSend} disabled={!inp.trim()}
            style={{ width: 34, height: 34, background: inp.trim() ? '#003478' : '#ccc', border: 'none', borderRadius: 8, cursor: inp.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={inp.trim() ? '#fff' : '#333'} strokeWidth="2.5"><path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
