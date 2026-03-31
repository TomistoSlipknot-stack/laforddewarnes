import { useState, useEffect } from 'react';

const LIGHT = {
  bg: '#d5d5d5',
  card: '#fff',
  cardBorder: '#e0e0e0',
  text: '#333',
  textSecondary: '#777',
  textMuted: '#999',
  headerBg: '#fff',
  headerBorder: '#e0e0e0',
  inputBg: '#fafafa',
  inputBorder: '#ddd',
  accent: '#003478',
  accentLight: 'rgba(0,52,120,.06)',
  shadow: '0 1px 3px rgba(0,0,0,.04)',
  shadowHover: '0 4px 16px rgba(0,0,0,.08)',
};

const DARK = {
  bg: '#0f1117',
  card: '#1a1c24',
  cardBorder: '#2a2d38',
  text: '#e0deda',
  textSecondary: '#888',
  textMuted: '#555',
  headerBg: '#14161e',
  headerBorder: '#2a2d38',
  inputBg: '#1a1c24',
  inputBorder: '#2a2d38',
  accent: '#4d8eff',
  accentLight: 'rgba(77,142,255,.1)',
  shadow: '0 1px 3px rgba(0,0,0,.2)',
  shadowHover: '0 4px 16px rgba(0,0,0,.3)',
};

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem('ford-theme') === 'dark';
    } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('ford-theme', isDark ? 'dark' : 'light'); } catch {}

    // Apply CSS variables to body
    const t = isDark ? DARK : LIGHT;
    const root = document.documentElement;
    Object.entries(t).forEach(([key, val]) => {
      root.style.setProperty('--fw-' + key, val);
    });
    document.body.style.background = t.bg;
    document.body.style.color = t.text;
  }, [isDark]);

  return { isDark, toggle: () => setIsDark(d => !d), theme: isDark ? DARK : LIGHT };
}

export default function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      style={{
        background: isDark ? '#2a2d38' : '#fff',
        border: `2px solid ${isDark ? '#444' : '#d0d0d0'}`,
        borderRadius: 10,
        padding: '8px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 14,
        color: isDark ? '#fbbf24' : '#555',
        fontFamily: 'inherit',
        fontWeight: 500,
        transition: 'all .2s',
      }}
    >
      {isDark ? '☀️' : '🌙'}
      <span style={{ fontSize: 12 }}>{isDark ? 'Claro' : 'Oscuro'}</span>
    </button>
  );
}
