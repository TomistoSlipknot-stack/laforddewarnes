import { useState } from 'react';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('public'); // 'public' | 'staff'
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStaffLogin = async () => {
    if (!pass.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass }),
      });
      const data = await res.json();
      if (data.ok) {
        onLogin({ role: data.role, name: data.name });
      } else {
        setError('Contraseña incorrecta');
      }
    } catch (e) {
      setError('Error de conexión');
    }
    setLoading(false);
  };

  const handlePublicEnter = () => {
    onLogin({ role: 'public', name: name.trim() || 'Cliente' });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#08090c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ width: 72, height: 38, background: 'linear-gradient(135deg,#003da5,#0058e6)', borderRadius: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,61,165,.4)' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 20, fontStyle: 'italic', fontFamily: 'Georgia,serif' }}>Ford</span>
          </div>
          <h1 style={{ color: '#e0deda', fontSize: 24, fontWeight: 700, margin: '12px 0 4px', letterSpacing: '-.02em' }}>Ford de Warnes</h1>
          <p style={{ color: '#444860', fontSize: 13 }}>Stock y Partes — Repuestos Ford</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
          {[{ id: 'public', label: 'Soy Cliente' }, { id: 'staff', label: 'Staff / Admin' }].map(t => (
            <button key={t.id} onClick={() => { setMode(t.id); setError(''); }}
              style={{ background: mode === t.id ? '#003da5' : 'transparent', border: `1px solid ${mode === t.id ? '#1a5cc8' : '#1c2030'}`, borderRadius: 10, padding: '8px 20px', fontSize: 14, color: mode === t.id ? '#fff' : '#555870', cursor: 'pointer', fontFamily: 'inherit', fontWeight: mode === t.id ? 600 : 400, transition: 'all .15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Forms */}
        <div style={{ background: '#0f1018', border: '1px solid #1c2030', borderRadius: 16, padding: '28px 24px', textAlign: 'left' }}>
          {mode === 'public' ? (
            <>
              <label style={{ fontSize: 12, color: '#666', marginBottom: 6, display: 'block' }}>Tu nombre (opcional)</label>
              <input value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handlePublicEnter(); }}
                placeholder="Ej: Carlos, María..."
                style={{ width: '100%', padding: '12px 16px', fontSize: 15, border: '1px solid #1c2030', borderRadius: 10, background: '#0a0b0f', color: '#fff', outline: 'none', fontFamily: 'inherit', marginBottom: 16 }} />
              <button onClick={handlePublicEnter}
                style={{ width: '100%', padding: 13, fontSize: 15, fontWeight: 600, border: 'none', borderRadius: 10, background: '#003da5', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', transition: 'background .2s' }}>
                Ver Catálogo y Precios
              </button>
              <p style={{ textAlign: 'center', fontSize: 11, color: '#333', marginTop: 10 }}>No necesitás cuenta — entrá directo</p>
            </>
          ) : (
            <>
              <label style={{ fontSize: 12, color: '#666', marginBottom: 6, display: 'block' }}>Contraseña</label>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleStaffLogin(); }}
                placeholder="****" autoFocus
                style={{ width: '100%', padding: '12px 16px', fontSize: 18, border: '1px solid #1c2030', borderRadius: 10, background: '#0a0b0f', color: '#fff', outline: 'none', fontFamily: 'inherit', marginBottom: 16, letterSpacing: 6, textAlign: 'center' }} />
              {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</div>}
              <button onClick={handleStaffLogin} disabled={loading}
                style={{ width: '100%', padding: 13, fontSize: 15, fontWeight: 600, border: 'none', borderRadius: 10, background: '#003da5', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1, transition: 'all .2s' }}>
                {loading ? 'Verificando...' : 'Entrar'}
              </button>
              <p style={{ textAlign: 'center', fontSize: 11, color: '#333', marginTop: 10 }}>
                Admin: contraseña del jefe · Empleado: código del taller
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
