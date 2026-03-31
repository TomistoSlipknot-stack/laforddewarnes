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
  const [expanded, setExpanded] = useState(false);
  const glitchTimer = useRef(null);

  const pick = () => SONGS[Math.floor(Math.random() * SONGS.length)];

  const playStatic = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.08 * (1 - i / d.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
      src.onended = () => ctx.close();
    } catch {}
  };

  // Random glitches while playing
  useEffect(() => {
    if (!on) return;
    const doGlitch = () => {
      if (Math.random() < 0.3) {
        setGlitch(true);
        playStatic();
        setTimeout(() => setGlitch(false), 200 + Math.random() * 400);
      }
      glitchTimer.current = setTimeout(doGlitch, 8000 + Math.random() * 15000);
    };
    glitchTimer.current = setTimeout(doGlitch, 10000);
    return () => clearTimeout(glitchTimer.current);
  }, [on]);

  const toggle = () => {
    if (on) {
      setOn(false);
      setSong(null);
      setExpanded(false);
    } else {
      setStaticOn(true);
      playStatic();
      setTimeout(() => {
        setStaticOn(false);
        setSong(pick());
        setOn(true);
      }, 800);
    }
  };

  const next = (e) => {
    e.stopPropagation();
    setStaticOn(true);
    playStatic();
    setTimeout(() => { setStaticOn(false); setSong(pick()); }, 500);
  };

  // TV dimensions - the screen area is roughly centered-left in the image
  const tvW = expanded ? 320 : 160;
  const tvH = expanded ? 260 : 130;
  // Screen position relative to TV (approximate for this image)
  const screenLeft = '7%';
  const screenTop = '11%';
  const screenW = '64%';
  const screenH = '70%';

  return (
    <div style={{ position: 'fixed', bottom: 12, left: 12, zIndex: 50 }}>
      {/* Song title + controls */}
      {on && song && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, background: 'rgba(0,0,0,.85)', borderRadius: 8, padding: '4px 10px', maxWidth: tvW }}>
          <span style={{ color: '#fbbf24', fontSize: 12 }}>♪</span>
          <span style={{ color: '#fbbf24', fontSize: 10, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</span>
          <button onClick={next} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>⏭</button>
          <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>{expanded ? '▼' : '▲'}</button>
        </div>
      )}

      {/* TV */}
      <div onClick={!on ? toggle : undefined} style={{
        width: tvW, height: tvH, position: 'relative', cursor: !on ? 'pointer' : 'default',
        transition: 'all .3s ease',
        filter: on ? 'drop-shadow(0 0 15px rgba(200,200,255,.3))' : 'brightness(0.8)',
      }}
        onMouseEnter={e => { if (!on) e.currentTarget.style.filter = 'brightness(1.1)'; }}
        onMouseLeave={e => { if (!on) e.currentTarget.style.filter = 'brightness(0.8)'; }}
        title={on ? '' : 'Click para prender la tele'}
      >
        {/* TV frame image */}
        <img src="/img/tv-vieja.png" alt="TV" style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'relative', zIndex: 2, pointerEvents: 'none' }} />

        {/* Screen area - YouTube video inside */}
        <div style={{
          position: 'absolute', left: screenLeft, top: screenTop, width: screenW, height: screenH,
          zIndex: 1, overflow: 'hidden', borderRadius: 4, background: '#111',
        }}>
          {on && song && !staticOn && !glitch && (
            <iframe
              key={song.id}
              src={`https://www.youtube.com/embed/${song.id}?autoplay=1&loop=1&playlist=${song.id}&controls=0&modestbranding=1&rel=0&showinfo=0`}
              allow="autoplay; encrypted-media"
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="TV"
            />
          )}

          {/* Static/glitch overlay */}
          {(staticOn || glitch) && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 5,
              background: `
                repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,.04) 1px, rgba(255,255,255,.04) 2px),
                repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,.02) 3px, rgba(0,0,0,.02) 4px)
              `,
              animation: 'tv-static .05s steps(3) infinite',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(transparent 50%, rgba(0,0,0,.15) 50%)',
                backgroundSize: '100% 3px',
                animation: 'tv-scanline 4s linear infinite',
              }} />
            </div>
          )}

          {/* CRT scanline effect always on when playing */}
          {on && !staticOn && !glitch && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
              background: 'linear-gradient(transparent 50%, rgba(0,0,0,.06) 50%)',
              backgroundSize: '100% 3px',
            }} />
          )}

          {/* Off state - dark screen */}
          {!on && (
            <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#333' }} />
            </div>
          )}
        </div>

        {/* Power indicator */}
        {on && <div style={{ position: 'absolute', bottom: '12%', right: '16%', width: 4, height: 4, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', zIndex: 3 }} />}
      </div>

      <div style={{ textAlign: 'center', fontSize: 7, color: 'rgba(255,255,255,.3)', fontWeight: 600, marginTop: 2 }}>
        {on ? 'FORD TV' : 'CLICK PARA PRENDER'}
      </div>

      <style>{`
        @keyframes tv-static { 0% { opacity: .6 } 25% { opacity: .9 } 50% { opacity: .5 } 75% { opacity: .8 } 100% { opacity: .7 } }
        @keyframes tv-scanline { from { transform: translateY(0) } to { transform: translateY(100%) } }
      `}</style>
    </div>
  );
}
