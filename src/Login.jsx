import { useState, useEffect } from 'react';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('public');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStaffLogin = async () => {
    if (!user.trim() || !pass.trim()) { setError('Completa usuario y contraseña'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass }),
      });
      const data = await res.json();
      if (data.ok) {
        onLogin({ role: data.role, name: user.trim() || data.name });
      } else {
        setError('Usuario o contraseña incorrectos');
      }
    } catch (e) {
      setError('Error de conexion con el servidor');
    }
    setLoading(false);
  };

  const handlePublicEnter = () => {
    onLogin({ role: 'public', name: name.trim() || 'Cliente' });
  };

  const inputStyle = { width: '100%', padding: '12px 14px', fontSize: 15, border: '1px solid var(--fw-cardBorder, #ddd)', borderRadius: 8, background: 'var(--fw-inputBg, #fafafa)', color: 'var(--fw-text, #333)', outline: 'none', fontFamily: 'inherit', marginBottom: 14, transition: 'border .2s' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fw-bg, #fff)', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ background: '#003478', padding: '10px 0', textAlign: 'center' }}>
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>Repuestos Originales Ford — La Ford de Warnes</span>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 42, background: '#003478', borderRadius: 24, marginBottom: 12 }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 22, fontStyle: 'italic', fontFamily: 'Georgia,serif' }}>Ford</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#1a1a1a', margin: '0 0 4px' }}>La Ford de Warnes</h1>
            <p style={{ color: 'var(--fw-textSecondary, #888)', fontSize: 14 }}>Repuestos y Partes — Stock disponible</p>
          </div>

          <div style={{ display: 'flex', borderBottom: '2px solid #e8e8e8' }}>
            {[{ id: 'public', label: 'Soy Cliente' }, { id: 'staff', label: 'Empleado / Admin' }].map(t => (
              <button key={t.id} onClick={() => { setMode(t.id); setError(''); }}
                style={{ flex: 1, background: 'none', border: 'none', borderBottom: mode === t.id ? '3px solid #003478' : '3px solid transparent', padding: '12px 0', fontSize: 14, fontWeight: mode === t.id ? 700 : 400, color: mode === t.id ? '#003478' : '#999', cursor: 'pointer', fontFamily: 'inherit', marginBottom: -2 }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ background: 'var(--fw-card, #fff)', border: '1px solid var(--fw-cardBorder, #e8e8e8)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '28px 24px', textAlign: 'left' }}>
            {mode === 'public' ? (
              <>
                <label style={{ fontSize: 13, color: 'var(--fw-textSecondary, #555)', marginBottom: 6, display: 'block', fontWeight: 500 }}>Tu nombre</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handlePublicEnter(); }}
                  placeholder="Ej: Carlos, Maria..." style={inputStyle} />
                <button onClick={handlePublicEnter}
                  style={{ width: '100%', padding: 14, fontSize: 15, fontWeight: 700, border: 'none', borderRadius: 8, background: '#003478', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Ver Catalogo y Precios
                </button>
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--fw-textMuted, #aaa)', marginTop: 12 }}>Acceso libre — sin cuenta necesaria</p>
              </>
            ) : (
              <>
                <label style={{ fontSize: 13, color: 'var(--fw-textSecondary, #555)', marginBottom: 6, display: 'block', fontWeight: 500 }}>Usuario</label>
                <input value={user} onChange={e => setUser(e.target.value)} placeholder="Tu nombre de usuario" style={inputStyle} />
                <label style={{ fontSize: 13, color: 'var(--fw-textSecondary, #555)', marginBottom: 6, display: 'block', fontWeight: 500 }}>Contraseña</label>
                <input type="password" value={pass} onChange={e => setPass(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleStaffLogin(); }}
                  placeholder="••••••••" style={inputStyle} />
                {error && <div style={{ color: '#d32f2f', fontSize: 13, marginBottom: 12, textAlign: 'center', fontWeight: 500 }}>{error}</div>}
                <button onClick={handleStaffLogin} disabled={loading}
                  style={{ width: '100%', padding: 14, fontSize: 15, fontWeight: 700, border: 'none', borderRadius: 8, background: loading ? '#666' : '#003478', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading && <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .6s linear infinite' }} />}
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '16px 0', borderTop: '1px solid #eee', color: 'var(--fw-textMuted, #bbb)', fontSize: 11 }}>
        La Ford de Warnes — Repuestos Ford Originales y Alternativos
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
