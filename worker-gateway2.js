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
  if (!env?.RENTORA_DB || !env?.RENTORA_KV) throw Object.assign(new Error('Storage bindings (RENTORA_DB, RENTORA_KV) are required'), { status: 503 });
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
    if (configured.length === 0 || configured.includes(origin) || configured.includes('*')) allowed = true;
    if (allowed) { headers['Access-Control-Allow-Origin'] = origin; headers.Vary = 'Origin'; }
  }
  return new Response(status === 204 ? null : JSON.stringify(data), { status, headers });
}
async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}
function sanitizePiApiKey(raw) {
  if (!raw) return '';
  let key = String(raw).trim();
  key = key.replace(/^["']+|["']+$/g, '').trim();
  if (/^key\s+/i.test(key)) {
    key = key.replace(/^key\s+/i, '').trim();
  } else if (/^bearer\s+/i.test(key)) {
    key = key.replace(/^bearer\s+/i, '').trim();
  }
  return key;
}

function piApiKey(env) {
  const raw = env?.PI_API_KEY || env?.PI_SERVER_API_KEY;
  const key = sanitizePiApiKey(raw);
  if (!key) throw Object.assign(new Error('Pi server API key is not configured'), { status: 503 });
  return key;
}

function piErrorMessage(data, fallback = 'Pi network error') {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  return data.error_message || data.error || data.message || data.detail || fallback;
}

async function piFetch(env, path, options = {}) {
  const base = String(env.PI_API_URL || 'https://api.minepi.com/v2').replace(/\/$/, '');
  const headers = new Headers(options.headers || {});
  if (!headers.has('Authorization')) {
    const key = piApiKey(env);
    headers.set('Authorization', `Key ${key}`);
  }
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${base}${path}`, { ...options, headers });
}
function parsePaymentMetadata(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }
  return {};
}

function extractPayerUid(payment) {
  return String(
    payment?.user_uid ||
    payment?.user?.uid ||
    payment?.from_address?.uid ||
    payment?.uid ||
    ''
  ).trim();
}

function normalizeStatus(rawStatus) {
  if (!rawStatus) return {};
  if (typeof rawStatus === 'object') return rawStatus;
  const s = String(rawStatus).toLowerCase();
  return {
    developer_approved: s === 'approved' || s === 'developer_approved',
    developer_completed: s === 'completed' || s === 'complete' || s === 'developer_completed',
    cancelled: s === 'cancelled' || s === 'user_cancelled',
    user_cancelled: s === 'user_cancelled'
  };
}

function validatePayment(payment, intent, user) {
  const identifier = String(payment?.identifier || payment?.id || '').trim();
  const intentPaymentId = String(intent.pi_payment_id || '').trim();
  if (intentPaymentId && identifier && intentPaymentId !== identifier) {
    throw Object.assign(new Error('Pi payment identifier mismatch'), { status: 409 });
  }

  const payerUid = extractPayerUid(payment);
  if (payerUid && user?.pi_uid && payerUid.toLowerCase() !== String(user.pi_uid).toLowerCase()) {
    throw Object.assign(new Error('Pi payer mismatch'), { status: 403 });
  }

  const meta = parsePaymentMetadata(payment?.metadata);
  const metaIntentId = meta?.paymentIntentId || meta?.intentId || meta?.id;
  if (metaIntentId && String(metaIntentId) !== String(intent.id)) {
    throw Object.assign(new Error('Pi payment metadata binding is missing or invalid'), { status: 409 });
  }

  const amount = Number(payment?.amount);
  if (Number.isFinite(amount) && Math.abs(amount - Number(intent.amount)) > 0.001) {
    throw Object.assign(new Error('Pi payment amount mismatch'), { status: 409 });
  }

  const net = String(payment?.network || '').trim().toLowerCase();
  const isMainnet = net === 'pi mainnet' || net === 'mainnet' || net === 'pimainnet';
  if (isMainnet) {
    throw Object.assign(new Error('Mainnet payments are not permitted on Pi Testnet'), { status: 409 });
  }

  return normalizeStatus(payment?.status);
}

function validateTransactionTxid(payment, txid, required = false) {
  const expected = String(txid || '').trim();
  const reported = String(payment?.transaction?.txid || '').trim();
  if (reported && expected && reported !== expected) throw Object.assign(new Error('Pi transaction ID mismatch'), { status: 409 });
  if (required && !reported && !expected) throw Object.assign(new Error('Pi transaction ID is missing'), { status: 409 });
  return reported || expected;
}

async function approvePayment(request, env) {
  const traceId = 'appr_' + crypto.randomUUID().slice(0, 8);
  const user = await requireUser(request, env);
  const body = await readJson(request);
  if (!body.paymentId || !body.paymentIntentId) {
    return json({ error: 'paymentId and paymentIntentId are required', traceId, stage: 'params_validation' }, 400, request, env);
  }
  const intent = await env.RENTORA_DB.prepare('SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2 LIMIT 1').bind(body.paymentIntentId, user.id).first();
  if (!intent) {
    return json({ error: 'Payment intent not found', traceId, stage: 'intent_lookup' }, 404, request, env);
  }
  if (intent.status === 'completed') {
    return json({ approved: true, paymentId: body.paymentId, traceId, idempotent: true }, 200, request, env);
  }
  if (intent.pi_payment_id && intent.pi_payment_id !== body.paymentId) {
    return json({ error: 'Payment ID does not match intent', traceId, stage: 'intent_payment_mismatch' }, 409, request, env);
  }
  if (intent.status === 'approved' && intent.pi_payment_id === body.paymentId) {
    return json({ approved: true, paymentId: body.paymentId, traceId, idempotent: true }, 200, request, env);
  }

  const response = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}`);
  const payment = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`[Payment ${traceId}] Pi GET payment ${body.paymentId} failed:`, response.status, payment);
    return json({ error: piErrorMessage(payment, 'Unable to verify Pi payment'), piStatus: response.status, traceId, stage: 'pi_get_payment' }, 502, request, env);
  }

  let status;
  try {
    status = validatePayment(payment, { ...intent, pi_payment_id: body.paymentId }, user);
  } catch (valErr) {
    console.error(`[Payment ${traceId}] validation error:`, valErr.message);
    return json({ error: valErr.message, traceId, stage: 'payment_validation' }, valErr.status || 409, request, env);
  }

  if (status.cancelled || status.user_cancelled) {
    return json({ error: 'Pi payment is cancelled', traceId, stage: 'payment_status_check' }, 409, request, env);
  }

  if (!status.developer_approved) {
    const approvedResponse = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}/approve`, { method: 'POST', body: '{}' });
    const approved = await approvedResponse.json().catch(() => ({}));
    if (!approvedResponse.ok) {
      const alreadyApproved = approvedResponse.status === 400 && String(JSON.stringify(approved)).toLowerCase().includes('already');
      if (!alreadyApproved) {
        console.error(`[Payment ${traceId}] Pi POST approve ${body.paymentId} failed:`, approvedResponse.status, approved);
        return json({ error: piErrorMessage(approved, 'Pi payment approval failed'), piStatus: approvedResponse.status, traceId, stage: 'pi_approve_call' }, 502, request, env);
      }
    }
  }

  try {
    await env.RENTORA_DB.prepare("UPDATE payment_intents SET pi_payment_id=?1,status='approved',updated_at=?2 WHERE id=?3 AND status IN ('created','approved')").bind(body.paymentId, now(), intent.id).run();
  } catch (error) {
    console.error(`[Payment ${traceId}] approval persistence error`, error);
  }

  return json({ approved: true, paymentId: body.paymentId, traceId }, 200, request, env);
}

async function completePayment(request, env) {
  const traceId = 'comp_' + crypto.randomUUID().slice(0, 8);
  const user = await requireUser(request, env);
  const body = await readJson(request);
  if (!body.paymentId || !body.txid || !body.paymentIntentId) {
    return json({ error: 'paymentId, txid and paymentIntentId are required', traceId, stage: 'params_validation' }, 400, request, env);
  }
  const intent = await env.RENTORA_DB.prepare('SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2 LIMIT 1').bind(body.paymentIntentId, user.id).first();
  if (!intent) {
    return json({ error: 'Payment intent not found', traceId, stage: 'intent_lookup' }, 404, request, env);
  }
  if (intent.status === 'completed') {
    return json({ completed: true, paymentId: intent.pi_payment_id || body.paymentId, txid: intent.pi_txid || body.txid, traceId, idempotent: true }, 200, request, env);
  }
  if (intent.pi_payment_id && intent.pi_payment_id !== body.paymentId) {
    return json({ error: 'Payment ID does not match intent', traceId, stage: 'intent_payment_mismatch' }, 409, request, env);
  }

  const response = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}`);
  const payment = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`[Payment ${traceId}] Pi GET payment ${body.paymentId} before completion failed:`, response.status, payment);
    return json({ error: piErrorMessage(payment, 'Unable to verify Pi payment before completion'), piStatus: response.status, traceId, stage: 'pi_get_payment' }, 502, request, env);
  }

  let status;
  try {
    status = validatePayment(payment, { ...intent, pi_payment_id: body.paymentId }, user);
  } catch (valErr) {
    return json({ error: valErr.message, traceId, stage: 'payment_validation' }, valErr.status || 409, request, env);
  }

  if (status.cancelled || status.user_cancelled) {
    return json({ error: 'Pi payment is cancelled', traceId, stage: 'payment_status_cancelled' }, 409, request, env);
  }

  if (status.developer_completed) {
    try { validateTransactionTxid(payment, body.txid, true); } catch (txErr) { return json({ error: txErr.message, traceId, stage: 'txid_validation' }, txErr.status || 409, request, env); }
  } else {
    const completionResponse = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}/complete`, { method: 'POST', body: JSON.stringify({ txid: body.txid }) });
    const completion = await completionResponse.json().catch(() => ({}));
    if (!completionResponse.ok && !completion?.status?.developer_completed) {
      const alreadyCompleted = completionResponse.status === 400 && String(JSON.stringify(completion)).toLowerCase().includes('already');
      if (!alreadyCompleted) {
        console.error(`[Payment ${traceId}] Pi POST complete ${body.paymentId} failed:`, completionResponse.status, completion);
        return json({ error: piErrorMessage(completion, 'Pi payment completion failed'), piStatus: completionResponse.status, traceId, stage: 'pi_complete_call' }, 502, request, env);
      }
    }
    try { validateTransactionTxid(completion, body.txid, true); } catch (txErr) { return json({ error: txErr.message, traceId, stage: 'txid_validation' }, txErr.status || 409, request, env); }
  }

  try {
    await env.RENTORA_DB.batch([
      env.RENTORA_DB.prepare("UPDATE payment_intents SET pi_payment_id=?1,pi_txid=?2,status='completed',updated_at=?3 WHERE id=?4").bind(body.paymentId, body.txid, now(), intent.id),
      env.RENTORA_DB.prepare("UPDATE rentals SET payment_status='completed',status='confirmed',updated_at=?1 WHERE id=?2").bind(now(), intent.rental_id),
      env.RENTORA_DB.prepare("INSERT OR IGNORE INTO transactions(id,payment_intent_id,pi_payment_id,pi_txid,user_id,amount,type,status,created_at) VALUES(?1,?2,?3,?4,?5,?6,'platform_fee','completed',?7)").bind(`tx_${crypto.randomUUID()}`, intent.id, body.paymentId, body.txid, user.id, intent.amount, now())
    ]);
  } catch (error) {
    console.error(`[Payment ${traceId}] completion persistence error`, error);
    return json({ error: 'Pi payment completed but Rentora could not persist the confirmed rental.', traceId, stage: 'd1_complete_persist' }, 503, request, env);
  }

  return json({ completed: true, paymentId: body.paymentId, txid: body.txid, traceId }, 200, request, env);
}

async function handleIncompletePayment(request, env) {
  const traceId = 'incomp_' + crypto.randomUUID().slice(0, 8);
  const body = await readJson(request);
  const paymentObj = body?.payment || {};
  const paymentId = String(body?.paymentId || paymentObj?.identifier || paymentObj?.id || '').trim();
  const txid = String(body?.txid || paymentObj?.transaction?.txid || '').trim();
  
  if (!paymentId) {
    return json({ handled: false, error: 'paymentId is required' }, 400, request, env);
  }

  try {
    const response = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}`);
    const payment = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(`[Incomplete ${traceId}] Pi GET payment ${paymentId} failed:`, response.status, payment);
      return json({ handled: false, error: 'Unable to fetch Pi payment' }, 502, request, env);
    }

    const status = normalizeStatus(payment?.status);
    const resolvedTxid = txid || payment?.transaction?.txid;

    if (status.developer_completed) {
      if (env?.RENTORA_DB) {
        await env.RENTORA_DB.prepare("UPDATE payment_intents SET status='completed', pi_txid=?1, updated_at=?2 WHERE pi_payment_id=?3").bind(resolvedTxid || null, now(), paymentId).run().catch(() => {});
      }
      return json({ handled: true, status: 'completed', paymentId, traceId }, 200, request, env);
    }

    if (payment?.status?.transaction_verified && resolvedTxid) {
      const compRes = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}/complete`, {
        method: 'POST',
        body: JSON.stringify({ txid: resolvedTxid })
      });
      const compData = await compRes.json().catch(() => ({}));
      if (env?.RENTORA_DB) {
        await env.RENTORA_DB.prepare("UPDATE payment_intents SET status='completed', pi_txid=?1, updated_at=?2 WHERE pi_payment_id=?3").bind(resolvedTxid, now(), paymentId).run().catch(() => {});
      }
      return json({ handled: true, status: 'completed', paymentId, txid: resolvedTxid, traceId }, 200, request, env);
    }

    if (!status.developer_approved) {
      const appRes = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}/approve`, {
        method: 'POST',
        body: '{}'
      });
      const appData = await appRes.json().catch(() => ({}));
      return json({ handled: true, status: 'approved', paymentId, traceId }, 200, request, env);
    }

    return json({ handled: true, status: 'pending', paymentId, traceId }, 200, request, env);
  } catch (err) {
    console.error(`[Incomplete ${traceId}] error:`, err);
    return json({ handled: false, error: err.message, traceId }, 500, request, env);
  }
}

