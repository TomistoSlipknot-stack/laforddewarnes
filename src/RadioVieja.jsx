import { useState, useRef, useEffect } from 'react';

const SONGS = [
  { id: 'NvS351QKFV4', title: 'Moskau' },
  { id: 'otna9Pe3jWg', title: 'Genghis Khan' },
  { id: 'nMjFEAaxaFc', title: 'Rocking Son of Dschinghis Khan' },
  { id: '2RMx-jPNzhA', title: 'Hadschi Halef Omar' },
  { id: 'kAO4EVMfLHs', title: 'Dschinghis Khan' },
  { id: 'Nl_Eos2Ql_4', title: 'Corrida' },
];

let ytReady = false;
let ytReadyCallbacks = [];
function loadYTApi() {
  if (window.YT && window.YT.Player) { ytReady = true; return; }
  if (document.getElementById('yt-api-script')) return;
  const tag = document.createElement('script');
  tag.id = 'yt-api-script';
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = () => {
    ytReady = true;
    ytReadyCallbacks.forEach(cb => cb());
    ytReadyCallbacks = [];
  };
}

function whenYTReady(cb) {
  if (ytReady) cb();
  else ytReadyCallbacks.push(cb);
}

export default function RadioVieja() {
  const [playing, setPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [showStatic, setShowStatic] = useState(false);
  const [glow, setGlow] = useState(false);
  const playerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => { loadYTApi(); }, []);

  const playStaticSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.12 * (1 - i / d.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
      src.onended = () => ctx.close();
    } catch {}
  };

  const destroyPlayer = () => {
    try { if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; } } catch {}
  };

  const playSong = (song) => {
    setCurrentSong(song);
    setPlaying(true);
    setGlow(true);

    whenYTReady(() => {
      destroyPlayer();
      // Create a tiny div for the player
      const div = document.createElement('div');
      div.id = 'yt-radio-player';
      if (containerRef.current) {
        const old = containerRef.current.querySelector('#yt-radio-player');
        if (old) old.remove();
        containerRef.current.appendChild(div);
      }
      playerRef.current = new window.YT.Player('yt-radio-player', {
        height: '1', width: '1',
        videoId: song.id,
        playerVars: { autoplay: 1, loop: 1, playlist: song.id, controls: 0 },
        events: {
          onStateChange: (e) => {
            // When video ends, play next random
            if (e.data === 0) {
              const next = SONGS[Math.floor(Math.random() * SONGS.length)];
              setCurrentSong(next);
              playerRef.current.loadVideoById(next.id);
            }
          }
        }
      });
    });
  };

  const toggle = () => {
    if (playing) {
      destroyPlayer();
      setPlaying(false);
      setCurrentSong(null);
      setGlow(false);
    } else {
      setShowStatic(true);
      playStaticSound();
      setTimeout(() => {
        setShowStatic(false);
        playSong(SONGS[Math.floor(Math.random() * SONGS.length)]);
      }, 700);
    }
  };

  const nextSong = (e) => {
    e.stopPropagation();
    if (!playing) return;
    setShowStatic(true);
    playStaticSound();
    setTimeout(() => {
      setShowStatic(false);
      const song = SONGS[Math.floor(Math.random() * SONGS.length)];
      setCurrentSong(song);
      try { playerRef.current.loadVideoById(song.id); } catch {}
    }, 500);
  };

  return (
    <div ref={containerRef} style={{ position: 'fixed', bottom: 16, left: 16, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {/* Now playing */}
      {playing && currentSong && (
        <div style={{
          background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(8px)',
          borderRadius: 10, padding: '6px 12px',
          fontSize: 11, color: '#fbbf24', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6, maxWidth: 180,
          animation: 'radioFadeIn .3s ease',
        }}>
          <span style={{ fontSize: 14 }}>♪</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{currentSong.title}</span>
          <button onClick={nextSong} title="Siguiente" style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>⏭</button>
        </div>
      )}

      {/* Static overlay */}
      {showStatic && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, width: 80, height: 65, borderRadius: 8, zIndex: 2,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,.05) 2px, rgba(255,255,255,.05) 4px)',
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
        {playing && <div style={{
          position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
          width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
          boxShadow: '0 0 8px #22c55e',
        }} />}
      </div>

      <div style={{ fontSize: 8, color: 'rgba(255,255,255,.4)', fontWeight: 600, letterSpacing: '.5px' }}>
        {playing ? 'ON' : 'RADIO'}
      </div>

      <style>{`
        @keyframes static-flicker { 0% { opacity: .8 } 50% { opacity: .3 } 100% { opacity: .7 } }
        @keyframes radioFadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
