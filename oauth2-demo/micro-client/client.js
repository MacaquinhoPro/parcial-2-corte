import 'dotenv/config';
import fetch from 'node-fetch';

const {
  TOKEN_URL,
  CLIENT_ID,
  CLIENT_SECRET,
  API_URL
} = process.env;

async function getClientCredentialsToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  if (!res.ok) throw new Error(`Token error: ${res.status} ${await res.text()}`);
  return res.json();
}

async function callProtected(path, token) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await res.json().catch(() => ({}));
  console.log(path, res.status, body);
}

(async () => {
  const tokenResponse = await getClientCredentialsToken();
  const accessToken = tokenResponse.access_token;

  // Debe funcionar con roles service.read/service.write:
  await callProtected('/service', accessToken);
  await fetch(`${API_URL}/service`, { // POST service.write
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  }).then(r => r.json().then(b => console.log('POST /service', r.status, b)));

  // Esto debería fallar (no tiene user.read):
  await callProtected('/user', accessToken);
})();
