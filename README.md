# 🟣 Rentora | Pi Testnet P2P Rental Marketplace

Rentora is a peer-to-peer rental marketplace built for the Pi Network ecosystem. This repository is currently hardened for **Pi Testnet** and a **Pi Browser / Pi App Studio External App** deployment.

> **Important:** Testnet deployment is the target. Mainnet/production readiness is not claimed until the real Cloudflare bindings, Pi credentials, migrations, and end-to-end payment flow have been verified.

## Architecture

```text
Pi Browser
    ↓ HTTPS
Rentora React frontend
    ↓ /api
Cloudflare Worker
    ├── Pi authentication + session authority
    ├── Payment intent / approve / complete authority
    ├── Marketplace API
    ├── D1 (authoritative marketplace state)
    │   ├── users
    │   ├── listings
    │   ├── rentals
    │   ├── payment_intents
    │   ├── transactions
    │   ├── reviews
    │   ├── reports
    │   └── chats
    └── KV (short-lived sessions / idempotency / coordination)
             ↓
          Pi API
```

The browser is the UI, not the source of truth. Listing prices, rental calculations, payment intent amounts, payment identity, and completed payment records are validated or created server-side.

## Cloudflare setup

Required bindings:

- `RENTORA_DB`: Cloudflare D1 database.
- `RENTORA_KV`: Cloudflare KV namespace for sessions and short-lived coordination.

Required Worker variables/secrets:

- `PI_API_URL=https://api.minepi.com/v2`
- `PI_API_KEY`: Pi Server API key for the selected Pi Testnet application.
- `CORS_ORIGIN`: the exact public HTTPS origin allowed to call the Worker.
- `ADMIN_PI_UIDS`: comma-separated Pi UIDs that are allowed to receive the admin role.

Do **not** put Pi API keys or other secrets in `VITE_*` variables or commit them to Git.

`wrangler.toml` contains the Worker name and non-secret configuration. Database IDs, KV IDs, and secrets are intentionally not committed.

## D1 schema and migrations

For a new database, apply:

```bash
wrangler d1 execute rentora --remote --file=db/schema.sql
```

For an existing database, apply migrations in order:

```text
1. db/schema.sql (for a fresh database only)
2. db/migrations/0002_marketplace_metadata.sql
3. db/migrations/0003_payment_replay_guards.sql
```

The replay-guard migration adds database-level uniqueness for bound Pi payment IDs and transaction IDs where present.

Use the actual D1 database name configured for your Cloudflare account. Do not copy the example command blindly into a production shell and then blame civilization.

## Local validation

```bash
npm ci
npm test
node --check _worker.js
npm run build
```

The test suite currently contains security regression tests for server-owned payment amounts, Pi payment identity/metadata binding, approved-payment completion, session revocation, and the absence of a marketplace memory fallback.

GitHub Actions runs the same test, Worker syntax, and frontend build checks for the hardened branch and pull requests targeting `main`.

## Pi payment security model

The payment lifecycle is server-authoritative:

1. The authenticated user creates a rental from a D1 listing.
2. The Worker calculates the rental values and persists the rental.
3. The Worker creates a payment intent from server-owned rental data.
4. The browser starts the Pi SDK payment using the server-provided intent.
5. Approve/complete requests are authenticated and validate the Pi payment ID, Pioneer UID, amount, memo, and payment-intent metadata binding.
6. Completion is persisted to D1 with transaction uniqueness constraints to resist replay.

A client-supplied payment amount is never accepted as the authority for a payment intent.

## Deployment target

This project intentionally uses the existing **Cloudflare Worker backend**. Render, Railway, a separate Express server, and an external PostgreSQL database are not required by the target architecture.

The frontend can be served through the selected Cloudflare/Pi App Studio deployment path, while `/api/*` is handled by the Worker.

## Repository structure

```text
├── src/                         # React frontend
│   ├── components/
│   ├── context/
│   ├── pages/
│   └── services/
├── public/                      # PWA/static assets
├── db/
│   ├── schema.sql               # Authoritative D1 schema
│   └── migrations/              # Existing-database migrations
├── tests/                       # Security regression tests
├── _worker.js                   # Cloudflare Worker API
├── wrangler.toml                # Worker configuration
├── package.json
├── package-lock.json
└── vite.config.js
```

## Current status

This branch is a **Pi Testnet hardening branch**, not a declaration of production readiness.

Remaining real-environment work:

- Create/connect the Cloudflare D1 and KV bindings.
- Apply the schema/migrations to the intended Testnet database.
- Configure the Pi Testnet server API key and admin UID allow-list as Cloudflare secrets/variables.
- Deploy the Worker and verify `/api/health`.
- Run an actual Pi Testnet login → rental → payment → approve → complete flow.
- Add/finish integration coverage for payment recovery/reconciliation and any remaining client-side marketplace workflows.
