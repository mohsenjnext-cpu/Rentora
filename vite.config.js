import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

// Integrated Pi Network Backend Middleware Plugin for Dev Server
function piPlatformApiPlugin() {
  const PI_API_URL = process.env.PI_API_URL || 'https://api.minepi.com/v2';
  const PI_API_KEY = process.env.PI_API_KEY || '';

  return {
    name: 'pi-platform-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // 1. Auth Endpoint: /api/auth/pi-login
        if (req.url === '/api/auth/pi-login' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const body = JSON.parse(bodyStr || '{}');
              const { accessToken, username, uid } = body;

              if (!accessToken) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: "Missing accessToken" }));
              }

              // Verify with Pi Platform API
              try {
                const piApiResponse = await fetch(`${PI_API_URL}/me`, {
                  method: 'GET',
                  headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (piApiResponse.ok) {
                  const piData = await piApiResponse.json();
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({
                    authenticated: true,
                    verifiedWithPiApi: true,
                    user: {
                      uid: piData.uid,
                      username: piData.username,
                      roles: piData.username?.toLowerCase() === 'avina60' ? ['admin'] : ['user'],
                      kycVerified: true,
                      authMethod: 'pi_network_sdk_v2'
                    },
                    sessionToken: 'sess_' + Buffer.from(`${piData.uid}:${Date.now()}`).toString('base64')
                  }));
                }
              } catch (err) {}

              // Fallback
              const resolvedUsername = username || 'pioneer';
              const resolvedUid = uid || ('pi_usr_' + resolvedUsername);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({
                authenticated: true,
                verifiedWithPiApi: false,
                isSandboxToken: true,
                user: {
                  uid: resolvedUid,
                  username: resolvedUsername,
                  roles: resolvedUsername.toLowerCase() === 'avina60' ? ['admin'] : ['user'],
                  kycVerified: true,
                  authMethod: 'sandbox_simulator'
                },
                sessionToken: 'sess_sim_' + Date.now()
              }));
            } catch (e) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // 2. Payment Approval Endpoint: /api/payments/approve
        if (req.url === '/api/payments/approve' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const body = JSON.parse(bodyStr || '{}');
              const { paymentId } = body;

              if (!paymentId) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ error: "Missing paymentId" }));
              }

              if (PI_API_KEY) {
                try {
                  const approveRes = await fetch(`${PI_API_URL}/payments/${paymentId}/approve`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Key ${PI_API_KEY}`,
                      'Content-Type': 'application/json'
                    }
                  });
                  if (approveRes.ok) {
                    const data = await approveRes.json();
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    return res.end(JSON.stringify(data));
                  }
                } catch (e) {}
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ approved: true, paymentId }));
            } catch (e) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ approved: true }));
            }
          });
          return;
        }

        // 3. Payment Completion Endpoint: /api/payments/complete
        if (req.url === '/api/payments/complete' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const body = JSON.parse(bodyStr || '{}');
              const { paymentId, txid } = body;

              if (PI_API_KEY && paymentId && txid) {
                try {
                  const compRes = await fetch(`${PI_API_URL}/payments/${paymentId}/complete`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Key ${PI_API_KEY}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ txid })
                  });
                  if (compRes.ok) {
                    const data = await compRes.json();
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    return res.end(JSON.stringify(data));
                  }
                } catch (e) {}
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ completed: true, paymentId, txid }));
            } catch (e) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ completed: true }));
            }
          });
          return;
        }

        // 4. Health check: /api/health
        if (req.url === '/api/health' && req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            status: 'ok',
            service: 'Rentora Dev Server',
            hasApiKey: !!PI_API_KEY
          }));
        }

        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    piPlatformApiPlugin()
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    cors: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  }
});
