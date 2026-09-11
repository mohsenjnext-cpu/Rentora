/**
 * Single backend URL for the Rentora web client.
 * The browser must never be able to redirect API traffic to an arbitrary URL.
 */
const configuredApiUrl = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : '';
const DEFAULT_API_URL = 'https://rentora-api.example.com';

export const getApiBaseUrl = () => {
  const value = String(configuredApiUrl || DEFAULT_API_URL).trim().replace(/\/$/, '');
  if (!/^https:\/\//i.test(value)) {
    throw new Error('VITE_API_BASE_URL must use HTTPS.');
  }
  return value;
};

export const setApiBaseUrl = () => {
  throw new Error('API base URL is deployment configuration and cannot be changed from the browser.');
};
