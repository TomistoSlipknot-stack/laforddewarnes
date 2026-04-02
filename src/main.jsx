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

  // Save user to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('fw_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('fw_user');
    }
  }, [user]);

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
