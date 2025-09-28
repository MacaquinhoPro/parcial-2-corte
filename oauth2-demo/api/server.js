import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const { PORT = 3000, OIDC_ISSUER, JWKS_URI } = process.env;
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: OIDC_ISSUER,
    // audience opcional si configuras aud en Keycloak (clientId del API)
  });
  return payload;
}

function requireAuth(requiredRoles = []) {
  return async (req, res, next) => {
    try {
      const auth = req.headers.authorization || '';
      const [, token] = auth.split(' ');
      if (!token) return res.status(401).json({ error: 'Missing bearer token' });

      const payload = await verifyAccessToken(token);
      req.user = payload;

      // Roles de realm:
      const roles = payload?.realm_access?.roles || [];

      // Verificación de "scopes" como roles de realm:
      const ok = requiredRoles.every(r => roles.includes(r));
      if (!ok) return res.status(403).json({ error: 'Forbidden: missing role(s)', have: roles, need: requiredRoles });

      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token', detail: err?.message });
    }
  };
}

// Rutas:
app.get('/public', (req, res) => {
  res.json({ ok: true, message: 'Endpoint público' });
});

// Usuarios finales (requiere user.read / user.write):
app.get('/user', requireAuth(['user.read']), (req, res) => {
  res.json({ ok: true, who: req.user?.preferred_username, roles: req.user?.realm_access?.roles });
});
app.post('/user', requireAuth(['user.write']), (req, res) => {
  res.json({ ok: true, action: 'user.write' });
});

// Comunicación entre servicios (Client Credentials):
app.get('/service', requireAuth(['service.read']), (req, res) => {
  res.json({ ok: true, svc: 'service.read', roles: req.user?.realm_access?.roles });
});
app.post('/service', requireAuth(['service.write']), (req, res) => {
  res.json({ ok: true, svc: 'service.write' });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
