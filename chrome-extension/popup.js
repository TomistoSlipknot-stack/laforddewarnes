const SUPPLIERS = [
  { id: 'forcor', name: 'Forcor (Wayre)', loginUrl: 'https://wayre.forcor.com.ar/login' },
  { id: 'fordmata', name: 'Fordmata', loginUrl: 'https://fordmata.no-ip.org/ford/extranet/default.asp' },
  { id: 'fnx', name: 'FNX (Fenix)', loginUrl: 'http://fnx.com.ar/index.php?banner=show' },
  { id: 'taraborelli', name: 'Taraborelli', loginUrl: 'http://repuestos.fordtaraborelli.com/v2/' },
];

const container = document.getElementById('suppliers');

// Check login status
chrome.runtime.sendMessage({ type: 'LOGIN_STATUS' }, (status) => {
  SUPPLIERS.forEach(sup => {
    const isLogged = status?.[sup.id];
    const div = document.createElement('div');
    div.className = 'supplier';
    div.innerHTML = `
      <div class="dot ${isLogged ? 'green' : 'gray'}"></div>
      <div class="sup-name">${sup.name}</div>
      <div class="sup-status">${isLogged ? 'Conectado' : 'Sin sesión'}</div>
      ${!isLogged ? `<button class="login-btn" data-url="${sup.loginUrl}">Iniciar sesión</button>` : ''}
    `;
    container.appendChild(div);
  });

  // Login buttons
  document.querySelectorAll('.login-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      chrome.tabs.create({ url: btn.dataset.url, active: true });
    });
  });
});
