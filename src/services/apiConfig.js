/**
 * API Base URL Configuration Helper
 * Allows frontend to connect to deployed Backend (Cloudflare Pages, Cloudflare Worker, Render, VPS)
 */

const STORAGE_API_KEY = 'rentora_backend_api_url';

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
    // 3. If on PiNet, route API calls directly to Cloudflare Pages backend
    if (window.location && window.location.hostname && window.location.hostname.includes('pinet.com')) {
      return 'https://rentora-6zs.pages.dev';
    }
    // 4. Admin Saved Local Storage
    try {
      const saved = localStorage.getItem(STORAGE_API_KEY);
      if (saved && saved.trim()) {
        return String(saved).trim().replace(/\/$/, '');
      }
    } catch (e) {}
  }
  return '';
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
