# Rentora Cloudflare Worker Architecture

Rentora uses Cloudflare Workers for edge routing, D1 relational database operations, and KV session caching.

## Worker Modules

1. **`worker-gateway2.js`** (Active Entrypoint):
   - Handles Pi Network payment approval (`POST /api/payments/approve`), completion (`POST /api/payments/complete`), and recovery (`POST /api/payments/incomplete`).
   - Handles Admin A2U Payouts (`POST /api/admin/payout`) and Admin overview APIs.
   - Enforces user-aware sync and delegates core CRUD routes to `_worker.js`.

2. **`_worker.js`** (Core API & Storage Engine):
   - Authoritative rental quote generation (`POST /api/rentals/quote`) with 15-minute KV snapshot.
   - Server-authoritative rental creation (`POST /api/rentals`) with overlap prevention triggers.
   - Secure marketplace chat (`/api/conversations`) with pre-booking anti-bypass filters.
   - D1 data queries, user profile sync, image uploads, and reviews.

3. **`worker-entry.js` / `worker-gateway.js`**:
   - Backward-compatible worker entrypoints maintaining integration test parity.
