# Rentora Legacy Express Reference

`server.js` in this directory is retained only for legacy development/reference use. It is **not** a production deployment target. Rentora production runs the Cloudflare Worker configured by the repository-root `wrangler.toml` (`worker-gateway2.js`).

- Do not deploy this Express server or run it with PM2 in production.
- `npm start` intentionally exits without starting Express.
- Use the root Worker deployment workflow for production.
- Secrets, including `PI_API_KEY`, must remain in the deployment secret store and must never be committed.

## Local legacy development only

For isolated legacy debugging, install this directory's dependencies and use `npm run dev`. This does not represent the production payment, session, or D1/KV runtime.

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
