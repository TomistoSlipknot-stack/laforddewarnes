import { useState, useEffect, useRef } from 'react';

const SONGS = [
  { id: 'NvS351QKFV4', title: 'Moskau' },
  { id: 'otna9Pe3jWg', title: 'Genghis Khan' },
  { id: 'nMjFEAaxaFc', title: 'Rocking Son' },
  { id: '2RMx-jPNzhA', title: 'Hadschi Halef Omar' },
  { id: 'kAO4EVMfLHs', title: 'Dschinghis Khan' },
  { id: 'Nl_Eos2Ql_4', title: 'Corrida' },
];

export default function RadioVieja() {
  const [on, setOn] = useState(false);
  const [song, setSong] = useState(null);
  const [glitch, setGlitch] = useState(false);
  const glitchRef = useRef(null);

  const pick = () => SONGS[Math.floor(Math.random() * SONGS.length)];

  // Random glitches
  useEffect(() => {
    if (!on) return;
    const go = () => {
      if (Math.random() < 0.3) { setGlitch(true); setTimeout(() => setGlitch(false), 300); }
      glitchRef.current = setTimeout(go, 8000 + Math.random() * 12000);
    };
    glitchRef.current = setTimeout(go, 6000);
    return () => clearTimeout(glitchRef.current);
  }, [on]);

  const toggle = () => {
    if (on) { setOn(false); setSong(null); }
    else { const s = pick(); setSong(s); setOn(true); }
  };

  const next = (e) => { e.stopPropagation(); setSong(pick()); };

  return (
    <>
      {/* Small TV icon in corner */}
      <div onClick={toggle} style={{
        position: 'fixed', bottom: 12, left: 12, zIndex: 50,
        cursor: 'pointer', textAlign: 'center',
      }}
        title={on ? 'Apagar TV' : 'Prender Ford TV'}>
        <img src="/img/tv-vieja.png" alt="TV" style={{
          width: 70, height: 58, objectFit: 'contain',
          filter: on ? 'drop-shadow(0 0 12px rgba(251,191,36,.5))' : 'brightness(0.7)',
          transition: 'all .2s',
        }} />
        <div style={{ fontSize: 7, color: on ? '#fbbf24' : 'rgba(255,255,255,.3)', fontWeight: 700 }}>
          {on ? '♪ FORD TV' : 'FORD TV'}
        </div>
      </div>

      {/* Full TV player overlay */}
      {on && song && (
        <div style={{
          position: 'fixed', bottom: 80, left: 12, zIndex: 51,
          width: 360, maxWidth: 'calc(100vw - 24px)',
          animation: 'tvPopIn .3s ease',
        }}>
          {/* Song info + controls */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,0,0,.9)', borderRadius: '10px 10px 0 0',
            padding: '8px 12px',
          }}>
            <span style={{ color: '#fbbf24', fontSize: 14 }}>♪</span>
            <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700, flex: 1 }}>{song.title}</span>
            <button onClick={next} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, padding: '4px 10px', borderRadius: 6, fontFamily: 'inherit' }}>⏭ Siguiente</button>
            <button onClick={toggle} style={{ background: 'rgba(239,68,68,.3)', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: 12, padding: '4px 10px', borderRadius: 6, fontFamily: 'inherit' }}>✕</button>
          </div>

          {/* Video screen */}
          <div style={{ position: 'relative', background: '#000', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
            {/* YouTube video - full controls so user can press play */}
            <iframe
              key={song.id}
              src={`https://www.youtube.com/embed/${song.id}?autoplay=1&loop=1&playlist=${song.id}&rel=0`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ width: '100%', height: 200, border: 'none', display: 'block' }}
              title="Ford TV"
            />

            {/* CRT scanlines */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
              background: 'linear-gradient(transparent 50%, rgba(0,0,0,.03) 50%)',
              backgroundSize: '100% 3px',
            }} />

            {/* Glitch */}
            {glitch && <div style={{
              position: 'absolute', inset: 0, zIndex: 3,
              background: 'repeating-linear-gradient(0deg,rgba(255,255,255,.1),rgba(255,255,255,.1) 1px,transparent 1px,transparent 3px)',
              animation: 'tvGlitch .08s steps(3) infinite',
            }} />}
          </div>
        </div>
      )}

      <style>{`
        @keyframes tvPopIn { from { opacity: 0; transform: translateY(20px) scale(.9) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes tvGlitch { 0%{opacity:.5;transform:translateX(-2px)} 50%{opacity:.8;transform:translateX(3px)} 100%{opacity:.6;transform:translateX(-1px)} }
      `}</style>
    </>
  );
}
