import { useState, useRef, useEffect } from 'react';

const OPCIONES = [
  { icon: '🔍', label: 'Buscar repuesto', action: 'search' },
  { icon: '📋', label: 'Ver catalogo', action: 'catalog' },
  { icon: '💬', label: 'Consultar con un asesor', action: 'chat' },
  { icon: '📱', label: 'WhatsApp', action: 'whatsapp' },
  { icon: '📍', label: 'Como llegar', action: 'map' },
  { icon: '🕐', label: 'Horarios', action: 'hours' },
];

export default function ChatBubble({ onAction, unread }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);

  const handleOption = (action) => {
    setOpen(false);
    if (action === 'whatsapp') {
      window.open('https://wa.me/5491162756333?text=Hola! Quiero consultar por repuestos Ford', '_blank');
    } else if (action === 'map') {
      window.open('https://www.google.com/maps/place/La+Ford+de+Warnes/@-34.598777,-58.4563422,17z/data=!3m1!4b1!4m6!3m5!1s0x95bcca07865b0dfb:0xccc0a5e2fbbe584c', '_blank');
    } else {
      onAction(action);
    }
  };

  return (
    <>
      {/* Popup */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 90, right: 20, width: 300, background: 'var(--fw-card, #fff)',
          borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,.18)', zIndex: 1000,
          overflow: 'hidden', animation: 'bubble-up .25s ease',
        }}>
          {/* Header */}
          <div style={{ background: '#003478', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--fw-card, #fff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#003478', fontStyle: 'italic', fontFamily: 'Georgia,serif' }}>Ford</span>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>La Ford de Warnes</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>En que te podemos ayudar?</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
          {/* Options */}
          <div style={{ padding: 12 }}>
            {OPCIONES.map((opt, i) => (
              <button key={i} onClick={() => handleOption(opt.action)}
                style={{
                  width: '100%', padding: '11px 14px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--fw-card, #fff)', border: '1.5px solid var(--fw-cardBorder, #e0e0e0)', borderRadius: 10,
                  fontSize: 13, fontWeight: 500, color: 'var(--fw-text, #333)', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#003478'; e.currentTarget.style.background = '#f0f4ff'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--fw-cardBorder, #e0e0e0)'; e.currentTarget.style.background = 'var(--fw-card, #fff)'; }}>
                <span style={{ fontSize: 16 }}>{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
          {/* Info */}
          <div style={{ padding: '8px 14px 14px', borderTop: '1px solid #eee', fontSize: 11, color: 'var(--fw-textMuted, #999)', textAlign: 'center' }}>
            Av. Honorio Pueyrredon 2180, Local 1 · Tel: 4582-1565
          </div>
        </div>
      )}

      {/* Floating button */}
      <button onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{
          position: 'fixed', bottom: 20, right: 20, width: 60, height: 60,
          borderRadius: '50%', background: '#003478', border: 'none',
          boxShadow: hover ? '0 6px 24px rgba(0,52,120,.4)' : '0 4px 16px rgba(0,0,0,.2)',
          cursor: 'pointer', zIndex: 999, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', transition: 'all .2s',
          transform: hover ? 'scale(1.1)' : open ? 'rotate(45deg)' : 'scale(1)',
        }}>
        {open ? (
          <span style={{ color: '#fff', fontSize: 24, fontWeight: 300, lineHeight: 1 }}>+</span>
        ) : (
          <>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            <span style={{ color: '#fff', fontSize: 7, fontWeight: 800, letterSpacing: '.5px', marginTop: 1 }}>FORD</span>
          </>
        )}
        {/* Badge */}
        {unread > 0 && !open && (
          <div style={{
            position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10,
            background: '#dc2626', border: '2px solid #fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', padding: '0 5px',
          }}>
            {unread}
          </div>
        )}
      </button>

      <style>{`
        @keyframes bubble-up{from{opacity:0;transform:translateY(10px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
      `}</style>
    </>
  );
}
