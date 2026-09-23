import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The Vite dev server must never impersonate Pi or manufacture authentication/payment
// results. Real authentication and payments belong to the Cloudflare Worker backend.
// For local development, an optional API proxy can be enabled explicitly with:
// VITE_DEV_API_PROXY_TARGET=http://localhost:8787
function devApiProxy() {
  const target = String(process.env.VITE_DEV_API_PROXY_TARGET || '').trim();
  if (!target) return undefined;

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    throw new Error('VITE_DEV_API_PROXY_TARGET must be a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('VITE_DEV_API_PROXY_TARGET must use HTTP or HTTPS.');
  }

  return {
    '/api': {
      target: parsed.origin,
      changeOrigin: true,
      secure: parsed.protocol === 'https:',
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    cors: false,
    allowedHosts: false,
    proxy: devApiProxy(),
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    cors: false,
    allowedHosts: false,
  },
});
