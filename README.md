# 🟣 Rentora | Pi Network P2P Rental Marketplace

Rentora is a decentralized peer-to-peer equipment and goods rental marketplace built natively for the **Pi Network** ecosystem. It enables Pioneers worldwide to rent tools, electronics, vehicles, camping gear, and appliances securely using Pi cryptocurrency.

---

## 🏛️ Architecture Overview

Rentora follows a **Server-Authoritative, Edge-First Architecture** designed for high availability and financial integrity:

```
                      ┌─────────────────────────────────────────┐
                      │    Pi Browser / Pioneer Mobile App      │
                      │   (React 19 + Vite + Pi SDK v2.0)       │
                      └────────────────────┬────────────────────┘
                                           │ HTTPS / HttpOnly Session Cookie
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │    Cloudflare Worker Gateway            │
                      │    (worker-gateway2.js / _worker.js)    │
                      └─────┬──────────────┬──────────────┬─────┘
                            │              │              │
           SQL Transactions │              │ Session Auth │ Pi Platform API
                            ▼              ▼              ▼
                   ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
                   │Cloudflare D1 │ │Cloudflare KV │ │ Pi Network API   │
                   │(SQLite Edge) │ │(Tokens/Quote)│ │(https://api.minepi)
                   └──────────────┘ └──────────────┘ └──────────────────┘
```

### Key Architectural Tenets:
- **Server-Authoritative Financials:** Prices, quotes, deposits, and platform fees are calculated strictly on Cloudflare D1. The client never supplies payment amounts.
- **Strict Payment Intent & Metadata Binding:** Every payment requires a server-bound `paymentIntentId` binding the exact Pi UID, rental ID, and canonical fee amount.
- **Zero Mock / Zero Simulated Escrow:** All bookings require authentic Pi Platform API verification (`/v2/payments/:id/approve` and `/v2/payments/:id/complete`).
- **Atomic State Machine:** Rentals transition reliably through `pending_payment` -> `payment_approved` -> `confirmed` -> `active` -> `completed`.
- **Anti-Bypass Privacy Protection:** Direct contact info is protected pre-booking and disclosed only after verified payment confirmation.

---

## 📁 Repository Structure

```
/Rentora
 ├── src/                   # React 19 Frontend (Components, Contexts, Pages, Services)
 ├── backend/               # Legacy Node.js/Express fallback kept disabled for production
 ├── db/                    # Authoritative D1 Schema and Migrations
 │   ├── migrations-production/ # Reviewed incremental production migrations
 │   └── schema.sql         # Bootstrap/reference schema
 ├── tests/                 # Unit and Security Regression Test Suite
 ├── public/                # Static assets, Web Manifest, and validation-key.txt
 ├── workers/               # Cloudflare Worker modules and gateway definitions
 ├── docs/                  # Architecture documentation and audit reports
 ├── package.json           # Dependencies and test runner scripts
 ├── vite.config.js         # Production Vite build configuration
 ├── wrangler.toml          # Cloudflare Workers bindings and deployment config
 ├── README.md              # Project documentation
 └── .env.example           # Example environment variables
```

---

## 🚀 Local Development

### 1. Prerequisites
- **Node.js:** v20.x or v22.x LTS
- **npm:** v10+

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Local Development Server
```bash
npm run dev
```

### 4. Run Automated Test Suite
```bash
npm test
```

### 5. Build for Production
```bash
npm run build
```

---

## ☁️ Cloudflare Deployment

### 1. Configure Cloudflare Resources

#### D1 Database
Create the D1 database once, then apply only reviewed production migrations:

```bash
npx wrangler d1 create rentora
npx wrangler d1 migrations apply rentora --remote
```

Do **not** execute `db/schema.sql` directly against the live database. Production schema evolution belongs to the reviewed migration ledger.

#### KV Namespace
Create the KV namespace for session and quote management:

```bash
npx wrangler kv namespace create RENTORA_KV
```

### 2. Set Server Secrets

These values are Cloudflare secrets and must never be committed to Git or exposed to the frontend:

```bash
npx wrangler secret put PI_API_KEY
npx wrangler secret put PI_WALLET_PRIVATE_SEED
```

`PI_WALLET_PRIVATE_SEED` is used only by the server-side A2U payout path.

### 3. Configure Admin Allowlist

Set `ADMIN_PI_UIDS` in the Cloudflare Worker environment to a comma-separated list of **actual Pi UIDs** authorized for administrative operations. Do not use Pi usernames in this allowlist.

### 4. Deploy Cloudflare Worker

```bash
npx wrangler deploy
```

The GitHub deployment workflow also performs non-mutating remote D1 migration checks and a live health gate before considering the deployment ready.

---

## ⚙️ Environment Variables Reference

| Variable | Scope | Description |
| :--- | :---: | :--- |
| `PI_API_KEY` | **Secret (Server Only)** | Pi Platform Server API key. |
| `PI_WALLET_PRIVATE_SEED` | **Secret (Server Only)** | Developer wallet private seed for A2U payout operations. Never expose client-side. |
| `PI_API_URL` | Server | Pi Platform API endpoint (`https://api.minepi.com/v2`). |
| `PI_HORIZON_URL` | Server | Pi Testnet Horizon endpoint (`https://api.testnet.minepi.com`). |
| `PI_NETWORK_PASSPHRASE` | Server | Pi network passphrase, `Pi Testnet` for Testnet deployment. |
| `ADMIN_PI_UIDS` | Server | Comma-separated list of authorized **Pi UIDs**, not usernames. |
| `PLATFORM_FEE_RATE` | Server | Platform fee rate (default: `0.05`). |
| `RENTORA_DB` | Cloudflare Binding | D1 Database binding. |
| `RENTORA_KV` | Cloudflare Binding | KV Namespace binding. |
| `NODE_ENV` | Server | Runtime environment (`production`). |

---

## 🧪 Pi Testnet Readiness Checklist

These checks distinguish **code readiness** from **live environment verification**. A checked item does not imply that a live Pi transaction has already been executed.

### Code / Configuration Contract
- [x] **SDK Mode:** `window.Pi.init({ version: "2.0", sandbox: false })`
- [x] **Authentication Contract:** Scopes `['payments', 'username', 'wallet_address']`, server verification, and HttpOnly session cookie.
- [x] **Incomplete Payment Handling:** Recovery endpoint exists at `/api/payments/incomplete`.
- [x] **Server-Authoritative Payment Intent:** Rental and fee amounts are resolved server-side.
- [x] **Duplicate Payment Protection:** Generic payment failures are not retried as new native Pi payments.
- [x] **A2U Contract:** Server-side payout and reconciliation paths are present.

### Live Environment Verification
- [ ] **Domain Verification:** Production domain serves the Pi validation key configured for the actual deployed domain.
- [ ] **Live Health:** `/api/health` returns `"ok":true` with valid Pi API credentials and healthy D1/KV.
- [ ] **Pi Browser Authentication:** A real Testnet Pioneer can authenticate successfully.
- [ ] **U2A Testnet Payment:** A real Testnet payment completes through the full server-authoritative flow.
- [ ] **A2U Testnet Payout:** A real authorized payout completes successfully.
- [ ] **Payout Reconciliation:** The resulting transaction is reconciled against the server-side payout record.
- [ ] **Remote D1 Ledger:** Production migration ledger is clean before live verification.

---

## 📄 License

Private & Proprietary — Rentora Platform Team. All rights reserved.
