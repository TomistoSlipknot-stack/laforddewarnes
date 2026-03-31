import { useState } from 'react';

const SONGS = [
  { id: 'NvS351QKFV4', title: 'Moskau' },
  { id: 'otna9Pe3jWg', title: 'Genghis Khan' },
  { id: 'nMjFEAaxaFc', title: 'Rocking Son' },
  { id: '2RMx-jPNzhA', title: 'Hadschi Halef Omar' },
  { id: 'kAO4EVMfLHs', title: 'Dschinghis Khan' },
  { id: 'Nl_Eos2Ql_4', title: 'Corrida' },
];

export default function RadioVieja() {
  const [playing, setPlaying] = useState(false);
  const [song, setSong] = useState(null);
  const [showStatic, setShowStatic] = useState(false);

  const playStaticSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.1 * (1 - i / d.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
      src.onended = () => ctx.close();
    } catch {}
  };

  const pick = () => SONGS[Math.floor(Math.random() * SONGS.length)];

  const toggle = () => {
    if (playing) {
      setPlaying(false);
      setSong(null);
    } else {
      setShowStatic(true);
      playStaticSound();
      setTimeout(() => {
        setShowStatic(false);
        setSong(pick());
        setPlaying(true);
      }, 600);
    }
  };

  const next = (e) => {
    e.stopPropagation();
    setShowStatic(true);
    playStaticSound();
    setTimeout(() => { setShowStatic(false); setSong(pick()); }, 400);
  };

  return (
    <div style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {playing && song && (
        <div style={{ background: 'rgba(0,0,0,.85)', borderRadius: 10, padding: '6px 12px', fontSize: 11, color: '#fbbf24', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, maxWidth: 180 }}>
          <span>♪</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{song.title}</span>
          <button onClick={next} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>⏭</button>
        </div>
      )}

      {showStatic && <div style={{ position: 'absolute', bottom: 0, left: 0, width: 90, height: 75, borderRadius: 8, zIndex: 3, background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,.06) 2px,rgba(255,255,255,.06) 4px)', animation: 'static-flicker .08s linear infinite' }} />}

      {/* Radio clickable area */}
      <div onClick={toggle} style={{ width: 90, height: 75, cursor: 'pointer', position: 'relative', transition: 'transform .2s', filter: playing ? 'drop-shadow(0 0 14px rgba(251,191,36,.6))' : 'none' }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        title={playing ? 'Apagar radio' : 'Prender radio'}>
        <img src="/img/radio.png" alt="Radio" style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'relative', zIndex: 2 }} />
        {/* YouTube player hidden behind the radio image */}
        {playing && song && (
          <iframe
            key={song.id + Date.now()}
            src={`https://www.youtube.com/embed/${song.id}?autoplay=1&loop=1&playlist=${song.id}&controls=0&modestbranding=1&rel=0`}
            allow="autoplay; encrypted-media"
            style={{ position: 'absolute', top: 5, left: 5, width: 80, height: 50, border: 'none', borderRadius: 6, zIndex: 1, opacity: 0.01 }}
            title="radio"
          />
        )}
        {playing && <div style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', zIndex: 3 }} />}
      </div>

      <div style={{ fontSize: 8, color: 'rgba(255,255,255,.4)', fontWeight: 600 }}>{playing ? 'ON' : 'RADIO'}</div>

      <style>{`@keyframes static-flicker{0%{opacity:.8}50%{opacity:.2}100%{opacity:.7}}`}</style>
    </div>
  );
}
