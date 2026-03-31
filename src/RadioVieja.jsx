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
      const b = c.createBuffer(1, c.sampleRate * 0.25, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.06 * (1 - i / d.length);
      const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start();
      s.onended = () => c.close();
    } catch {}
  };

  useEffect(() => {
    if (!on) return;
    const go = () => {
      if (Math.random() < 0.25) {
        setGlitch(true); buzz();
        if (videoRef.current) videoRef.current.volume = 0;
        setTimeout(() => { setGlitch(false); if (videoRef.current) videoRef.current.volume = 1; }, 200 + Math.random() * 300);
      }
      glitchRef.current = setTimeout(go, 8000 + Math.random() * 12000);
    };
    glitchRef.current = setTimeout(go, 5000);
    return () => clearTimeout(glitchRef.current);
  }, [on]);

  const toggle = () => {
    if (on) { setOn(false); if (videoRef.current) videoRef.current.pause(); }
    else { buzz(); setIdx(pick()); setOn(true); }
  };

  const next = () => { buzz(); setGlitch(true); setTimeout(() => { setIdx(pick()); setGlitch(false); }, 350); };
  const onEnded = () => { buzz(); setGlitch(true); setTimeout(() => { setIdx(pick()); setGlitch(false); }, 350); };

  useEffect(() => { if (on && videoRef.current) videoRef.current.play().catch(() => {}); }, [idx, on]);

  const W = big ? 380 : 220;

  return (
    <div style={{ position: 'fixed', bottom: 14, left: 14, zIndex: 50, animation: 'tvPopIn .4s ease' }}>
      {/* CSS TV */}
      <div style={{
        width: W, background: 'linear-gradient(145deg, #8B6914, #5C4413, #3E2E0D)',
        borderRadius: 14, padding: big ? 14 : 8, boxShadow: on
          ? '0 0 30px rgba(200,180,100,.3), inset 0 1px 0 rgba(255,255,255,.15)'
          : '0 4px 16px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.1)',
        border: '2px solid #2E1F06', transition: 'width .3s, padding .3s',
      }}>
        {/* Screen */}
        <div style={{
          background: '#0a0a0a', borderRadius: 8, overflow: 'hidden', position: 'relative',
          aspectRatio: '4/3', border: '3px solid #1a1206',
          boxShadow: on ? 'inset 0 0 20px rgba(100,200,255,.08)' : 'inset 0 0 20px rgba(0,0,0,.5)',
        }}>
          {on && !glitch && (
            <video ref={videoRef} key={idx} src={SONGS[idx].file} onEnded={onEnded}
              autoPlay playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}

          {/* CRT scanlines */}
          {on && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(transparent 50%, rgba(0,0,0,.05) 50%)', backgroundSize: '100% 3px', zIndex: 2 }} />}

          {/* CRT vignette */}
          {on && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3, boxShadow: 'inset 0 0 40px rgba(0,0,0,.4)', borderRadius: 6 }} />}

          {/* Glitch */}
          {glitch && <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: 'repeating-linear-gradient(0deg,rgba(255,255,255,.12) 0px,rgba(255,255,255,.12) 1px,transparent 1px,transparent 3px)', animation: 'tvGlitch .06s steps(4) infinite' }} />}

          {/* Off screen */}
          {!on && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={toggle}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: big ? 28 : 18, marginBottom: 4 }}>📺</div>
                <div style={{ fontSize: big ? 11 : 8, color: '#444', fontWeight: 600 }}>CLICK PARA PRENDER</div>
              </div>
            </div>
          )}
        </div>

        {/* Controls bar - below screen */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: big ? 10 : 6,
          padding: '0 2px',
        }}>
          {/* Power button */}
          <button onClick={toggle} style={{
            width: big ? 32 : 24, height: big ? 32 : 24, borderRadius: '50%',
            background: on
              ? 'radial-gradient(circle, #4ade80, #16a34a)'
              : 'radial-gradient(circle, #666, #333)',
            border: '2px solid #1a1206', cursor: 'pointer',
            boxShadow: on ? '0 0 8px rgba(34,197,94,.5)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: big ? 12 : 9, color: '#fff',
          }}>⏻</button>

          {/* Song title */}
          <div style={{
            flex: 1, fontSize: big ? 11 : 9, fontWeight: 600,
            color: on ? '#fbbf24' : '#555', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {on ? '♪ ' + SONGS[idx].title : 'FORD TV'}
          </div>

          {/* Next */}
          {on && <button onClick={next} style={{
            width: big ? 28 : 22, height: big ? 28 : 22, borderRadius: '50%',
            background: 'radial-gradient(circle, #555, #333)',
            border: '2px solid #1a1206', cursor: 'pointer',
            fontSize: big ? 10 : 8, color: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>⏭</button>}

          {/* Size */}
          <button onClick={() => setBig(!big)} style={{
            width: big ? 28 : 22, height: big ? 28 : 22, borderRadius: '50%',
            background: 'radial-gradient(circle, #555, #333)',
            border: '2px solid #1a1206', cursor: 'pointer',
            fontSize: big ? 10 : 8, color: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{big ? '▾' : '▴'}</button>
        </div>
      </div>

      <style>{`
        @keyframes tvPopIn{from{opacity:0;transform:translateY(20px) scale(.9)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes tvGlitch{0%{transform:translateX(-3px)}33%{transform:translateX(4px)}66%{transform:translateX(-2px)}100%{transform:translateX(1px)}}
      `}</style>
    </div>
  );
}
