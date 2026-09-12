import legacyWorker from './_worker.js';

const MAX_BODY_BYTES = 16 * 1024;

function now() {
  return new Date().toISOString();
}

function isOriginAllowed(origin, requestUrl, env) {
  if (!origin) return true;
  try {
    const requestOrigin = new URL(requestUrl).origin;
    if (origin === requestOrigin) return true;
  } catch (_) {}
  const configured = (env?.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (configured.length === 0 || configured.includes('*') || configured.includes(origin)) return true;
  return false;
}

function json(data, status, env, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
  const allowOrigin = origin || env?.CORS_ORIGIN || '';
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
    headers.Vary = 'Origin';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function error(message, status, env, extra = {}, origin) {
  return json({ error: message, ...extra }, status, env, origin);
}

async function readJson(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw Object.assign(new Error('Request body too large'), { status: 413 });
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function requireUser(request, env) {
  if (!env?.RENTORA_DB || !env?.RENTORA_KV) throw Object.assign(new Error('Storage bindings are required'), { status: 503 });
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw Object.assign(new Error('Authentication required'), { status: 401 });
  const token = authorization.slice(7).trim();
  if (!token) throw Object.assign(new Error('Authentication required'), { status: 401 });
  const session = await env.RENTORA_KV.get(`session:${await sha256(token)}`);
  if (!session) throw Object.assign(new Error('Session expired or revoked'), { status: 401 });
  let parsed;
  try {
    parsed = JSON.parse(session);
  } catch {
    throw Object.assign(new Error('Invalid session'), { status: 401 });
  }
  const user = await env.RENTORA_DB.prepare('SELECT * FROM users WHERE pi_uid=?1 LIMIT 1').bind(parsed.uid).first();
  if (!user || user.status !== 'active') throw Object.assign(new Error('User is not active'), { status: 403 });
  return user;
}

async function piFetch(env, path, options = {}) {
  if (!env?.PI_API_KEY) throw Object.assign(new Error('Pi server API key is not configured'), { status: 503 });
  const base = String(env.PI_API_URL || 'https://api.minepi.com/v2').replace(/\/$/, '');
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Key ${env.PI_API_KEY}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${base}${path}`, { ...options, headers });
}

function validatePayment(payment, intent, user) {
  const identifier = String(payment?.identifier || '');
  if (!identifier || identifier !== String(intent.pi_payment_id || identifier)) {
    throw Object.assign(new Error('Pi payment identifier mismatch'), { status: 409 });
  }
  if (String(payment?.user_uid || '') !== String(user.pi_uid)) {
    throw Object.assign(new Error('Pi payer mismatch'), { status: 403 });
  }
  if (String(payment?.metadata?.paymentIntentId || '') !== String(intent.id)) {
    throw Object.assign(new Error('Pi payment metadata binding is missing or invalid'), { status: 409 });
  }
  const amount = Number(payment?.amount);
  if (!Number.isFinite(amount) || Math.abs(amount - Number(intent.amount)) > 1e-9) {
    throw Object.assign(new Error('Pi payment amount mismatch'), { status: 409 });
  }
  if (String(payment?.memo || '') !== String(intent.memo)) {
    throw Object.assign(new Error('Pi payment memo mismatch'), { status: 409 });
  }
  if (String(payment?.network || '') !== 'Pi Testnet') {
    throw Object.assign(new Error('Pi payment network mismatch'), { status: 409 });
  }
  return payment.status || {};
}

async function paymentFromPi(env, paymentId) {
  const response = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}`);
  const payment = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error('Unable to verify Pi payment'), { status: 502 });
  return payment;
}

async function approve(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  if (!body.paymentId || !body.paymentIntentId) return error('paymentId and paymentIntentId are required', 400, env);

  let intent = await env.RENTORA_DB.prepare('SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2 LIMIT 1').bind(body.paymentIntentId, user.id).first();
  if (!intent || new Date(intent.expires_at) <= new Date()) return error('Payment intent is invalid or expired', 409, env);
  if (intent.status === 'completed') return json({ approved: true, paymentId: body.paymentId, idempotent: true }, 200, env);
  if (intent.pi_payment_id && intent.pi_payment_id !== body.paymentId) return error('Payment ID does not match intent', 409, env);

  const payment = await paymentFromPi(env, body.paymentId);
  const status = validatePayment(payment, { ...intent, pi_payment_id: body.paymentId }, user);
  if (status.cancelled || status.user_cancelled || status.developer_completed) return error('Pi payment is not approvable in its current state', 409, env);

  if (status.developer_approved) {
    await env.RENTORA_DB.prepare("UPDATE payment_intents SET pi_payment_id=?1,status='approved',updated_at=?2 WHERE id=?3 AND status IN ('created','approved')").bind(body.paymentId, now(), intent.id).run();
    return json({ approved: true, paymentId: body.paymentId, idempotent: true }, 200, env);
  }

  const approvalResponse = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}/approve`, { method: 'POST', body: '{}' });
  const approval = await approvalResponse.json().catch(() => ({}));
  if (!approvalResponse.ok) return error('Pi payment approval failed', 502, env, { details: approval });

  const claim = await env.RENTORA_DB.prepare("UPDATE payment_intents SET pi_payment_id=?1,status='approved',updated_at=?2 WHERE id=?3 AND status='created' AND pi_payment_id IS NULL").bind(body.paymentId, now(), intent.id).run();
  if (!Number(claim?.meta?.changes || 0)) {
    intent = await env.RENTORA_DB.prepare('SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2 LIMIT 1').bind(intent.id, user.id).first();
    if (!intent || intent.pi_payment_id !== body.paymentId || !['approved', 'completed'].includes(intent.status)) {
      return error('Payment intent was concurrently claimed by another payment', 409, env);
    }
  }
  return json({ approved: true, paymentId: body.paymentId, data: approval, idempotent: Number(claim?.meta?.changes || 0) === 0 }, 200, env);
}

async function complete(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  if (!body.paymentId || !body.txid || !body.paymentIntentId) return error('paymentId, txid and paymentIntentId are required', 400, env);

  const intent = await env.RENTORA_DB.prepare('SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2 LIMIT 1').bind(body.paymentIntentId, user.id).first();
  if (!intent) return error('Payment intent not found', 404, env);
  if (intent.status === 'completed') return json({ completed: true, paymentId: intent.pi_payment_id, txid: intent.pi_txid, idempotent: true }, 200, env);
  if (intent.pi_payment_id && intent.pi_payment_id !== body.paymentId) return error('Payment ID does not match intent', 409, env);
  if (!['approved', 'completed'].includes(intent.status)) return error('Payment intent is not approved for completion', 409, env);

  const payment = await paymentFromPi(env, body.paymentId);
  const status = validatePayment(payment, { ...intent, pi_payment_id: body.paymentId }, user);
  if (status.cancelled || status.user_cancelled) return error('Pi payment is cancelled', 409, env);

  const alreadyCompleted = Boolean(status.developer_completed);
  if (!alreadyCompleted) {
    const completionResponse = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}/complete`, {
      method: 'POST',
      body: JSON.stringify({ txid: body.txid }),
    });
    const completion = await completionResponse.json().catch(() => ({}));
    if (!completionResponse.ok) return error('Pi payment completion failed', 502, env, { details: completion });
    if (!completion?.status?.developer_completed) return error('Pi did not confirm server-side completion', 502, env, { details: completion });
  } else if (payment?.transaction?.txid && String(payment.transaction.txid) !== String(body.txid)) {
    return error('Pi transaction ID mismatch', 409, env);
  }

  await env.RENTORA_DB.batch([
    env.RENTORA_DB.prepare("UPDATE payment_intents SET pi_payment_id=?1,pi_txid=?2,status='completed',updated_at=?3 WHERE id=?4 AND status IN ('approved','completed')").bind(body.paymentId, body.txid, now(), intent.id),
    env.RENTORA_DB.prepare("UPDATE rentals SET payment_status='completed',status='confirmed',updated_at=?1 WHERE id=?2").bind(now(), intent.rental_id),
    env.RENTORA_DB.prepare("INSERT OR IGNORE INTO transactions(id,payment_intent_id,pi_payment_id,pi_txid,user_id,amount,type,status,created_at) VALUES(?1,?2,?3,?4,?5,?6,'platform_fee','completed',?7)").bind(`tx_${crypto.randomUUID()}`, intent.id, body.paymentId, body.txid, user.id, intent.amount, now()),
  ]);
  await env.RENTORA_KV.put(`payment-complete:${intent.id}`, JSON.stringify({ paymentId: body.paymentId, txid: body.txid, at: now() }), { expirationTtl: 60 * 60 * 24 * 30 });
  return json({ completed: true, paymentId: body.paymentId, txid: body.txid, recovered: alreadyCompleted }, 200, env);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (request.method === 'POST' && url.pathname === '/api/payments/approve') {
      try { return await approve(request, env); } catch (err) { return error(err?.message || 'Server error', Number(err?.status) || 500, env, {}, origin); }
    }
    if (request.method === 'POST' && url.pathname === '/api/payments/complete') {
      try { return await complete(request, env); } catch (err) { return error(err?.message || 'Server error', Number(err?.status) || 500, env, {}, origin); }
    }
    return legacyWorker.fetch(request, env, ctx);
  },
};
