/**
 * Single backend URL for the Rentora web client.
 * The browser must never be able to redirect API traffic to an arbitrary URL.
 */
const configuredApiUrl = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : '';

export const getApiBaseUrl = () => {
  if (configuredApiUrl) {
    const value = String(configuredApiUrl).trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(value)) {
      throw new Error('VITE_API_BASE_URL must use HTTPS or HTTP.');
    }
    return value;
  }
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return window.location.origin.replace(/\/$/, '');
  }
  return '';
};

export const setApiBaseUrl = () => {
  throw new Error('API base URL is deployment configuration and cannot be changed from the browser.');
};
