# Rentora Backend API - Pi Network Marketplace

Production-ready backend server for Rentora P2P Rental Marketplace integrated with official Pi Network Platform SDK v2.0.

## 🚀 Quick Start (Production)

### 1. Install Dependencies
```bash
npm install --production
```

### 2. Configure Environment
Copy `.env.example` to `.env` and fill in your official Pi Developer Portal Server API Key:
```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=3000
NODE_ENV=production
PI_API_URL=https://api.minepi.com/v2
PI_API_KEY=your_pi_server_api_key_from_develop_pi
APP_URL=https://your-domain.com
```

### 3. Start the Server
```bash
# Direct run
npm start

# Or with PM2 (Recommended for 24/7 uptime)
npm install -g pm2
pm2 start server.js --name "rentora-api"
pm2 save
pm2 startup
```

## 📡 API Endpoints List

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health & API key status check | No |
| `POST` | `/api/auth/pi-login` | Verify Pioneer access token with Pi Core Team | Yes (accessToken) |
| `POST` | `/api/payments/approve` | Approve Pi payment on Pi Platform (`/payments/{id}/approve`) | Server API Key |
| `POST` | `/api/payments/complete` | Complete Pi payment on Pi Platform with `txid` | Server API Key |
| `POST` | `/api/payments/incomplete` | Recover and resolve interrupted Pi payments | Server API Key |
| `GET` | `/api/sync/all` | Get public listings + user's private rentals & ledger | Header `x-pi-uid` |
| `POST` | `/api/sync/item` | Publish or update a marketplace item listing | Yes (Owner/Admin) |
| `POST` | `/api/sync/rental` | Update rental lifecycle status (Handover / Return) | Yes (Participant/Admin) |
