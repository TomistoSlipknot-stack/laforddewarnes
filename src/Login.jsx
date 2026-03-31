import { useState } from 'react';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('public'); // 'public' | 'client-login' | 'client-register' | 'staff'
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [regPass, setRegPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const inp = { width: '100%', padding: '12px 14px', fontSize: 15, border: '1px solid var(--fw-cardBorder, #ddd)', borderRadius: 8, background: 'var(--fw-inputBg, #fafafa)', color: 'var(--fw-text, #333)', outline: 'none', fontFamily: 'inherit', marginBottom: 12, transition: 'border .2s' };

  const handleStaffLogin = async () => {
    if (!user.trim() || !pass.trim()) { setError('Completa usuario y contraseña'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass, username: user.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.token) localStorage.setItem('fw_token', data.token);
        onLogin({ role: data.role, name: data.name, clientId: data.clientId });
      } else { setError('Usuario o contraseña incorrectos'); }
    } catch { setError('Error de conexión con el servidor'); }
    setLoading(false);
  };

  const handleClientLogin = async () => {
    if (!user.trim() || !pass.trim()) { setError('Completa email/teléfono y contraseña'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass, username: user.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.token) localStorage.setItem('fw_token', data.token);
        onLogin({ role: data.role || 'client', name: data.name, clientId: data.clientId });
      } else { setError('Email/teléfono o contraseña incorrectos'); }
    } catch { setError('Error de conexión'); }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!name.trim()) { setError('Poné tu nombre'); return; }
    if (!email.trim() && !phone.trim()) { setError('Poné email o teléfono'); return; }
    if (!regPass || regPass.length < 4) { setError('Contraseña mínimo 4 caracteres'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim(), password: regPass }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.token) localStorage.setItem('fw_token', data.token);
        onLogin({ role: 'client', name: data.name, clientId: data.clientId });
      } else { setError(data.error || 'Error al crear cuenta'); }
    } catch { setError('Error de conexión'); }
    setLoading(false);
  };

  const handlePublicEnter = () => {
    onLogin({ role: 'public', name: name.trim() || 'Cliente' });
  };

  const btn = (bg, disabled) => ({
    width: '100%', padding: 14, fontSize: 15, fontWeight: 700, border: 'none', borderRadius: 8,
    background: disabled ? '#666' : (bg || '#003478'), color: '#fff',
    cursor: disabled ? 'wait' : 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  });

  const spinner = <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .6s linear infinite' }} />;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fw-bg, #fff)', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <div style={{ background: '#003478', padding: '10px 0', textAlign: 'center' }}>
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>Repuestos Originales Ford — La Ford de Warnes</span>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
          {/* Logo */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 80, height: 42, background: '#003478', borderRadius: 24, marginBottom: 12 }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 22, fontStyle: 'italic', fontFamily: 'Georgia,serif' }}>Ford</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--fw-text, #1a1a1a)', margin: '0 0 4px' }}>La Ford de Warnes</h1>
            <p style={{ color: 'var(--fw-textSecondary, #888)', fontSize: 14 }}>Repuestos Ford — Más de 48 años como especialistas</p>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--fw-cardBorder, #e8e8e8)' }}>
            {[
              { id: 'public', label: 'Explorar' },
              { id: 'client-login', label: 'Mi Cuenta' },
              { id: 'staff', label: 'Staff' },
            ].map(t => (
              <button key={t.id} onClick={() => { setMode(t.id); setError(''); }}
                style={{ flex: 1, background: 'none', border: 'none', borderBottom: mode === t.id ? '3px solid #003478' : '3px solid transparent', padding: '12px 0', fontSize: 13, fontWeight: mode === t.id ? 700 : 400, color: mode === t.id ? '#4a9eff' : 'var(--fw-textMuted, #999)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: -2 }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ background: 'var(--fw-card, #fff)', border: '1px solid var(--fw-cardBorder, #e8e8e8)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '24px 24px', textAlign: 'left' }}>

            {/* EXPLORAR - sin cuenta */}
            {mode === 'public' && (
              <>
                <label style={{ fontSize: 13, color: 'var(--fw-textSecondary, #555)', marginBottom: 6, display: 'block', fontWeight: 500 }}>Tu nombre</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handlePublicEnter(); }}
                  placeholder="Ej: Carlos, María..." style={inp} autoComplete="name" />
                <button onClick={handlePublicEnter} style={btn()}>
                  Ver Catálogo y Precios
                </button>
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--fw-textMuted, #aaa)', marginTop: 12 }}>
                  Acceso libre — podés crear cuenta después
                </p>
              </>
            )}

            {/* MI CUENTA - login o register */}
            {mode === 'client-login' && (
              <>
                <label style={{ fontSize: 13, color: 'var(--fw-textSecondary, #555)', marginBottom: 6, display: 'block', fontWeight: 500 }}>Email o Teléfono</label>
                <input value={user} onChange={e => setUser(e.target.value)}
                  placeholder="tu@email.com o 1155551234" style={inp} autoComplete="username" />
                <label style={{ fontSize: 13, color: 'var(--fw-textSecondary, #555)', marginBottom: 6, display: 'block', fontWeight: 500 }}>Contraseña</label>
                <input type="password" value={pass} onChange={e => setPass(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleClientLogin(); }}
                  placeholder="••••••••" style={inp} autoComplete="current-password" />
                {error && <div style={{ color: '#d32f2f', fontSize: 13, marginBottom: 12, textAlign: 'center', fontWeight: 500 }}>{error}</div>}
                <button onClick={handleClientLogin} disabled={loading} style={btn('#003478', loading)}>
                  {loading && spinner} {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                  <span style={{ fontSize: 13, color: 'var(--fw-textMuted, #999)' }}>No tenés cuenta? </span>
                  <button onClick={() => { setMode('client-register'); setError(''); }}
                    style={{ background: 'none', border: 'none', color: '#4a9eff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                    Crear cuenta gratis
                  </button>
                </div>
              </>
            )}

            {/* REGISTER */}
            {mode === 'client-register' && (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fw-text, #333)', marginBottom: 14 }}>Crear cuenta</div>
                <label style={{ fontSize: 12, color: 'var(--fw-textSecondary, #555)', marginBottom: 4, display: 'block', fontWeight: 500 }}>Nombre completo</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Tu nombre" style={inp} autoComplete="name" />
                <label style={{ fontSize: 12, color: 'var(--fw-textSecondary, #555)', marginBottom: 4, display: 'block', fontWeight: 500 }}>Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com" style={inp} autoComplete="email" />
                <label style={{ fontSize: 12, color: 'var(--fw-textSecondary, #555)', marginBottom: 4, display: 'block', fontWeight: 500 }}>Teléfono / WhatsApp</label>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="1155551234" style={inp} autoComplete="tel" />
                <label style={{ fontSize: 12, color: 'var(--fw-textSecondary, #555)', marginBottom: 4, display: 'block', fontWeight: 500 }}>Contraseña</label>
                <input type="password" value={regPass} onChange={e => setRegPass(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRegister(); }}
                  placeholder="Mínimo 4 caracteres" style={inp} autoComplete="new-password" />
                {error && <div style={{ color: '#d32f2f', fontSize: 13, marginBottom: 12, textAlign: 'center', fontWeight: 500 }}>{error}</div>}
                <button onClick={handleRegister} disabled={loading} style={btn('#16a34a', loading)}>
                  {loading && spinner} {loading ? 'Creando...' : 'Crear mi cuenta'}
                </button>
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                  <span style={{ fontSize: 13, color: 'var(--fw-textMuted, #999)' }}>Ya tenés cuenta? </span>
                  <button onClick={() => { setMode('client-login'); setError(''); }}
                    style={{ background: 'none', border: 'none', color: '#4a9eff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
                    Iniciar sesión
                  </button>
                </div>
              </>
            )}

            {/* STAFF */}
            {mode === 'staff' && (
              <>
                <label style={{ fontSize: 13, color: 'var(--fw-textSecondary, #555)', marginBottom: 6, display: 'block', fontWeight: 500 }}>Usuario</label>
                <input value={user} onChange={e => setUser(e.target.value)}
                  placeholder="Tu usuario" style={inp} autoComplete="username" />
                <label style={{ fontSize: 13, color: 'var(--fw-textSecondary, #555)', marginBottom: 6, display: 'block', fontWeight: 500 }}>Contraseña</label>
                <input type="password" value={pass} onChange={e => setPass(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleStaffLogin(); }}
                  placeholder="••••••••" style={inp} autoComplete="current-password" />
                {error && <div style={{ color: '#d32f2f', fontSize: 13, marginBottom: 12, textAlign: 'center', fontWeight: 500 }}>{error}</div>}
                <button onClick={handleStaffLogin} disabled={loading} style={btn('#003478', loading)}>
                  {loading && spinner} {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '16px 0', borderTop: '1px solid var(--fw-cardBorder, #eee)', color: 'var(--fw-textMuted, #bbb)', fontSize: 11 }}>
        La Ford de Warnes — Repuestos Ford Originales y Alternativos
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
