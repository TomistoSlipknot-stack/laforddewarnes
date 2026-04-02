import { useState, useEffect, useRef } from 'react';

// Publicidad / Autos nuevos (Juan sube estos)
const ADS = [
  // '/videos/ad1.mp4',  // Juan mandará videos de publicidad
  // '/videos/ad2.mp4',
];

// Música de fondo
const MUSIC = [
  '/videos/song1.mp4',
  '/videos/song2.mp4',
  '/videos/song3.mp4',
  '/videos/song4.mp4',
  '/videos/song5.mp4',
];

const SONGS = [...ADS, ...MUSIC];

export default function RadioVieja() {
  const [on, setOn] = useState(false);
  const [idx, setIdx] = useState(0);
  const [big, setBig] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [vol, setVol] = useState(0.7);
  const videoRef = useRef(null);

  const pick = () => {
    let n;
    do { n = Math.floor(Math.random() * SONGS.length); } while (n === idx && SONGS.length > 1);
    return n;
  };

  const toggle = () => {
    if (on) {
      setOn(false);
      if (videoRef.current) videoRef.current.pause();
    } else {
      setIdx(pick());
      setOn(true);
    }
  };

  const next = () => { setIdx(pick()); };

  // When song ends, go to next (no loop, no restart)
  const onEnded = () => { setIdx(pick()); };

  // Play when song changes
  useEffect(() => {
    if (on && videoRef.current) {
      videoRef.current.volume = vol;
      videoRef.current.play().catch(() => {});
    }
  }, [idx, on]);

  // Update volume on existing video
  const volUp = () => { const v = Math.min(1, vol + 0.15); setVol(v); if (videoRef.current) videoRef.current.volume = v; };
  const volDown = () => { const v = Math.max(0, vol - 0.15); setVol(v); if (videoRef.current) videoRef.current.volume = v; };

  const W = big ? 380 : 220;
  const btnSize = big ? 30 : 22;
  const btnStyle = (bg) => ({
    width: btnSize, height: btnSize, borderRadius: '50%',
    background: bg || 'radial-gradient(circle, #555, #333)',
    border: '2px solid #1a1206', cursor: 'pointer',
    fontSize: big ? 11 : 8, color: '#ddd',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  // Minimized: tiny bar
  if (minimized) {
    return (
      <div onClick={() => setMinimized(false)} style={{
        position: 'fixed', bottom: 12, left: 12, zIndex: 40, cursor: 'pointer',
        background: 'rgba(0,0,0,.85)', borderRadius: 10, padding: '6px 14px',
        display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(8px)',
      }} title="Abrir Ford TV">
        <span style={{ fontSize: 16 }}>📺</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: on ? '#fbbf24' : '#888' }}>{on ? '♪ FORD TV' : 'FORD TV'}</span>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: 14, left: 14, zIndex: 40, animation: 'tvPopIn .4s ease' }}>
      <div style={{
        width: W, background: 'linear-gradient(145deg, #8B6914, #5C4413, #3E2E0D)',
        borderRadius: 14, padding: big ? 14 : 8,
        boxShadow: on
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
          {on && (
            <video ref={videoRef} key={idx} src={SONGS[idx]} onEnded={onEnded}
              autoPlay playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}

          {/* CRT scanlines */}
          {on && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(transparent 50%, rgba(0,0,0,.05) 50%)', backgroundSize: '100% 3px', zIndex: 2 }} />}

          {/* CRT vignette */}
          {on && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3, boxShadow: 'inset 0 0 40px rgba(0,0,0,.4)', borderRadius: 6 }} />}

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

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: big ? 10 : 6, padding: '0 2px' }}>
          {/* Power */}
          <button onClick={toggle} style={btnStyle(on ? 'radial-gradient(circle, #4ade80, #16a34a)' : undefined)}>
            <span style={{ color: '#fff' }}>⏻</span>
          </button>

          {/* Song title */}
          <div style={{ flex: 1, fontSize: big ? 11 : 8, fontWeight: 600, color: on ? '#fbbf24' : '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {on ? '♪ FORD TV' : 'FORD TV'}
          </div>

          {/* Vol down */}
          {on && <button onClick={volDown} style={btnStyle()}>🔉</button>}

          {/* Vol up */}
          {on && <button onClick={volUp} style={btnStyle()}>🔊</button>}

          {/* Next */}
          {on && <button onClick={next} style={btnStyle()}>⏭</button>}

          {/* Size */}
          <button onClick={() => setBig(!big)} style={btnStyle()}>{big ? '▾' : '▴'}</button>

          {/* Minimize */}
          <button onClick={() => setMinimized(true)} style={btnStyle()}>─</button>
        </div>
      </div>

      <style>{`
        @keyframes tvPopIn{from{opacity:0;transform:translateY(20px) scale(.9)}to{opacity:1;transform:translateY(0) scale(1)}}
      `}</style>
    </div>
  );
}
