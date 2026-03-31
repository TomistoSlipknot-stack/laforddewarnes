import { useState, useEffect } from 'react';

const ITEMS = [
  { id: 'cafe', name: 'Cafe', price: 30, emoji: '☕', desc: 'Un cortado bien cargado', rarity: 'comun', reaction: 'cafe' },
  { id: 'medialuna', name: 'Medialunas', price: 40, emoji: '🥐', desc: 'Medialunas de manteca', rarity: 'comun', reaction: 'medialuna' },
  { id: 'cigarro', name: 'Cigarrillo', price: 50, emoji: '🚬', desc: 'Un pucho para el jefe', rarity: 'comun', reaction: 'cigarro' },
  { id: 'cerveza', name: 'Cerveza', price: 60, emoji: '🍺', desc: 'Una bien fria', rarity: 'raro', reaction: 'cerveza' },
  { id: 'vino', name: 'Vino Tinto', price: 80, emoji: '🍷', desc: 'Malbec argentino', rarity: 'raro', reaction: 'vino' },
  { id: 'fernet', name: 'Fernet con Cola', price: 100, emoji: '🥃', desc: 'El clasico cordobes', rarity: 'epico', reaction: 'fernet' },
  { id: 'asado', name: 'Asado completo', price: 150, emoji: '🥩', desc: 'Vacio, chorizo, morcilla', rarity: 'epico', reaction: 'asado' },
  { id: 'sueldo', name: 'Sueldo Extra', price: 300, emoji: '💰', desc: 'Un sobre con plata', rarity: 'legendario', reaction: 'sueldo' },
  { id: 'vacaciones', name: 'Vacaciones', price: 500, emoji: '🏖️', desc: 'Una semana en la costa', rarity: 'legendario', reaction: 'vacaciones' },
];

const RARITY_COLORS = {
  comun: { bg: 'rgba(156,163,175,.1)', border: 'rgba(156,163,175,.3)', text: '#9ca3af', label: 'Comun' },
  raro: { bg: 'rgba(59,130,246,.1)', border: 'rgba(59,130,246,.3)', text: '#3b82f6', label: 'Raro' },
  epico: { bg: 'rgba(168,85,247,.1)', border: 'rgba(168,85,247,.3)', text: '#a855f7', label: 'Epico' },
  legendario: { bg: 'rgba(234,179,8,.1)', border: 'rgba(234,179,8,.3)', text: '#eab308', label: 'Legendario' },
};

export default function TiendaEmpleado({ theme, saldo, onBuy }) {
  const t = theme || {};
  const [bought, setBought] = useState(null);
  const [showAnim, setShowAnim] = useState(false);

  const handleBuy = (item) => {
    if (saldo < item.price) return;
    setBought(item);
    setShowAnim(true);
    onBuy(item);
    setTimeout(() => { setShowAnim(false); setBought(null); }, 2500);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: t.bg || '#fafafa' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + (t.cardBorder || '#e0e0e0'), background: t.card || '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.text || '#333' }}>Tienda del Empleado</div>
            <div style={{ fontSize: 12, color: t.textSecondary || '#888', marginTop: 2 }}>Comprale algo a Juan y mira como reacciona</div>
          </div>
          <div style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 12, padding: '8px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Tu saldo</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#22c55e' }}>${saldo.toLocaleString('es-AR')}</div>
          </div>
        </div>
      </div>

      {/* Buy animation overlay */}
      {showAnim && bought && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.5)', animation: 'fadeIn .2s ease' }}>
          <div style={{ textAlign: 'center', animation: 'bounceIn .5s ease' }}>
            <div style={{ fontSize: 80, marginBottom: 16 }}>{bought.emoji}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,.5)' }}>Le diste {bought.name} a Juan!</div>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,.7)', marginTop: 8 }}>-${bought.price}</div>
          </div>
        </div>
      )}

      {/* Items grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {ITEMS.map(item => {
            const r = RARITY_COLORS[item.rarity];
            const canBuy = saldo >= item.price;
            return (
              <div key={item.id} onClick={() => canBuy && handleBuy(item)}
                style={{
                  background: t.card || '#fff', border: '2px solid ' + (canBuy ? r.border : (t.cardBorder || '#e0e0e0')),
                  borderRadius: 14, padding: 18, cursor: canBuy ? 'pointer' : 'not-allowed',
                  opacity: canBuy ? 1 : .5, transition: 'all .2s', position: 'relative', overflow: 'hidden',
                }}>
                {/* Rarity tag */}
                <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, fontWeight: 700, color: r.text, background: r.bg, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  {r.label}
                </div>
                <div style={{ fontSize: 40, marginBottom: 10 }}>{item.emoji}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: t.text || '#333' }}>{item.name}</div>
                <div style={{ fontSize: 11, color: t.textSecondary || '#888', marginTop: 2, marginBottom: 10 }}>{item.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: canBuy ? '#22c55e' : (t.textMuted || '#999') }}>${item.price}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: canBuy ? '#003478' : (t.textMuted || '#999'), background: canBuy ? 'rgba(0,52,120,.08)' : 'transparent', padding: '4px 12px', borderRadius: 8 }}>
                    {canBuy ? 'Comprar' : 'Sin saldo'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* How to earn */}
        <div style={{ marginTop: 24, padding: 18, background: t.card || '#fff', border: '1px solid ' + (t.cardBorder || '#e0e0e0'), borderRadius: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.text || '#333', marginBottom: 8 }}>Como ganar plata?</div>
          <div style={{ fontSize: 12, color: t.textSecondary || '#888', lineHeight: 1.8 }}>
            Cada venta que registres te da <strong style={{ color: '#22c55e' }}>$50</strong> de saldo virtual.<br />
            Empezaste con <strong style={{ color: '#22c55e' }}>$900</strong> de regalo. Dale algo a Juan y mira su reaccion!
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes bounceIn { 0% { transform: scale(.3); opacity: 0 } 50% { transform: scale(1.1) } 100% { transform: scale(1); opacity: 1 } }
      `}</style>
    </div>
  );
}

export { ITEMS };
