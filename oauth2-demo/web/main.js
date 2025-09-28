import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'demo',
  clientId: 'web-client'
});

const status = document.getElementById('status');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const showTokensBtn = document.getElementById('showTokensBtn');
const refreshBtn = document.getElementById('refreshBtn');
const tokensBox = document.getElementById('tokensBox');
const apiBox = document.getElementById('apiBox');

function setStatus(text){ status.textContent = text; }

async function init() {
  // Silent SSO / PKCE:
  const authenticated = await keycloak.init({
    onLoad: 'check-sso',
    pkceMethod: 'S256',
    silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html' // opcional si la agregas
  });
  setStatus(authenticated ? 'Autenticado' : 'Desconectado');

  // Auto-refresh antes de expirar:
  setInterval(async () => {
    try {
      // Intenta refrescar si expira en <30s:
      const refreshed = await keycloak.updateToken(30);
      if (refreshed) setStatus('Refrescado');
    } catch (e) {
      setStatus('Token inválido');
    }
  }, 5000);
}

loginBtn.onclick = () => keycloak.login({ scope: 'openid profile email offline_access' });
logoutBtn.onclick = () => keycloak.logout();

showTokensBtn.onclick = async () => {
  const data = {
    token: keycloak.token,
    refreshToken: keycloak.refreshToken,
    idToken: keycloak.idToken,
    tokenParsed: keycloak.tokenParsed,
    realmRoles: keycloak?.tokenParsed?.realm_access?.roles || []
  };
  tokensBox.textContent = JSON.stringify(data, null, 2);
};

refreshBtn.onclick = async () => {
  try {
    const ok = await keycloak.updateToken(9999); // forza refresh
    tokensBox.textContent = ok ? 'Refresh OK' : 'Sin necesidad';
  } catch (e) {
    tokensBox.textContent = 'Error en refresh: ' + e?.message;
  }
};

async function callApi(method, path, body) {
  const token = keycloak.token;
  if (!token) return { error: 'No token' };

  const res = await fetch(`http://localhost:3000${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

document.getElementById('callUserRead').onclick = async () => {
  const r = await callApi('GET', '/user');
  apiBox.textContent = JSON.stringify(r, null, 2);
};
document.getElementById('callUserWrite').onclick = async () => {
  const r = await callApi('POST', '/user', { foo: 'bar' });
  apiBox.textContent = JSON.stringify(r, null, 2);
};

init();
