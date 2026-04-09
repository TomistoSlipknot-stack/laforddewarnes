import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Login from './Login.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#ff4444', background: '#08090c', minHeight: '100vh', fontFamily: 'monospace', fontSize: 14 }}>
          <h2 style={{ color: '#fff', marginBottom: 16 }}>Error en la App</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#666', marginTop: 10 }}>{this.state.error.stack}</pre>
          <button onClick={() => { localStorage.removeItem('fw_user'); window.location.reload(); }} style={{ marginTop: 20, padding: '10px 20px', background: '#003478', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Volver al inicio</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Root() {
  // Persist session in localStorage
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('fw_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [verifying, setVerifying] = useState(!!localStorage.getItem('fw_token'));

  // Save user to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('fw_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('fw_user');
    }
  }, [user]);

  // On boot: verify that the stored token is still valid on the server.
  // If Render restarted and the session was lost, force re-login immediately
  // instead of showing a broken admin panel with 401 errors everywhere.
  useEffect(() => {
    const token = localStorage.getItem('fw_token');
    if (!token || !user) { setVerifying(false); return; }
    fetch('/api/verify-session', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => {
        if (!r.ok) {
          // Token is stale — force re-login
          console.warn('[session] token expired, forcing re-login');
          localStorage.removeItem('fw_token');
          localStorage.removeItem('fw_user');
          setUser(null);
        }
      })
      .catch(() => {
        // Network error — don't kill the session, let it try to work offline
      })
      .finally(() => setVerifying(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (verifying) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0b0f', color: '#fff', fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid #003478', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 14 }}>Verificando sesión...</div>
      </div>
    </div>
  );

  if (!user) return <Login onLogin={setUser} />;

  return <App user={user} onLogout={() => {
    localStorage.removeItem('fw_token');
    localStorage.removeItem('fw_user');
    setUser(null);
  }} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>,
)
