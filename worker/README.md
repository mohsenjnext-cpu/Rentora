# ⚡ Rentora Cloudflare Worker Backend (Mainnet Ready)

High-performance, global serverless backend for **Rentora P2P Rental Marketplace** running on **Cloudflare Workers** with **Cloudflare KV Storage**.

---

## 🌟 Key Advantages of Cloudflare Worker

1. **Zero Cold Start & Global Latency:** Executes at the edge across 300+ cities worldwide.
2. **100% Serverless:** No VPS or Docker maintenance required.
3. **High Security:** `PI_API_KEY` is securely stored in Cloudflare encrypted secrets.
4. **CORS Enabled:** Fully compatible with GitHub Pages frontend (`window.RENTORA_API_BASE_URL`).
5. **Direct Pi Network SDK Integration:** Strict Mainnet validation with `https://api.minepi.com/v2`.

---

## 📂 Directory Structure

```text
worker/
├── src/
│   └── index.js         # Complete Cloudflare Worker script (Zero-Mock REST API)
├── wrangler.toml        # Cloudflare Wrangler configuration
├── package.json         # Scripts and Wrangler dependencies
└── README.md            # Step-by-step deployment guide
```

---

## 📡 API Endpoints Implemented

| Method | Endpoint | Description | Auth Requirement |
| :---: | :--- | :--- | :---: |
| `GET` | `/api/health` | Health status, storage type & PI_API_KEY check | Public |
| `POST` | `/api/auth/pi-login` | Verify Pioneer access token with Pi Core Team | Pi Access Token |
| `POST` | `/api/payments/approve` | Approve Pi payment on Pi Platform API | `PI_API_KEY` Secret |
| `POST` | `/api/payments/complete` | Complete Pi payment on Pi Platform with `txid` | `PI_API_KEY` Secret |
| `POST` | `/api/payments/incomplete` | Recover and resolve interrupted Pi payments | `PI_API_KEY` Secret |
| `GET` | `/api/sync/all` | Public listings + user private rentals & transactions | `x-pi-uid` Header |
| `POST` | `/api/sync/item` | Publish or update a marketplace item listing | Item Owner / Admin |
| `POST` | `/api/sync/rental` | Update rental lifecycle status (Handover / Return) | Participant / Admin |

---

## 💾 Database Strategy: Cloudflare KV

The Worker uses **Cloudflare KV** (`RENTORA_KV`) to persist:
- `items`: Equipment catalog and listings
- `rentals`: Booking contracts and handover codes
- `transactions`: Verified Pi blockchain receipts

*If KV is not yet bound during local testing, the Worker automatically uses an in-memory fallback.*

---

## 🚀 Step-by-Step Deployment with Wrangler

### 1. Install Wrangler CLI
```bash
cd worker
npm install
```

### 2. Login to Cloudflare
```bash
npx wrangler login
```

### 3. Create Cloudflare KV Namespace
Run the following command to create a KV namespace:
```bash
npx wrangler kv:namespace create "RENTORA_KV"
```
Output example:
```toml
[[kv_namespaces]]
binding = "RENTORA_KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```
Copy the generated `id` and paste it into `wrangler.toml`.

### 4. Set the Secret `PI_API_KEY`
Set your official Server API Key from [Pi Developer Portal](https://develop.pi):
```bash
npx wrangler secret put PI_API_KEY
```
*(Paste your key when prompted: e.g. `piserver_...`)*

### 5. Deploy to Cloudflare Edge
```bash
npx wrangler deploy
```

You will get your live worker URL:
`https://rentora-api.<your-subdomain>.workers.dev`

---

## 🔗 How to Connect GitHub Pages Frontend to the Worker

Once your Worker is deployed, connect your GitHub Pages frontend by choosing **either** of these methods:

### Method A: Add Configuration in `index.html` (Recommended)
Before the closing `</body>` or in `<head>` in your GitHub repository's `index.html`:
```html
<script>
  window.RENTORA_API_BASE_URL = "https://rentora-api.your-subdomain.workers.dev";
</script>
```

### Method B: Via Browser Console / LocalStorage
Any client can point to the worker without modifying files:
```javascript
localStorage.setItem('rentora_backend_api_url', 'https://rentora-api.your-subdomain.workers.dev');
```

---

## 🔍 Verification Test

Test the health endpoint after deployment:
```bash
curl -s https://rentora-api.your-subdomain.workers.dev/api/health
```

Expected output:
```json
{
  "status": "ok",
  "service": "Rentora Cloudflare Worker Backend (Mainnet Ready)",
  "version": "2.2.0",
  "piApiKeyConfigured": true,
  "storage": "Cloudflare KV",
  "environment": "production",
  "timestamp": "2026-09-07T14:15:00.000Z"
}
```
