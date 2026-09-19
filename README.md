# 🟣 Rentora | Pi Network P2P Rental Marketplace

Rentora is a decentralized peer-to-peer equipment and goods rental marketplace built natively for the **Pi Network** ecosystem. It enables Pioneers worldwide to rent tools, electronics, vehicles, camping gear, and appliances securely using Pi cryptocurrency.

---

## 🏛️ Architecture Overview

Rentora follows a **Server-Authoritative, Edge-First Architecture** designed for high availability, sub-millisecond response times, and maximum financial integrity:

```
                      ┌─────────────────────────────────────────┐
                      │    Pi Browser / Pioneer Mobile App      │
                      │   (React 19 + Vite + Pi SDK v2.0)       │
                      └────────────────────┬────────────────────┘
                                           │ HTTPS / Bearer Token
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
- **Strict Payment Intent & Metadata Binding:** Every payment requires a server-signed `paymentIntentId` binding the exact Pi UID, rental ID, and canonical fee amount.
- **Zero Mock / Zero Simulated Escrow:** All bookings require authentic Pi Platform API verification (`/v2/payments/:id/approve` and `/v2/payments/:id/complete`).
- **Atomic State Machine:** Rentals transition reliably through `pending_payment` -> `payment_approved` -> `confirmed` -> `active` -> `completed`.
- **Anti-Bypass Privacy Protection:** Direct contact info is protected pre-booking and disclosed only after verified payment confirmation.

---

## 📁 Repository Structure

```
/Rentora
 ├── src/                   # React 19 Frontend (Components, Contexts, Pages, Services)
 ├── backend/               # Node.js/Express backend server for containerized environments
 ├── db/                    # Authoritative D1 Schema and Migrations
 │   ├── migrations/        # Incremental SQL migration scripts
 │   └── schema.sql         # Bootstrap D1 schema with triggers and overlap guards
 ├── tests/                 # Comprehensive Unit and Security Regression Test Suite (206+ tests)
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
The development server will start at `http://localhost:5173`.

### 4. Run Automated Test Suite
```bash
npm test
```
Executes all 206 automated tests verifying quotes, payment intents, anti-bypass filters, and user isolation.

### 5. Build for Production
```bash
npm run build
```

---

## ☁️ Cloudflare Deployment

### 1. Configure Cloudflare Resources

#### D1 Database
Create the D1 database and apply the schema:
```bash
npx wrangler d1 create rentora
npx wrangler d1 execute rentora --remote --file=db/schema.sql
```

#### KV Namespace
Create the KV namespace for session and quote management:
```bash
npx wrangler kv namespace create RENTORA_KV
```

### 2. Set Secrets
Set the Pi Platform Server API Key (never commit to git or expose in frontend):
```bash
npx wrangler secret put PI_API_KEY
```

### 3. Deploy Cloudflare Worker
```bash
npx wrangler deploy
```

---

## ⚙️ Environment Variables Reference

| Variable | Scope | Description |
| :--- | :---: | :--- |
| `PI_API_KEY` | **Secret (Server Only)** | Server API key issued by Pi Developer Portal. |
| `PI_API_URL` | Server | Target Pi Platform API endpoint (`https://api.minepi.com/v2`). |
| `ADMIN_PI_UIDS` | Server | Comma-separated list of authorized Pi usernames/UIDs for admin operations. |
| `PLATFORM_FEE_RATE` | Server | Platform fee percentage (default: `0.05` for 5%). |
| `RENTORA_DB` | Cloudflare Binding | D1 Database instance binding. |
| `RENTORA_KV` | Cloudflare Binding | KV Namespace instance binding. |
| `NODE_ENV` | Build / Server | Runtime environment (`production`). |

---

## 🧪 Pi Testnet Verification Checklist

- [x] **SDK Mode:** `window.Pi.init({ version: "2.0", sandbox: false })`
- [x] **Authentication:** Scopes `['payments', 'username', 'wallet_address']` with `onIncompletePaymentFound` recovery.
- [x] **Domain Verification:** `https://your-domain/validation-key.txt` serving valid domain verification hash.
- [x] **Incomplete Payment Handling:** Dangling payments auto-resolved via `/api/payments/incomplete`.
- [x] **Payout System:** Admin A2U payouts validated against available fee treasury.

---

## 📄 License

Private & Proprietary — Rentora Platform Team. All rights reserved.
