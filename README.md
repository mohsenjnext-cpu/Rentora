# 🟣 Rentora | Peer-to-Peer Rental Marketplace on Pi Network

> **The Decentralized Peer-to-Peer Equipment & Goods Rental Marketplace powered by Pi Network SDK v2.0.**

Rentora allows Pioneers worldwide to list, discover, and rent tools, electronics, camping gear, party supplies, and equipment using Pi cryptocurrency with a direct P2P settlement model.

---

## 🌟 Key Features

- **⚡ Pi SDK v2.0 Integration:** Native Pi authentication (`username` scope) and Pi payment lifecycle (`Pi.createPayment` -> `/api/payments/approve` -> user signature -> `/api/payments/complete`).
- **🤝 Hybrid P2P Settlement:** Renters pay the platform booking fee via Pi SDK; remaining daily rent and deposit are settled directly between owner and renter upon equipment handover.
- **🔐 Strict Zero-Mock Security:** Real Mainnet-ready authentication and payment validation against official Pi Core Team servers (`api.minepi.com/v2`).
- **📱 PWA & Mobile First:** Seamless mobile experience inside Pi Browser with client-side canvas photo compression.
- **🌐 Multilingual & RTL/LTR:** Complete i18n support for Persian (فارسی), English, and Arabic (العربية).
- **🛡️ Trust & Safety:** Verified Pioneer KYC badges, 4-digit security handover codes, return verification, ratings, and reviews.
- **👑 Pioneer Admin Command Center:** Dynamic platform fee management, user status moderation, transaction ledger, and ecosystem analytics.

---

## 📂 Repository Structure

```text
├── src/                         # Frontend React 19 source code
│   ├── components/              # UI components (Header, Footer, BookingModal, ItemCard, etc.)
│   ├── context/                 # State management (RentoraContext, PiAuthContext, ThemeContext, LanguageContext)
│   ├── pages/                   # Views (HomePage, DiscoverPage, ListItemPage, OwnerHubPage, etc.)
│   └── services/                # Pi SDK v2.0 Client & Internal Cloud Sync Services
├── public/                      # Static assets, manifest.json, icons
├── backend/                     # Dedicated standalone Node.js Express backend
│   ├── server.js                # Mainnet-ready Pi Platform API integration & DB persistence
│   ├── package.json             # Backend dependencies and scripts
│   ├── .env.example             # Environment template for Server API Key
│   └── rentora_database.json    # Local persistent JSON storage
├── dist/                        # Optimized production frontend build
├── server.js                    # Root server file for full-stack deployments
├── index.html                   # HTML entry point with Pi Network SDK script
├── vite.config.js               # Vite build configuration
├── tailwind.config.js           # Tailwind CSS configuration
└── package.json                 # Project dependencies & npm scripts
```

---

## 🚀 Quick Deployment Guide

### 1. Update GitHub Repository (Main Branch)
Unzip `rentora-github-update.zip` into your repository root, commit, and push:
```bash
git add .
git commit -m "feat: Production-ready Pi Mainnet integration with zero-mock backend and P2P settlement"
git push origin main
```

### 2. Frontend on GitHub Pages
Deploy the compiled files from `dist/` or `rentora-github-pages-ready.zip` to your `gh-pages` branch:
```bash
npm run build
# Deploy 'dist' directory to GitHub Pages
```

### 3. Backend on Server (Render / Railway / VPS)
Deploy the `backend/` directory on your Node.js hosting:
```bash
cd backend
npm install --production
cp .env.example .env
# Edit .env with your official PI_API_KEY from develop.pi
npm start
```

---

## 🔒 Environment Variables (`.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Web server listening port | `3000` |
| `NODE_ENV` | Runtime environment | `production` |
| `PI_API_URL` | Pi Network Core Team API endpoint | `https://api.minepi.com/v2` |
| `PI_API_KEY` | Server API Key from `develop.pi` | `your_pi_server_api_key` |
| `APP_URL` | Deployed frontend URL | `https://your-username.github.io/rentora/` |

---

## 📄 License
MIT License © 2026 Rentora Team. Built for the Pi Network Ecosystem.
