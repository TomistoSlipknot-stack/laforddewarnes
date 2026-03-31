import { useState, useEffect, useRef } from 'react';

const SONGS = [
  { file: '/videos/song1.mp4', title: 'Dschinghis Khan' },
  { file: '/videos/song2.mp4', title: 'Dschinghis Khan II' },
  { file: '/videos/song3.mp4', title: 'Another Song' },
  { file: '/videos/song4.mp4', title: 'Dschinghis Khan (ZDF 1979)' },
];

export default function RadioVieja() {
  const [on, setOn] = useState(false);
  const [idx, setIdx] = useState(0);
  const [glitch, setGlitch] = useState(false);
  const [big, setBig] = useState(false);
  const videoRef = useRef(null);
  const glitchRef = useRef(null);

  const pick = () => Math.floor(Math.random() * SONGS.length);

  const buzz = () => {
    try {
      const c = new (window.AudioContext || window.webkitAudioContext)();
      const b = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.07 * (1 - i / d.length);
      const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start();
      s.onended = () => c.close();
    } catch {}
  };

  // Random glitches
  useEffect(() => {
    if (!on) return;
    const go = () => {
      if (Math.random() < 0.3) {
        setGlitch(true); buzz();
        // Briefly mute video during glitch
        if (videoRef.current) videoRef.current.volume = 0;
        setTimeout(() => {
          setGlitch(false);
          if (videoRef.current) videoRef.current.volume = 1;
        }, 200 + Math.random() * 300);
      }
      glitchRef.current = setTimeout(go, 8000 + Math.random() * 12000);
    };
    glitchRef.current = setTimeout(go, 6000);
    return () => clearTimeout(glitchRef.current);
  }, [on]);

  const toggle = () => {
    if (on) {
      setOn(false);
      if (videoRef.current) videoRef.current.pause();
    } else {
      buzz();
      const i = pick();
      setIdx(i);
      setOn(true);
    }
  };

  const next = (e) => {
    e.stopPropagation();
    buzz();
    setGlitch(true);
    setTimeout(() => {
      setIdx(pick());
      setGlitch(false);
    }, 400);
  };

  // Auto-play next when video ends
  const onEnded = () => {
    buzz();
    setGlitch(true);
    setTimeout(() => { setIdx(pick()); setGlitch(false); }, 400);
  };

  // Auto-play when song changes
  useEffect(() => {
    if (on && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [idx, on]);

  const W = big ? 360 : 200;
  const H = big ? 295 : 164;

  return (
    <div style={{ position: 'fixed', bottom: 12, left: 12, zIndex: 50 }}>
      {/* Controls */}
      {on && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
          background: 'rgba(0,0,0,.9)', borderRadius: 8, padding: '5px 10px', width: W,
          animation: 'tvPopIn .3s ease',
        }}>
          <span style={{ color: '#22c55e', fontSize: 8, animation: 'blink 1s infinite' }}>●</span>
          <span style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {SONGS[idx].title}
          </span>
          <button onClick={next} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 10, padding: '3px 8px', borderRadius: 5 }}>⏭</button>
          <button onClick={(e) => { e.stopPropagation(); setBig(!big); }} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 10, padding: '3px 8px', borderRadius: 5 }}>{big ? '▼' : '▲'}</button>
          <button onClick={toggle} style={{ background: 'rgba(239,68,68,.2)', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: 10, padding: '3px 8px', borderRadius: 5 }}>✕</button>
        </div>
      )}

      {/* TV */}
      <div onClick={!on ? toggle : undefined} style={{
        width: W, height: H, position: 'relative',
        cursor: !on ? 'pointer' : 'default',
        transition: 'width .3s, height .3s',
      }}
        title={on ? '' : 'Click para prender Ford TV'}>

        {/* TV frame as background */}
        <img src="/img/tv-vieja.png" alt="TV" style={{
          width: '100%', height: '100%', objectFit: 'contain',
          position: 'relative', zIndex: 1,
        }} />

        {/* Video ON TOP of the TV image, covering the screen area */}
        {on && (
          <video
            ref={videoRef}
            key={idx}
            src={SONGS[idx].file}
            onEnded={onEnded}
            autoPlay
            playsInline
            style={{
              position: 'absolute',
              left: '10%', top: '13%', width: '55%', height: '62%',
              objectFit: 'cover', borderRadius: 6, zIndex: 10,
              background: '#000',
            }}
          />
        )}

        {/* CRT scanlines on top of video */}
        {on && (
          <div style={{
            position: 'absolute', left: '10%', top: '13%', width: '55%', height: '62%',
            zIndex: 11, pointerEvents: 'none', borderRadius: 5,
            background: 'linear-gradient(transparent 50%, rgba(0,0,0,.06) 50%)',
            backgroundSize: '100% 3px',
          }} />
        )}

        {/* Glitch on top of everything */}
        {glitch && (
          <div style={{
            position: 'absolute', left: '10%', top: '13%', width: '55%', height: '62%',
            zIndex: 12, borderRadius: 5,
            background: 'repeating-linear-gradient(0deg,rgba(255,255,255,.15) 0px,rgba(255,255,255,.15) 1px,transparent 1px,transparent 3px)',
            animation: 'tvGlitch .06s steps(4) infinite',
          }} />
        )}

        {/* Power LED */}
        {on && <div style={{
          position: 'absolute', bottom: '13%', right: '17%',
          width: 4, height: 4, borderRadius: '50%',
          background: '#22c55e', boxShadow: '0 0 6px #22c55e', zIndex: 13,
        }} />}
      </div>

      {!on && <div style={{ textAlign: 'center', fontSize: 7, color: 'rgba(255,255,255,.3)', fontWeight: 600, marginTop: 1 }}>FORD TV</div>}

      <style>{`
        @keyframes tvPopIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes tvGlitch{0%{transform:translateX(-3px)}33%{transform:translateX(4px)}66%{transform:translateX(-2px)}100%{transform:translateX(1px)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
      `}</style>
    </div>
  );
}
