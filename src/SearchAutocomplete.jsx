import { useState, useRef, useEffect } from 'react';

export default function SearchAutocomplete({ onSearch, onSelect, allProducts, theme }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [show, setShow] = useState(false);
  const inputRef = useRef(null);
  const t = theme || {};

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    // Deduplicate by part number
    const unique = [...new Map(allProducts.map(p => [p.numero_parte, p])).values()];
    const q = query.toLowerCase();
    const matches = unique.filter(p =>
      (p.nombre && p.nombre.toLowerCase().includes(q)) ||
      (p.numero_parte && p.numero_parte.toLowerCase().includes(q)) ||
      (p.cat && p.cat.toLowerCase().includes(q))
    ).slice(0, 8);
    setSuggestions(matches);
    setShow(matches.length > 0);
  }, [query, allProducts]);

  const handleSelect = (item) => {
    setQuery(item.nombre);
    setShow(false);
    onSelect(item);
  };

  const handleSearch = () => {
    setShow(false);
    onSearch(query);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: t.card || '#fff', border: '2px solid ' + (t.cardBorder || '#e0e0e0'),
        borderRadius: 12, padding: '0 14px', transition: 'border .2s',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.textMuted || '#999'} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setShow(true); }}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          onFocus={() => suggestions.length > 0 && setShow(true)}
          placeholder="Buscar pieza, numero de parte o modelo..."
          style={{
            flex: 1, border: 'none', outline: 'none', padding: '14px 0',
            fontSize: 15, fontFamily: 'inherit', background: 'transparent',
            color: t.text || '#333',
          }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setSuggestions([]); }} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 18 }}>✕</button>
        )}
        <button onClick={handleSearch} style={{
          background: '#003478', border: 'none', borderRadius: 8, padding: '8px 16px',
          color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        }}>Buscar</button>
      </div>

      {/* Autocomplete dropdown */}
      {show && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: t.card || '#fff', border: '1px solid ' + (t.cardBorder || '#e0e0e0'),
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 100,
          maxHeight: 350, overflowY: 'auto',
        }}>
          {suggestions.map((item, i) => (
            <div key={item.numero_parte || i}
              onClick={() => handleSelect(item)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid ' + (t.cardBorder || '#eee') : 'none',
                transition: 'background .1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = t.accentLight || '#f0f4ff'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {item.foto && <img src={item.foto} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4, background: '#f5f5f5' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text || '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</div>
                <div style={{ fontSize: 10, color: t.textSecondary || '#888' }}>{item.cat} · {item.numero_parte}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text || '#333', flexShrink: 0 }}>{item.precio}</div>
            </div>
          ))}
        </div>
      )}

      {/* Click outside to close */}
      {show && <div onClick={() => setShow(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />}
    </div>
  );
}
