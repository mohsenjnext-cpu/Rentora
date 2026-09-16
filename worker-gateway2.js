import legacyWorker from './_worker.js';

function now() { return new Date().toISOString(); }
function adminAllowed(value, env) {
  const id = String(value || '').trim().toLowerCase();
  const allowed = String(env?.ADMIN_PI_UIDS || '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  return Boolean(id && allowed.includes(id));
}
async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function requireUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) throw Object.assign(new Error('Authentication required'), { status: 401 });
  const token = auth.slice(7).trim();
  const raw = await env.RENTORA_KV.get(`session:${await sha256(token)}`);
  if (!raw) throw Object.assign(new Error('Session expired or revoked'), { status: 401 });
  let session;
  try { session = JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid session'), { status: 401 }); }
  const user = await env.RENTORA_DB.prepare('SELECT * FROM users WHERE pi_uid=?1 LIMIT 1').bind(session.uid).first();
  if (!user || user.status !== 'active') throw Object.assign(new Error('User is not active'), { status: 403 });
  return user;
}
function userView(row, env) {
  let meta = {};
  try { meta = row.metadata ? JSON.parse(row.metadata) : {}; } catch (_) {}
  const isAdmin = adminAllowed(row.pi_uid, env) || adminAllowed(row.username, env);
  return { ...meta, id: row.id, uid: row.pi_uid, piUid: row.pi_uid, username: row.username, displayName: row.display_name || row.username, avatar: row.avatar_url || '', role: isAdmin ? 'admin' : 'user', status: row.status || 'active', kycStatus: meta.kycStatus || 'unverified', isOfficialSdk: true, joinedDate: row.created_at?.slice(0, 10) || '' };
}
function json(data, status = 200, request = null, env = null) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  const origin = request?.headers?.get('Origin');
  if (origin) {
    let allowed = false;
    try { allowed = origin === new URL(request.url).origin; } catch (_) {}
    const configured = String(env?.CORS_ORIGIN || '').split(',').map((v) => v.trim()).filter(Boolean);
    if (configured.includes(origin) || configured.includes('*')) allowed = true;
    if (allowed) { headers['Access-Control-Allow-Origin'] = origin; headers.Vary = 'Origin'; }
  }
  return new Response(status === 204 ? null : JSON.stringify(data), { status, headers });
}
async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}
function piApiKey(env) {
  const key = env?.PI_API_KEY || env?.PI_SERVER_API_KEY;
  if (!key) throw Object.assign(new Error('Pi server API key is not configured'), { status: 503 });
  return key;
}
async function piFetch(env, path, options = {}) {
  const base = String(env.PI_API_URL || 'https://api.minepi.com/v2').replace(/\/$/, '');
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Key ${piApiKey(env)}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${base}${path}`, { ...options, headers });
}
function piErrorMessage(data, fallback) { return data?.error_message || data?.error || data?.message || fallback; }
function validatePayment(payment, intent, user) {
  if (String(payment?.identifier || '') !== String(intent.pi_payment_id || payment?.identifier || '')) throw Object.assign(new Error('Pi payment identifier mismatch'), { status: 409 });
  if (String(payment?.user_uid || '') !== String(user.pi_uid)) throw Object.assign(new Error('Pi payer mismatch'), { status: 403 });
  if (String(payment?.metadata?.paymentIntentId || '') !== String(intent.id)) throw Object.assign(new Error('Pi payment metadata binding is missing or invalid'), { status: 409 });
  if (!Number.isFinite(Number(payment?.amount)) || Math.abs(Number(payment.amount) - Number(intent.amount)) > 1e-9) throw Object.assign(new Error('Pi payment amount mismatch'), { status: 409 });
  if (String(payment?.memo || '') !== String(intent.memo)) throw Object.assign(new Error('Pi payment memo mismatch'), { status: 409 });
  if (String(payment?.network || '') !== 'Pi Testnet') throw Object.assign(new Error('Pi payment network mismatch'), { status: 409 });
  return payment.status || {};
}
function validateTransactionTxid(payment, txid, required = false) {
  const expected = String(txid || '').trim();
  const reported = String(payment?.transaction?.txid || '').trim();
  if (reported && reported !== expected) throw Object.assign(new Error('Pi transaction ID mismatch'), { status: 409 });
  if (required && !reported) throw Object.assign(new Error('Pi transaction ID is missing'), { status: 409 });
  return reported;
}
async function approvePayment(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  if (!body.paymentId || !body.paymentIntentId) return json({ error: 'paymentId and paymentIntentId are required' }, 400, request, env);
  const intent = await env.RENTORA_DB.prepare('SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2 LIMIT 1').bind(body.paymentIntentId, user.id).first();
  if (!intent || new Date(intent.expires_at) <= new Date()) return json({ error: 'Payment intent is invalid or expired' }, 409, request, env);
  if (intent.pi_payment_id && intent.pi_payment_id !== body.paymentId) return json({ error: 'Payment ID does not match intent' }, 409, request, env);
  const response = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}`);
  const payment = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: piErrorMessage(payment, 'Unable to verify Pi payment'), piStatus: response.status }, 502, request, env);
  const status = validatePayment(payment, { ...intent, pi_payment_id: body.paymentId }, user);
  if (status.cancelled || status.user_cancelled || status.developer_completed) return json({ error: 'Pi payment is not approvable in its current state' }, 409, request, env);
  if (!status.developer_approved) {
    const approvedResponse = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}/approve`, { method: 'POST', body: '{}' });
    const approved = await approvedResponse.json().catch(() => ({}));
    if (!approvedResponse.ok) return json({ error: piErrorMessage(approved, 'Pi payment approval failed'), piStatus: approvedResponse.status }, 502, request, env);
  }
  await env.RENTORA_DB.prepare("UPDATE payment_intents SET pi_payment_id=?1,status='approved',updated_at=?2 WHERE id=?3 AND status IN ('created','approved')").bind(body.paymentId, now(), intent.id).run();
  return json({ approved: true, paymentId: body.paymentId }, 200, request, env);
}
async function completePayment(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  if (!body.paymentId || !body.txid || !body.paymentIntentId) return json({ error: 'paymentId, txid and paymentIntentId are required' }, 400, request, env);
  const intent = await env.RENTORA_DB.prepare('SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2 LIMIT 1').bind(body.paymentIntentId, user.id).first();
  if (!intent) return json({ error: 'Payment intent not found' }, 404, request, env);
  if (intent.pi_payment_id && intent.pi_payment_id !== body.paymentId) return json({ error: 'Payment ID does not match intent' }, 409, request, env);
  const response = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}`);
  const payment = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: piErrorMessage(payment, 'Unable to verify Pi payment before completion'), piStatus: response.status }, 502, request, env);
  const status = validatePayment(payment, { ...intent, pi_payment_id: body.paymentId }, user);
  if (status.cancelled || status.user_cancelled) return json({ error: 'Pi payment is cancelled' }, 409, request, env);
  if (status.developer_completed) validateTransactionTxid(payment, body.txid, true);
  if (!status.developer_completed) {
    const completionResponse = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}/complete`, { method: 'POST', body: JSON.stringify({ txid: body.txid }) });
    const completion = await completionResponse.json().catch(() => ({}));
    if (!completionResponse.ok || !completion?.status?.developer_completed) return json({ error: piErrorMessage(completion, 'Pi payment completion failed'), piStatus: completionResponse.status }, 502, request, env);
    validateTransactionTxid(completion, body.txid, true);
  }
  await env.RENTORA_DB.batch([
    env.RENTORA_DB.prepare("UPDATE payment_intents SET pi_payment_id=?1,pi_txid=?2,status='completed',updated_at=?3 WHERE id=?4 AND status IN ('approved','completed')").bind(body.paymentId, body.txid, now(), intent.id),
    env.RENTORA_DB.prepare("UPDATE rentals SET payment_status='completed',status='confirmed',updated_at=?1 WHERE id=?2").bind(now(), intent.rental_id),
    env.RENTORA_DB.prepare("INSERT OR IGNORE INTO transactions(id,payment_intent_id,pi_payment_id,pi_txid,user_id,amount,type,status,created_at) VALUES(?1,?2,?3,?4,?5,?6,'platform_fee','completed',?7)").bind(`tx_${crypto.randomUUID()}`, intent.id, body.paymentId, body.txid, user.id, intent.amount, now())
  ]);
  return json({ completed: true, paymentId: body.paymentId, txid: body.txid }, 200, request, env);
}
async function adminRoute(request, env, path) {
  const user = await requireUser(request, env);
  if (!(adminAllowed(user.pi_uid, env) || adminAllowed(user.username, env))) return json({ error: 'Admin access required' }, 403, request, env);
  if (path === '/api/auth/me') return json({ authenticated: true, user: { ...userView(user, env), isAdmin: true }, isAdmin: true }, 200, request, env);
  if (path === '/api/admin/users') {
    const rows = await env.RENTORA_DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    return json({ success: true, users: (rows.results || []).map((row) => userView(row, env)) }, 200, request, env);
  }
  if (path === '/api/admin/overview') {
    const [usersCount, listingsCount, rentalsCount, transactionsCount, revRow] = await Promise.all([
      env.RENTORA_DB.prepare('SELECT COUNT(*) AS c FROM users').first(),
      env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM listings WHERE status != 'deleted'").first(),
      env.RENTORA_DB.prepare('SELECT COUNT(*) AS c FROM rentals').first(),
      env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM transactions WHERE status='completed'").first(),
      env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status='completed'").first()
    ]);
    return json({ success: true, overview: { totalUsers: Number(usersCount?.c || 0), totalListings: Number(listingsCount?.c || 0), totalRentals: Number(rentalsCount?.c || 0), totalTransactions: Number(transactionsCount?.c || 0), totalPlatformRevenue: Number(revRow?.total || 0), openReports: 0 } }, 200, request, env);
  }
  return json({ error: 'Not found' }, 404, request, env);
}
export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    try {
      if (request.method === 'OPTIONS') {
        const origin = request.headers.get('Origin');
        const headers = { 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' };
        if (origin) {
          let allowed = false;
          try { allowed = origin === new URL(request.url).origin; } catch (_) {}
          const configured = String(env?.CORS_ORIGIN || '').split(',').map((v) => v.trim()).filter(Boolean);
          if (configured.includes(origin) || configured.includes('*')) allowed = true;
          if (allowed) headers['Access-Control-Allow-Origin'] = origin;
        }
        return new Response(null, { status: 204, headers });
      }
      if (request.method === 'GET' && path === '/api/health') {
        const checks = {
          piApiKeyConfigured: Boolean(env?.PI_API_KEY || env?.PI_SERVER_API_KEY),
          piApiUrlConfigured: Boolean(env?.PI_API_URL),
          databaseBound: Boolean(env?.RENTORA_DB),
          sessionStoreBound: Boolean(env?.RENTORA_KV),
        };
        const healthy = Object.values(checks).every(Boolean);
        return json({ ok: healthy, checks }, healthy ? 200 : 503, request, env);
      }
      if (request.method === 'POST' && path === '/api/payments/approve') return await approvePayment(request, env);
      if (request.method === 'POST' && path === '/api/payments/complete') return await completePayment(request, env);
      if (request.method === 'GET' && (path === '/api/auth/me' || path === '/api/admin/overview' || path === '/api/admin/users')) return await adminRoute(request, env, path);
      return legacyWorker.fetch(request, env, ctx);
    } catch (err) {
      return json({ error: err?.message || 'Server error' }, Number(err?.status) || 500, request, env);
    }
  }
};