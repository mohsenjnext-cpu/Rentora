/**
 * API Base URL Configuration Helper
 * Allows frontend to connect to deployed Backend (Cloudflare Pages, Cloudflare Worker, Render, VPS)
 */

const STORAGE_API_KEY = 'rentora_backend_api_url';
const DEFAULT_PRODUCTION_API = 'https://rentora-6zs.pages.dev';

export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // 1. Vite Environment Variable (Cloudflare Pages Dashboard)
    try {
      if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_BASE_URL) {
        return String(import.meta.env.VITE_API_BASE_URL).trim().replace(/\/$/, '');
      }
    } catch (e) {}

    // 2. Global Window Variable (HTML Injection)
    if (window.RENTORA_API_BASE_URL) {
      return String(window.RENTORA_API_BASE_URL).trim().replace(/\/$/, '');
    }

    // 3. Admin Saved Local Storage
    try {
      const saved = localStorage.getItem(STORAGE_API_KEY);
      if (saved && saved.trim()) {
        return String(saved).trim().replace(/\/$/, '');
      }
    } catch (e) {}

    // 4. If on PiNet or Pages, route to Cloudflare Pages where PI_API_KEY is configured
    if (window.location && window.location.hostname && (window.location.hostname.includes('pinet.com') || window.location.hostname.includes('pages.dev'))) {
      return DEFAULT_PRODUCTION_API;
    }
  }
  return DEFAULT_PRODUCTION_API;
};

export const setApiBaseUrl = (url) => {
  if (typeof localStorage !== 'undefined') {
    try {
      if (!url || !url.trim()) {
        localStorage.removeItem(STORAGE_API_KEY);
      } else {
        localStorage.setItem(STORAGE_API_KEY, String(url).trim().replace(/\/$/, ''));
      }
    } catch (e) {}
  }
};