async function autoResolveIncompleteServerPayments(env, user) {
  try {
    const res = await piFetch(env, '/payments/incomplete_server_payments');
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    const incompleteList = data?.incomplete_server_payments || (Array.isArray(data) ? data : []);

    for (const payment of incompleteList) {
      const pid = payment?.identifier || payment?.id;
      if (!pid) continue;

      const txid = payment?.transaction?.txid;
      if (payment?.status?.transaction_verified && txid) {
        await piFetch(env, `/payments/${encodeURIComponent(pid)}/complete`, {
          method: 'POST',
          body: JSON.stringify({ txid })
        }).catch(() => {});

        if (env?.RENTORA_DB) {
          await env.RENTORA_DB.prepare(
            "INSERT INTO transactions(id, payment_intent_id, pi_payment_id, pi_txid, user_id, amount, type, status, created_at) VALUES(?1, ?2, ?3, ?4, ?5, ?6, 'admin_payout', 'completed', ?7) ON CONFLICT(pi_payment_id) DO NOTHING"
          ).bind(
            `tx_${crypto.randomUUID()}`,
            null,
            pid,
            txid,
            user?.id || 'admin',
            Number(payment?.amount || 0),
            now()
          ).run().catch(() => {});
        }
      } else {
        await piFetch(env, `/payments/${encodeURIComponent(pid)}/cancel`, {
          method: 'POST',
          body: '{}'
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('autoResolveIncompleteServerPayments warning:', err);
  }
}

async function adminRoute(request, env, path) {
  const user = await requireUser(request, env);
  if (!(adminAllowed(user.pi_uid, env) || adminAllowed(user.username, env))) return json({ error: 'Admin access required' }, 403, request, env);
  if (path === '/api/admin/users') {
    const rows = await env.RENTORA_DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    return json({ success: true, users: (rows.results || []).map((row) => userView(row, env)) }, 200, request, env);
  }
  if (path === '/api/admin/overview') {
    const [usersCount, listingsCount, rentalsCount, transactionsCount, revRow, payoutRow] = await Promise.all([
      env.RENTORA_DB.prepare('SELECT COUNT(*) AS c FROM users').first(),
      env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM listings WHERE status != 'deleted'").first(),
      env.RENTORA_DB.prepare('SELECT COUNT(*) AS c FROM rentals').first(),
      env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM transactions WHERE status='completed' AND (type='platform_fee' OR type IS NULL)").first(),
      env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND (type='platform_fee' OR type IS NULL)").first(),
      env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND type='admin_payout'").first()
    ]);
    const totalRev = Number(revRow?.total || 0);
    const totalPayouts = Number(payoutRow?.total || 0);
    const availableBalance = Math.max(0, totalRev - totalPayouts);
    return json({
      success: true,
      overview: {
        totalUsers: Number(usersCount?.c || 0),
        totalListings: Number(listingsCount?.c || 0),
        totalRentals: Number(rentalsCount?.c || 0),
        totalTransactions: Number(transactionsCount?.c || 0),
        totalPlatformRevenue: totalRev,
        totalPayouts,
        availableBalance,
        adminRecipient: user.username,
        openReports: 0
      }
    }, 200, request, env);
  }
  if (path === '/api/admin/payout' && request.method === 'POST') {
    const [revRow, payoutRow] = await Promise.all([
      env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND (type='platform_fee' OR type IS NULL)").first(),
      env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND type='admin_payout'").first()
    ]);
    const totalRev = Number(revRow?.total || 0);
    const totalPayouts = Number(payoutRow?.total || 0);
    const availableBalance = Math.max(0, totalRev - totalPayouts);

    const body = await readJson(request);
    let requestedAmount = Number(body?.amount || 0);
    if (!requestedAmount || isNaN(requestedAmount) || requestedAmount <= 0) {
      requestedAmount = availableBalance;
    }
    const amount = Number(requestedAmount.toFixed(4));
    if (amount <= 0 || amount > availableBalance) {
      return json({ error: `مبلغ درخواستی (${amount} π) از موجودی واقعی کارمزدها (${availableBalance.toFixed(4)} π) بیشتر است.` }, 400, request, env);
    }

    try {
      await autoResolveIncompleteServerPayments(env, user);

      const targetWallet = String(body?.walletAddress || '').trim();
      const paymentPayload = {
        amount,
        memo: String(body?.memo || `Rentora Treasury Payout to ${targetWallet ? targetWallet.slice(0, 8) + '...' : '@' + user.username}`).slice(0, 120),
        metadata: {
          type: 'admin_treasury_payout',
          adminUid: user.pi_uid,
          adminUsername: user.username,
          targetWallet: targetWallet || undefined,
          requestedAt: now()
        },
        uid: user.pi_uid
      };

      let piRes = await piFetch(env, '/payments', {
        method: 'POST',
        body: JSON.stringify({ payment: paymentPayload })
      });
      let created = await piRes.json().catch(() => ({}));

      if (!piRes.ok && (created?.error_message || '').includes('complete the ongoing payment')) {
        await autoResolveIncompleteServerPayments(env, user);
        piRes = await piFetch(env, '/payments', {
          method: 'POST',
          body: JSON.stringify({ payment: paymentPayload })
        });
        created = await piRes.json().catch(() => ({}));
      }

      if (!piRes.ok || !created?.identifier) {
        const errMsg = piErrorMessage(created, 'ایجاد تراکنش واریز به کاربر در شبکه پای رد شد.');
        return json({ error: errMsg, details: created }, 502, request, env);
      }

      const paymentId = created.identifier || created.id;

      const appRes = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}/approve`, {
        method: 'POST',
        body: '{}'
      });
      const approved = await appRes.json().catch(() => ({}));
      if (!appRes.ok && !approved?.status?.developer_approved) {
        const errMsg = piErrorMessage(approved, 'تایید تراکنش واریز در سرور پای ناموفق بود.');
        return json({ error: errMsg, details: approved, paymentId }, 502, request, env);
      }

      let paymentInfo = approved;
      if (!paymentInfo?.transaction?.txid) {
        const getRes = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}`);
        if (getRes.ok) {
          paymentInfo = await getRes.json().catch(() => ({}));
        }
      }

      const txid = paymentInfo?.transaction?.txid;
      if (!txid) {
        return json({
          success: true,
          pending: true,
          paymentId,
          amount,
          recipient: targetWallet || user.username,
          message: `تراکنش واریز مبلغ ${amount} π در شبکه پای تایید شد و پس از اجرای بلاک‌چین نهایی می‌گردد.`
        }, 202, request, env);
      }

      const compRes = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}/complete`, {
        method: 'POST',
        body: JSON.stringify({ txid })
      });
      const compData = await compRes.json().catch(() => ({}));
      if (!compRes.ok && !compData?.status?.developer_completed) {
        const errMsg = piErrorMessage(compData, 'تکمیل نهایی تراکنش در شبکه پای ناموفق بود.');
        return json({ error: errMsg, details: compData, paymentId, txid }, 502, request, env);
      }

      await env.RENTORA_DB.prepare(
        "INSERT INTO transactions(id, payment_intent_id, pi_payment_id, pi_txid, user_id, amount, type, status, created_at) VALUES(?1, ?2, ?3, ?4, ?5, ?6, 'admin_payout', 'completed', ?7)"
      ).bind(
        `tx_${crypto.randomUUID()}`,
        null,
        paymentId,
        txid,
        user.id,
        amount,
        now()
      ).run();

      return json({
        success: true,
        paymentId,
        txid,
        amount,
        recipient: targetWallet || user.username,
        message: `مبلغ ${amount} π با موفقیت به حساب پای ${targetWallet ? targetWallet.slice(0, 8) + '...' : '@' + user.username} واریز گردید.`
      }, 200, request, env);
    } catch (err) {
      console.error('Payout error', err);
      return json({ error: err.message || 'خطا در اجرای تسویه حساب' }, 500, request, env);
    }
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
          if (configured.length === 0 || configured.includes(origin) || configured.includes('*')) allowed = true;
          if (allowed) headers['Access-Control-Allow-Origin'] = origin;
        }
        return new Response(null, { status: 204, headers });
      }
      if (request.method === 'GET' && path === '/api/health') {
        const rawKey = env?.PI_API_KEY || env?.PI_SERVER_API_KEY;
        const sanitizedKey = sanitizePiApiKey(rawKey);
        let piKeyValid = false;
        let piKeyError = null;

        if (sanitizedKey) {
          try {
            const piRes = await fetch('https://api.minepi.com/v2/payments/probe_health_check', {
              headers: { Authorization: `Key ${sanitizedKey}` }
            });
            if (piRes.status === 404) {
              piKeyValid = true;
            } else if (piRes.status === 401 || piRes.status === 403) {
              const errBody = await piRes.json().catch(() => ({}));
              piKeyError = errBody.error_message || errBody.error || errBody.message || 'Invalid API Key';
            } else {
              piKeyValid = piRes.ok;
            }
          } catch (e) {
            piKeyError = e.message;
          }
        }

        const checks = {
          piApiKeyConfigured: Boolean(sanitizedKey),
          piApiKeyLength: sanitizedKey ? sanitizedKey.length : 0,
          piApiKeyValid: piKeyValid,
          piKeyError: piKeyError || undefined,
          piApiUrlConfigured: Boolean(env?.PI_API_URL),
          databaseBound: Boolean(env?.RENTORA_DB),
          sessionStoreBound: Boolean(env?.RENTORA_KV),
        };
        const healthy = Boolean(checks.piApiKeyConfigured && checks.databaseBound && checks.sessionStoreBound);
        return json({ ok: healthy, checks }, healthy ? 200 : 503, request, env);
      }
      if (request.method === 'POST' && path === '/api/payments/incomplete') return await handleIncompletePayment(request, env);
      if (request.method === 'POST' && path === '/api/payments/approve') return await approvePayment(request, env);
      if (request.method === 'POST' && path === '/api/payments/complete') return await completePayment(request, env);
      if (request.method === 'GET' && path === '/api/auth/me') {
        const user = await requireUser(request, env);
        const isAdmin = adminAllowed(user.pi_uid, env) || adminAllowed(user.username, env);
        return json({ authenticated: true, user: { ...userView(user, env), isAdmin }, isAdmin }, 200, request, env);
      }
      if ((request.method === 'GET' && (path === '/api/admin/overview' || path === '/api/admin/users')) || (request.method === 'POST' && path === '/api/admin/payout')) return await adminRoute(request, env, path);
      return legacyWorker.fetch(request, env, ctx);
    } catch (err) {
      console.error('Gateway error', err);
      const msg = String(err?.message || '');
      let status = Number(err?.status) || 500;
      let displayMessage = err?.message || 'Server error';
      if (msg.includes('already reserved') || msg.includes('overlap')) {
        status = 409;
        displayMessage = 'این کالا برای تاریخ‌های انتخابی در دسترس نیست یا قبلاً رزرو شده است.';
      } else if (msg.includes('UNIQUE constraint')) {
        status = 409;
        displayMessage = 'این درخواست قبلاً ثبت شده است.';
      }
      return json({ error: displayMessage }, status, request, env);
    }
  }
};
