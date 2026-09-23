/**
 * Legacy Express runtime intentionally disabled.
 *
 * Rentora production runs through the Cloudflare Worker entrypoint declared in
 * wrangler.toml. This file must not expose the old file-backed Express API,
 * which cannot provide the same server-authoritative D1/KV guarantees.
 *
 * Do not restore this server as a production fallback. Use the Worker runtime.
 */
const message = [
  'Rentora legacy Express runtime is disabled.',
  'Production traffic must use the Cloudflare Worker runtime (worker-gateway2.js).',
  'No legacy payment, payout, wallet, or file-backed API is exposed.'
].join(' ');

if (process.env.NODE_ENV !== 'test') {
  console.error(message);
  process.exitCode = 1;
}

export default null;
