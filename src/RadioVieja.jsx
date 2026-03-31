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
  const [staticOn, setStaticOn] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const [big, setBig] = useState(false);
  const glitchRef = useRef(null);

  const pick = () => SONGS[Math.floor(Math.random() * SONGS.length)];

  const buzz = () => {
    try {
      const c = new (window.AudioContext || window.webkitAudioContext)();
      const b = c.createBuffer(1, c.sampleRate * 0.4, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.08 * (1 - i / d.length);
      const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start();
      s.onended = () => c.close();
    } catch {}
  };

  // Random glitches
  useEffect(() => {
    if (!on) return;
    const go = () => {
      if (Math.random() < 0.25) { setGlitch(true); buzz(); setTimeout(() => setGlitch(false), 200 + Math.random() * 300); }
      glitchRef.current = setTimeout(go, 10000 + Math.random() * 15000);
    };
    glitchRef.current = setTimeout(go, 8000);
    return () => clearTimeout(glitchRef.current);
  }, [on]);

  const toggle = () => {
    if (on) { setOn(false); setSong(null); }
    else { setStaticOn(true); buzz(); setTimeout(() => { setStaticOn(false); setSong(pick()); setOn(true); }, 700); }
  };

  const next = (e) => {
    e.stopPropagation();
    setStaticOn(true); buzz();
    setTimeout(() => { setStaticOn(false); setSong(pick()); }, 400);
  };

  const W = big ? 340 : 180;
  const H = big ? 280 : 148;

  return (
    <div style={{ position: 'fixed', bottom: 12, left: 12, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Controls */}
      {on && song && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, background: 'rgba(0,0,0,.85)', borderRadius: 8, padding: '5px 10px', maxWidth: W }}>
          <span style={{ color: '#fbbf24', fontSize: 12 }}>♪</span>
          <span style={{ color: '#fbbf24', fontSize: 10, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</span>
          <button onClick={next} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>⏭</button>
          <button onClick={(e) => { e.stopPropagation(); setBig(!big); }} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>{big ? '▼' : '▲'}</button>
        </div>
      )}

      {/* TV container */}
      <div style={{ width: W, height: H, position: 'relative', cursor: !on ? 'pointer' : 'default', transition: 'all .3s' }}
        onClick={!on ? toggle : undefined}
        title={on ? '' : 'Click para prender la tele'}>

        {/* 1. Black background for screen area */}
        <div style={{
          position: 'absolute', left: '7%', top: '8%', width: '63%', height: '74%',
          background: '#0a0a0a', borderRadius: 4, zIndex: 1,
        }} />

        {/* 2. YouTube video on screen */}
        {on && song && !glitch && (
          <iframe
            key={song.id}
            src={`https://www.youtube.com/embed/${song.id}?autoplay=1&loop=1&playlist=${song.id}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3`}
            allow="autoplay; encrypted-media"
            style={{
              position: 'absolute', left: '9%', top: '11%', width: '59%', height: '67%',
              border: 'none', borderRadius: 2, zIndex: 2,
            }}
            title="Ford TV"
          />
        )}

        {/* 3. Static/glitch overlay on screen */}
        {(staticOn || glitch) && (
          <div style={{
            position: 'absolute', left: '7%', top: '8%', width: '63%', height: '74%',
            zIndex: 4, borderRadius: 4, overflow: 'hidden',
            background: 'repeating-linear-gradient(0deg,rgba(200,200,200,.15),rgba(200,200,200,.15) 1px,rgba(0,0,0,.2) 1px,rgba(0,0,0,.2) 2px)',
            animation: 'tvStatic .06s steps(4) infinite',
          }} />
        )}

        {/* 4. CRT scanlines (always when on) */}
        {on && (
          <div style={{
            position: 'absolute', left: '7%', top: '8%', width: '63%', height: '74%',
            zIndex: 3, pointerEvents: 'none', borderRadius: 4,
            background: 'linear-gradient(transparent 50%, rgba(0,0,0,.04) 50%)',
            backgroundSize: '100% 3px',
          }} />
        )}

        {/* 5. TV frame image ON TOP of everything */}
        <img src="/img/tv-vieja.png" alt="TV" style={{
          width: '100%', height: '100%', objectFit: 'contain',
          position: 'relative', zIndex: 5, pointerEvents: 'none',
        }} />

        {/* Power light */}
        {on && <div style={{ position: 'absolute', bottom: '14%', right: '18%', width: 5, height: 5, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', zIndex: 6 }} />}
      </div>

      <div style={{ fontSize: 7, color: 'rgba(255,255,255,.3)', fontWeight: 600, marginTop: 2 }}>
        {on ? 'FORD TV' : 'CLICK PARA PRENDER'}
      </div>

      <style>{`@keyframes tvStatic{0%{opacity:.7}25%{opacity:.9}50%{opacity:.5}75%{opacity:.8}100%{opacity:.6}}`}</style>
    </div>
  );
}
