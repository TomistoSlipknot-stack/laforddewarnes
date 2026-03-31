import { useState, useRef, useEffect } from 'react';

// Dschinghis Khan songs - YouTube video IDs
const SONGS = [
  { id: 'NvS351QKFV4', title: 'Moskau' },
  { id: 'otna9Pe3jWg', title: 'Genghis Khan' },
  { id: 'nMjFEAaxaFc', title: 'Rocking Son of Dschinghis Khan' },
  { id: '2RMx-jPNzhA', title: 'Hadschi Halef Omar' },
  { id: 'kAO4EVMfLHs', title: 'Dschinghis Khan' },
  { id: 'Nl_Eos2Ql_4', title: 'Corrida' },
];

export default function RadioVieja() {
  const [playing, setPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [showStatic, setShowStatic] = useState(false);
  const [glow, setGlow] = useState(false);
  const playerRef = useRef(null);
  const staticAudioRef = useRef(null);

  // Generate static noise using Web Audio API
  const playStaticSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const bufferSize = ctx.sampleRate * 0.8;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (i < bufferSize * 0.3 ? 0.15 : 0.15 * (1 - i / bufferSize));
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 3000;
      filter.Q.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.value = 0.3;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      source.onended = () => ctx.close();
    } catch (e) { /* ignore */ }
  };

  const toggle = () => {
    if (playing) {
      // Turn off
      setPlaying(false);
      setCurrentSong(null);
      setGlow(false);
      if (playerRef.current) {
        playerRef.current.src = '';
      }
    } else {
      // Turn on with static effect
      setShowStatic(true);
      playStaticSound();
      setTimeout(() => {
        setShowStatic(false);
        const song = SONGS[Math.floor(Math.random() * SONGS.length)];
        setCurrentSong(song);
        setPlaying(true);
        setGlow(true);
      }, 800);
    }
  };

  const nextSong = () => {
    if (!playing) return;
    setShowStatic(true);
    playStaticSound();
    setTimeout(() => {
      setShowStatic(false);
      const song = SONGS[Math.floor(Math.random() * SONGS.length)];
      setCurrentSong(song);
    }, 600);
  };

  return (
    <div style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {/* Now playing label */}
      {playing && currentSong && (
        <div style={{
          background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)',
          borderRadius: 10, padding: '6px 14px', marginBottom: 4,
          fontSize: 11, color: '#fbbf24', fontWeight: 600, fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 6, maxWidth: 180,
          animation: 'fadeIn .3s ease',
        }}>
          <span style={{ animation: 'pulse-dot 1s ease infinite' }}>♪</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentSong.title}</span>
          <button onClick={nextSong} title="Siguiente" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, padding: 0, marginLeft: 4 }}>⏭</button>
        </div>
      )}

      {/* Static overlay */}
      {showStatic && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 8, zIndex: 2,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,.03) 2px, rgba(255,255,255,.03) 4px)',
          animation: 'static-flicker .1s linear infinite',
        }} />
      )}

      {/* Radio image */}
      <div onClick={toggle} style={{
        width: 80, height: 65, cursor: 'pointer', position: 'relative',
        transition: 'transform .2s',
        filter: glow ? 'drop-shadow(0 0 12px rgba(251,191,36,.5))' : 'none',
      }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        title={playing ? 'Click para apagar' : 'Click para prender la radio'}
      >
        <img src="/img/radio.png" alt="Radio" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        {/* Power indicator */}
        {playing && <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
          boxShadow: '0 0 8px #22c55e', animation: 'pulse-dot 2s ease infinite',
        }} />}
      </div>

      <div style={{ fontSize: 8, color: 'rgba(255,255,255,.4)', fontWeight: 600, letterSpacing: '.5px' }}>
        {playing ? 'ON' : 'RADIO'}
      </div>

      {/* Hidden YouTube iframe */}
      {playing && currentSong && (
        <iframe
          ref={playerRef}
          src={`https://www.youtube.com/embed/${currentSong.id}?autoplay=1&loop=1&playlist=${currentSong.id}`}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
          allow="autoplay"
          title="radio"
        />
      )}

      <style>{`
        @keyframes static-flicker { 0% { opacity: .8 } 50% { opacity: .3 } 100% { opacity: .7 } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
