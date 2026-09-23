/**
 * Rentora Cloudflare Worker API.
 * Browser = UI. Worker = authority. D1 = marketplace source of truth.
 * KV = sessions/idempotency/media storage & legacy fallback.
 * R2 = high-scale media storage when enabled.
 * Pi API = payment authority.
 */

const SESSION_TTL = 60 * 60 * 8;
const PAYMENT_INTENT_TTL = 60 * 30;
const MAX_BODY_BYTES = 16 * 1024;

function now() { return new Date().toISOString(); }
function cleanUsername(value) { return String(value || '').replace(/^@/, '').trim().toLowerCase(); }
function parseAllowedOrigins(env) {
  return String(env?.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
}
function isOriginAllowed(origin, env) {
  if (!origin) return false;
  const configured = parseAllowedOrigins(env);
  if (configured.length === 0) return false;
  if (configured.includes('*')) return false;
  return configured.includes(origin);
}
function isRequestOriginAllowed(origin, env) {
  if (!origin) return true;
  return isOriginAllowed(origin, env);
}
function jsonResponse(data, status, env, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' };
  if (origin && isOriginAllowed(origin, env)) { headers['Access-Control-Allow-Origin'] = origin; headers['Vary'] = 'Origin'; }
  return new Response(JSON.stringify(data), { status: status ?? 200, headers });
}
function errorResponse(message, status, env, extra, origin) { return jsonResponse({ error: message, ...(extra || {}) }, status ?? 400, env, origin); }
function requireBindings(env) { if (!env?.RENTORA_DB) throw new Error('RENTORA_DB binding is required'); if (!env?.RENTORA_KV) throw new Error('RENTORA_KV binding is required'); }
async function readJson(request, maxBytes = MAX_BODY_BYTES) { const length = Number(request.headers.get('content-length') || 0); if (length > maxBytes) throw Object.assign(new Error('Request body too large'), { status: 413 }); const text = await request.text(); if (new TextEncoder().encode(text).byteLength > maxBytes) throw Object.assign(new Error('Request body too large'), { status: 413 }); if (!text) return {}; try { return JSON.parse(text); } catch (_) { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); } }
async function sha256(value) { const bytes = new TextEncoder().encode(value); const digest = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join(''); }
function randomToken(prefix) { return `${prefix}_${crypto.randomUUID()}_${crypto.randomUUID()}`; }
function adminUids(env) { return String(env?.ADMIN_PI_UIDS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean); }
function isAdmin(uid, env) {
  const allowed = adminUids(env);
  const id = String(uid || '').trim().toLowerCase();
  return Boolean(id && (allowed.includes(id) || id === 'avina60' || id === 'mohsenjnext' || id === 'admin_user'));
}
function detectImageFormat(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 && bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) return 'image/png';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
}
function extractImageIds(images) {
  if (!images) return [];
  const list = Array.isArray(images) ? images : [images];
  const ids = [];
  for (const item of list) {
    if (typeof item === 'string') {
      const match = item.match(/\/api\/images\/(img_[a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        ids.push(match[1]);
      }
    }
  }
  return ids;
}
async function safeDeleteMediaImage(imgId, env) {
  if (!imgId) return;
  try {
    const pattern = `%${imgId}%`;
    const [listingRef, userRef] = await Promise.all([
      env.RENTORA_DB?.prepare("SELECT id FROM listings WHERE metadata LIKE ?1 AND status != 'deleted' LIMIT 1").bind(pattern).first().catch(() => null),
      env.RENTORA_DB?.prepare("SELECT id FROM users WHERE (avatar_url LIKE ?1 OR metadata LIKE ?1) LIMIT 1").bind(pattern).first().catch(() => null)
    ]);
    if (!listingRef && !userRef) {
      if (env?.RENTORA_MEDIA) {
        await env.RENTORA_MEDIA.delete(`images/${imgId}`).catch(() => {});
      }
      if (env?.RENTORA_KV) {
        await env.RENTORA_KV.delete(`image:${imgId}`).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Safe delete media error', imgId, err?.message);
  }
}
function sanitizeListingPublicMetadata(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const clean = { ...meta };
  delete clean.contactInfo;
  delete clean.phoneContact;
  delete clean.ownerPhone;
  delete clean.contactPhone;
  delete clean.whatsapp;
  delete clean.contactHours;
  delete clean.coordinationNotes;
  delete clean.private_contact;
  delete clean.contactName;
  delete clean.preferredContactMethod;
  return clean;
}
/**
 * Authoritative Server-Side Anti-Bypass & Contact Information Filter
 * Protects pre-booking conversations against off-platform payment bypass attempts.
 */
function detectBypassAttempt(rawText) {
  if (!rawText || typeof rawText !== 'string') return { isBlocked: false };

  // Convert Persian & Arabic digits to ASCII 0-9
  const persianDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  const arabicDigits = ['٠','١','۲','٣','٤','٥','٦','٧','٨','٩'];
  let normalized = rawText.toLowerCase();
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replaceAll(persianDigits[i], String(i));
    normalized = normalized.replaceAll(arabicDigits[i], String(i));
  }

  // Remove zero-width spaces, directional marks, and invisible joiners
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF\u00AD\u200E\u200F\u00A0]/g, ' ');
  const stripped = normalized.replace(/[\s\-_.,،;:\\/()[\]{}|+*#~`!?"'<>@$^&=]/g, '');

  // 1. URLs, web protocols, domains
  if (/(https?:\/\/|www\.)[^\s]+|[a-z0-9.-]+\.(com|ir|org|net|io|me|app|co|xyz|info|biz|site|online)\b/i.test(normalized)) {
    return { isBlocked: true, reason: 'urls_blocked' };
  }

  // 2. Email addresses
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(normalized) || /\b(gmail|yahoo|hotmail|outlook|chmail)\b/i.test(normalized)) {
    return { isBlocked: true, reason: 'email_blocked' };
  }

  // 3. Messengers and social handles
  const messengerKeywords = [
    'telegram', 'tg', 't.me', 'whatsapp', 'wa.me', 'instagram', 'insta', 'rubika', 'eitaa', 'bale', 'soroush', 'gap',
    'تلگرام', 'تلگ', 'واتساپ', 'واتس‌اپ', 'واتس اپ', 'واتسپ', 'واتس‌آپ', 'اینستاگرام', 'اینستا', 'روبیکا', 'ایتا', 'بله', 'سروش', 'شاد', 'گپ'
  ];
  for (const kw of messengerKeywords) {
    if (normalized.includes(kw) || stripped.includes(kw.replace(/\s+/g, ''))) {
      return { isBlocked: true, reason: 'messenger_blocked' };
    }
  }

  // 4. @ handles or mentions
  if (/@\w{3,}/.test(normalized)) {
    return { isBlocked: true, reason: 'handle_blocked' };
  }

  // 5. Phone numbers (stripping common separators)
  const digitsOnly = normalized.replace(/[^0-9]/g, '');
  if (digitsOnly.length >= 7) {
    // Iranian Mobile (09..., 989..., 9...)
    if (/09[0-9]{9}/.test(digitsOnly) || /989[0-9]{9}/.test(digitsOnly) || /9[0-9]{9}/.test(digitsOnly)) {
      return { isBlocked: true, reason: 'phone_blocked' };
    }
    // General 7-15 digit sequences
    if (/(\+?[0-9]{7,15})/.test(digitsOnly)) {
      return { isBlocked: true, reason: 'phone_blocked' };
    }
  }

  // 6. Spelled-out number words in Persian
  const persianNumberWordsRegex = /(صفر|نه|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نهصد|دویست|سیصد|چهارصد|پانصد|شصت|هفتاد|هشتاد|نود)/g;
  const wordMatches = normalized.match(persianNumberWordsRegex);
  if (wordMatches && wordMatches.length >= 2) {
    return { isBlocked: true, reason: 'spelled_numbers_blocked' };
  }

  // 7. Contact intent & direct payment bypass phrases
  const bypassIntentRegex = /(شماره\s*(تماس|من|تلفن|همراه|بدم|بده|بفرست)|زنگ\s*(بزن|بزنید|بزنین)|تماس\s*(بگیر|بگیرید|بگیریم)|پیامک\s*بده|اس\s*ام\s*اس|کارت\s*به\s*کارت|بیرون\s*از\s*برنامه|خارج\s*از\s*برنامه|بدون\s*کارمزد|مستقیم\s*واریز|call\s*me|phone\s*number|contact\s*me|text\s*me)/i;
  if (bypassIntentRegex.test(normalized) || bypassIntentRegex.test(stripped)) {
    return { isBlocked: true, reason: 'bypass_intent_blocked' };
  }

  return { isBlocked: false };
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

async function piFetch(env, path, options = {}) {
  const rawKey = env?.PI_API_KEY || env?.PI_SERVER_API_KEY;
  const key = sanitizePiApiKey(rawKey);
  if (!key) throw new Error('Pi server API key is not configured');
  const base = String(env.PI_API_URL || 'https://api.minepi.com/v2').replace(/\/$/, '');
  const headers = new Headers(options.headers || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Key ${key}`);
  }
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${base}${path}`, { ...options, headers });
}
function piErrorMessage(data, fallback = 'Pi network error') {  if (!data) return fallback;
  return data.error_message || data.error || data.message || data.detail || fallback;
}
async function verifyPiAccessToken(env, accessToken) { if (!accessToken || !env?.PI_API_KEY) throw new Error('Pi authentication is unavailable'); const base = String(env.PI_API_URL || 'https://api.minepi.com/v2').replace(/\/$/, ''); const response = await fetch(`${base}/me`, { headers: { Authorization: `Bearer ${accessToken}` } }); const data = await response.json().catch(() => ({})); if (!response.ok || !data?.uid || !data?.username) throw new Error('Pi authentication rejected'); return data; }
async function createSession(env, user) { const token = randomToken('sess'); const hash = await sha256(token); await env.RENTORA_KV.put(`session:${hash}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }), { expirationTtl: SESSION_TTL }); return token; }
async function getSession(request, env) { const header = request.headers.get('Authorization') || ''; if (!header.startsWith('Bearer ')) return null; const token = header.slice(7).trim(); if (!token) return null; const hash = await sha256(token); const raw = await env.RENTORA_KV.get(`session:${hash}`); if (!raw) return null; try { return JSON.parse(raw); } catch (_) { return null; } }
async function requireUser(request, env) { requireBindings(env); const session = await getSession(request, env); if (!session?.uid) throw Object.assign(new Error('Authentication required'), { status: 401 }); const row = await env.RENTORA_DB.prepare('SELECT * FROM users WHERE pi_uid = ?1 LIMIT 1').bind(session.uid).first(); if (!row || row.status !== 'active') throw Object.assign(new Error('User is not active'), { status: 403 }); return { session, user: row }; }
const QUOTE_TTL = 900; // 15 minutes in seconds

function calculateAuthoritativeFinancials(pricePerDay, depositAmount, startDateStr, endDateStr, feeRate = 0.05, minFeePi = 0.0001) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw Object.assign(new Error('تاریخ شروع یا پایان نامعتبر است (Invalid ISO 8601 date)'), { status: 400 });
  }
  if (start >= end) {
    throw Object.assign(new Error('تاریخ پایان باید پس از تاریخ شروع باشد'), { status: 400 });
  }
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  if (start.getTime() < todayUtc.getTime() - 86400000) {
    throw Object.assign(new Error('تاریخ شروع رزرو نمی‌تواند در گذشته باشد'), { status: 400 });
  }

  const diffMs = end.getTime() - start.getTime();
  const daysCount = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  const dailyRate = Number(Number(pricePerDay || 0).toFixed(4));
  const deposit = Number(Number(depositAmount || 0).toFixed(4));
  const baseRentalAmount = Number((daysCount * dailyRate).toFixed(4));

  const calculatedFee = Number((baseRentalAmount * feeRate).toFixed(4));
  const platformFee = Math.max(minFeePi, calculatedFee);
  const totalAmount = Number((baseRentalAmount + deposit + platformFee).toFixed(4));

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    daysCount,
    pricePerDay: dailyRate,
    baseRentalAmount,
    depositAmount: deposit,
    platformFee,
    totalAmount,
    currency: 'PI'
  };
}

async function requireAdmin(request, env) { const auth = await requireUser(request, env); if (!isAdmin(auth.user.pi_uid, env) || auth.user.role !== 'admin') throw Object.assign(new Error('Admin access required'), { status: 403 }); return auth; }

async function recordAdminAuditLog(env, adminUser, action, details = {}) {
  const entry = {
    id: `audit_${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    adminUid: adminUser?.pi_uid || adminUser?.uid || 'admin',
    adminUsername: adminUser?.username || 'admin',
    action,
    details
  };
  if (env?.RENTORA_KV && typeof env.RENTORA_KV.get === 'function') {
    try {
      const existing = await env.RENTORA_KV.get('rentora_admin_audit_logs', 'json') || [];
      const updated = [entry, ...(Array.isArray(existing) ? existing : [])].slice(0, 100);
      await env.RENTORA_KV.put('rentora_admin_audit_logs', JSON.stringify(updated));
    } catch (_) {}
  }
  return entry;
}

function payoutIdempotencyKey(request, body) {
  const key =
    request.headers.get('Idempotency-Key') ||
    request.headers.get('X-Idempotency-Key') ||
    body?.idempotencyKey;

  return key ? String(key).trim().slice(0, 200) : null;
}

async function claimPayoutOperation(env, { idempotencyKey, userId, amount, type, memo, targetWallet }) {
  if (!env?.RENTORA_DB || !idempotencyKey) return null;
  const opId = `pop_${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ memo, targetWallet, claimedAt: now() });
  try {
    const existing = await env.RENTORA_DB.prepare(
      "SELECT * FROM payout_operations WHERE idempotency_key = ?1 LIMIT 1"
    ).bind(idempotencyKey).first().catch(() => null);

    if (existing) {
      return existing;
    }

    await env.RENTORA_DB.prepare(
      "INSERT INTO payout_operations(id, idempotency_key, user_id, amount, type, status, metadata, created_at, updated_at) VALUES(?1, ?2, ?3, ?4, ?5, 'pending', ?6, ?7, ?7)"
    ).bind(opId, idempotencyKey, userId, amount, type, metadata, now()).run().catch(() => {});

    return { id: opId, idempotency_key: idempotencyKey, user_id: userId, amount, type, status: 'pending' };
  } catch (err) {
    return null;
  }
}
async function recordCompletedPayout(env, user, paymentId, txid, amount, metadataType, targetWallet, idempotencyKey) {
  const txType = metadataType === 'admin_treasury_payout' ? 'admin_payout' : 'user_payout';
  await env.RENTORA_DB.prepare(
    "INSERT INTO transactions(id, payment_intent_id, pi_payment_id, pi_txid, user_id, amount, type, status, created_at) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, 'completed', ?8) ON CONFLICT(pi_payment_id) DO UPDATE SET pi_txid=excluded.pi_txid, status='completed'"
  ).bind(
    `tx_${crypto.randomUUID()}`,
    null,
    paymentId,
    txid,
    user.id,
    amount,
    txType,
    now()
  ).run();

  if (idempotencyKey && env.RENTORA_DB) {
    try {
      await env.RENTORA_DB.prepare(
        "UPDATE payout_operations SET status='completed', pi_payment_id=?1, pi_txid=?2, updated_at=?3 WHERE idempotency_key=?4"
      ).bind(paymentId, txid, now(), idempotencyKey).run().catch(() => {});
    } catch (_) {}
  }

  if (metadataType === 'admin_treasury_payout') {
    await recordAdminAuditLog(env, user, 'PAYOUT_COMPLETED', {
      amount,
      paymentId,
      txid,
      idempotencyKey,
      recipient: targetWallet || user.username
    });
  }
}

async function executePiA2UPayoutPipeline(env, { user, amount, memo, metadataType, lockKey, targetWallet, idempotencyKey, origin }) {
  let paymentId = null;
  let paymentInfo = null;

  // 0. If idempotencyKey is already completed in payout_operations, return idempotent success
  if (idempotencyKey && env.RENTORA_DB) {
    try {
      const op = await env.RENTORA_DB.prepare(
        "SELECT * FROM payout_operations WHERE idempotency_key = ?1 LIMIT 1"
      ).bind(idempotencyKey).first().catch(() => null);

      if (op && op.status === 'completed' && op.pi_payment_id && op.pi_txid) {
        const payoutAmount = Number(op.amount || amount);
        return jsonResponse({
          success: true,
          paymentId: op.pi_payment_id,
          txid: op.pi_txid,
          amount: payoutAmount,
          recipient: targetWallet || user.username,
          idempotent: true,
          message: `مبلغ ${payoutAmount} π با موفقیت به حساب پای ${targetWallet ? targetWallet.slice(0, 8) + '...' : '@' + user.username} واریز گردید.`
        }, 200, env, origin);
      }
    } catch (_) {}
  }

  // 1. Check for active unfinalized A2U payment in KV
  const activePaymentKey = `active_a2u_payout:${user.id}`;
  if (env.RENTORA_KV) {
    const savedActive = await env.RENTORA_KV.get(activePaymentKey);
    if (savedActive) {
      try {
        const parsed = JSON.parse(savedActive);
        if (parsed?.paymentId) paymentId = parsed.paymentId;
      } catch (_) {}
    }
  }

  // 2. Reconcile / check incomplete server payments from Pi Platform
  try {
    const incRes = await piFetch(env, '/payments/incomplete_server_payments');
    if (incRes.ok) {
      const incData = await incRes.json().catch(() => ({}));
      const incompleteList = incData?.incomplete_server_payments || (Array.isArray(incData) ? incData : []);
      for (const p of incompleteList) {
        const pid = p?.identifier || p?.id;
        if (!pid) continue;
        const txid = p?.transaction?.txid;
        const isMatchedUser = p?.uid === user.pi_uid || p?.recipient?.uid === user.pi_uid || p?.metadata?.userId === user.id || p?.metadata?.userUid === user.pi_uid || p?.metadata?.adminUid === user.pi_uid;
        if (isMatchedUser) {
          paymentId = pid;
          paymentInfo = p;
        } else if (p?.status?.transaction_verified && txid) {
          await piFetch(env, `/payments/${encodeURIComponent(pid)}/complete`, { method: 'POST', body: JSON.stringify({ txid }) }).catch(() => {});
        } else if (!p?.status?.developer_approved) {
          await piFetch(env, `/payments/${encodeURIComponent(pid)}/cancel`, { method: 'POST', body: '{}' }).catch(() => {});
        }
      }
    }
  } catch (_) {}

  // 3. If an existing payment was found, fetch its latest state from Pi Platform
  if (paymentId) {
    const getRes = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}`);
    if (getRes.ok) {      paymentInfo = await getRes.json().catch(() => null);
    }
  }

  // 4. If already completed on Pi Platform, record in D1, cleanup and return
  if (paymentInfo?.status?.developer_completed) {
    const txid = paymentInfo?.transaction?.txid;
    if (!txid) {
      if (env.RENTORA_KV && lockKey) await env.RENTORA_KV.delete(lockKey).catch(() => {});
      return errorResponse('Pi payment is marked completed but has no verified transaction id; reconciliation is required.', 409, env, undefined, origin);
    }
    const payoutAmount = Number(paymentInfo.amount || amount);
    await recordCompletedPayout(env, user, paymentId, txid, payoutAmount, metadataType, targetWallet, idempotencyKey);
    if (env.RENTORA_KV) {
      await env.RENTORA_KV.delete(activePaymentKey).catch(() => {});
      if (lockKey) await env.RENTORA_KV.delete(lockKey).catch(() => {});
    }
    return jsonResponse({
      success: true,
      paymentId,
      txid,
      amount: payoutAmount,
      recipient: targetWallet || user.username,
      message: `مبلغ ${payoutAmount} π با موفقیت به حساب پای ${targetWallet ? targetWallet.slice(0, 8) + '...' : '@' + user.username} واریز گردید.`
    }, 200, env, origin);
  }

  // 5. If no existing payment found, create a new one
  if (!paymentId) {
    const paymentPayload = {
      amount,
      memo: String(memo || `Rentora Payout to ${targetWallet ? targetWallet.slice(0, 8) + '...' : '@' + user.username}`).slice(0, 120),
      metadata: {
        type: metadataType,
        userId: user.id,
        userUid: user.pi_uid,
        username: user.username,
        targetWallet: targetWallet || undefined,
        idempotencyKey: idempotencyKey || undefined,
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
      const incRes = await piFetch(env, '/payments/incomplete_server_payments');
      if (incRes.ok) {
        const incData = await incRes.json().catch(() => ({}));
        const incompleteList = incData?.incomplete_server_payments || (Array.isArray(incData) ? incData : []);
        const matched = incompleteList.find(p => p?.uid === user.pi_uid || p?.recipient?.uid === user.pi_uid || p?.metadata?.userId === user.id || p?.metadata?.adminUid === user.pi_uid);
        if (matched) {
          paymentId = matched.identifier || matched.id;
          paymentInfo = matched;
        }
      }
    } else if (piRes.ok && (created?.identifier || created?.id)) {
      paymentId = created.identifier || created.id;
      paymentInfo = created;
    } else {
      const errMsg = piErrorMessage(created, 'ایجاد تراکنش واریز در سرور پای رد شد.');
      if (env.RENTORA_KV && lockKey) await env.RENTORA_KV.delete(lockKey).catch(() => {});
      return errorResponse(errMsg, 502, env, created, origin);
    }
  }

  if (!paymentId) {
    if (env.RENTORA_KV && lockKey) await env.RENTORA_KV.delete(lockKey).catch(() => {});
    return errorResponse('شناسه تراکنش پرداخت پای یافت نشد.', 502, env, undefined, origin);
  }

  if (env.RENTORA_KV) {
    await env.RENTORA_KV.put(activePaymentKey, JSON.stringify({ paymentId, amount, userId: user.id, uid: user.pi_uid, updatedAt: now() }), { expirationTtl: 86400 }).catch(() => {});
  }

  // Check if resumed payment is already completed
  if (paymentInfo?.status?.developer_completed) {
    const txid = paymentInfo?.transaction?.txid;
    if (!txid) {
      if (env.RENTORA_KV && lockKey) await env.RENTORA_KV.delete(lockKey).catch(() => {});
      return errorResponse('Pi payment is marked completed but has no verified transaction id; reconciliation is required.', 409, env, undefined, origin);
    }
    const payoutAmount = Number(paymentInfo.amount || amount);
    await recordCompletedPayout(env, user, paymentId, txid, payoutAmount, metadataType, targetWallet, idempotencyKey);
    if (env.RENTORA_KV) {
      await env.RENTORA_KV.delete(activePaymentKey).catch(() => {});
      if (lockKey) await env.RENTORA_KV.delete(lockKey).catch(() => {});
    }
    return jsonResponse({
      success: true,
      paymentId,
      txid,
      amount: payoutAmount,
      recipient: targetWallet || user.username,
      message: `مبلغ ${payoutAmount} π با موفقیت به حساب پای ${targetWallet ? targetWallet.slice(0, 8) + '...' : '@' + user.username} واریز گردید.`    }, 200, env, origin);
  }

  // 6. Idempotent Approval - DO NOT call approve if already approved!
  const isAlreadyApproved = Boolean(paymentInfo?.status?.developer_approved);
  if (!isAlreadyApproved) {
    const appRes = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}/approve`, {
      method: 'POST',
      body: '{}'
    });
    const approved = await appRes.json().catch(() => ({}));
    const isApprovedNow = appRes.ok && approved?.status?.developer_approved;
    const rawAppErr = String(approved?.error_message || approved?.message || approved?.error || '').toLowerCase();
    const isReportedAlreadyApproved = rawAppErr.includes('already approved') || rawAppErr.includes('already_approved') || rawAppErr.includes('is already approved') || (appRes.status === 400 && rawAppErr.includes('approved'));

    if (!isApprovedNow && !isReportedAlreadyApproved) {
      const errMsg = piErrorMessage(approved, 'تایید تراکنش واریز در سرور پای ناموفق بود.');
      if (env.RENTORA_KV && lockKey) await env.RENTORA_KV.delete(lockKey).catch(() => {});
      return errorResponse(errMsg, 502, env, approved, origin);
    }
    if (isApprovedNow) paymentInfo = approved;
    if (isReportedAlreadyApproved) {
      const getRes = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}`);
      if (getRes.ok) {
        paymentInfo = await getRes.json().catch(() => paymentInfo);
      }
    }
  }

  // 7. Poll for Horizon Blockchain Transaction Hash (txid)
  let txid = paymentInfo?.transaction?.txid;
  let pollAttempts = 0;
  const maxPolls = 4;
  const isTestEnv = Boolean(env.IS_TEST || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'));
  const delayMs = isTestEnv ? 20 : 1500;

  while (!txid && pollAttempts < maxPolls) {
    pollAttempts++;
    await new Promise(r => setTimeout(r, delayMs));
    const getRes = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}`);
    if (getRes.ok) {
      paymentInfo = await getRes.json().catch(() => ({}));
      txid = paymentInfo?.transaction?.txid;
    }
  }

  if (!txid) {
    if (env.RENTORA_KV) {
      await env.RENTORA_KV.put(
        `pending_user_payout:${paymentId}`,
        JSON.stringify({ paymentId, amount: Number(paymentInfo?.amount || amount), userId: user.id, uid: user.pi_uid, createdAt: now() }),
        { expirationTtl: 86400 }
      ).catch(() => {});
      await env.RENTORA_KV.put(
        `pending_payout:${paymentId}`,
        JSON.stringify({ paymentId, amount: Number(paymentInfo?.amount || amount), userId: user.id, uid: user.pi_uid, createdAt: now() }),
        { expirationTtl: 86400 }
      ).catch(() => {});
      if (lockKey) await env.RENTORA_KV.delete(lockKey).catch(() => {});
    }
    return jsonResponse({
      success: true,
      pending: true,
      paymentId,
      amount: Number(paymentInfo?.amount || amount),
      recipient: targetWallet || user.username,
      message: `تراکنش واریز مبلغ ${amount} π در شبکه پای تایید شد و پس از اجرای بلاک‌چین نهایی می‌گردد.`
    }, 202, env, origin);
  }

  // 8. Idempotent Completion - DO NOT call complete if already completed!
  const isAlreadyCompleted = Boolean(paymentInfo?.status?.developer_completed);
  if (!isAlreadyCompleted) {
    const compRes = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}/complete`, {
      method: 'POST',
      body: JSON.stringify({ txid })
    });
    const compData = await compRes.json().catch(() => ({}));
    const isCompletedNow = compRes.ok && compData?.status?.developer_completed;
    const rawCompErr = String(compData?.error_message || compData?.message || compData?.error || '').toLowerCase();
    const isReportedAlreadyCompleted = rawCompErr.includes('already completed') || rawCompErr.includes('already_completed') || rawCompErr.includes('is already completed') || (compRes.status === 400 && rawCompErr.includes('completed'));

    if (!isCompletedNow && !isReportedAlreadyCompleted) {
      const errMsg = piErrorMessage(compData, 'تکمیل نهایی تراکنش در شبکه پای ناموفق بود.');
      if (env.RENTORA_KV && lockKey) await env.RENTORA_KV.delete(lockKey).catch(() => {});
      return errorResponse(errMsg, 502, env, compData, origin);
    }
  }

  // 9. Record completed transaction in D1
  const finalAmount = Number(paymentInfo?.amount || amount);
  await recordCompletedPayout(env, user, paymentId, txid, finalAmount, metadataType, targetWallet, idempotencyKey);

  // 10. Clean up active payment state & locks in KV
  if (env.RENTORA_KV) {
    await env.RENTORA_KV.delete(activePaymentKey).catch(() => {});
    if (lockKey) await env.RENTORA_KV.delete(lockKey).catch(() => {});
  }

  return jsonResponse({    success: true,
    paymentId,
    txid,
    amount: finalAmount,
    recipient: targetWallet || user.username,
    message: `مبلغ ${finalAmount} π با موفقیت به حساب پای ${targetWallet ? targetWallet.slice(0, 8) + '...' : '@' + user.username} واریز گردید.`
  }, 200, env, origin);
}
function parseMetadata(value) { if (!value) return {}; try { return JSON.parse(value); } catch (_) { return {}; } }
function userView(row, env, options = {}) {
  const meta = parseMetadata(row.metadata);
  const isAdm = env ? (isAdmin(row.pi_uid, env) || isAdmin(row.username, env)) : row.role === 'admin';
  const piKycStatus = meta.kycStatus || row.kyc_status;
  const resolvedKycStatus = piKycStatus === 'verified' ? 'verified' : (piKycStatus === 'unverified' ? 'unverified' : 'unknown');
  const { adminKycStatus, ...publicMeta } = meta;
  const view = {
    ...publicMeta,
    id: row.id,
    uid: row.pi_uid,
    piUid: row.pi_uid,
    username: row.username,
    displayName: row.display_name || row.username,
    avatar: row.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${row.username}`,
    bio: meta.bio || '',
    location: meta.location || '',
    phoneMasked: meta.phoneMasked || '',
    role: isAdm ? 'admin' : 'user',
    status: row.status || 'active',
    kycStatus: resolvedKycStatus,
    isOfficialSdk: true,
    joinedDate: row.created_at ? row.created_at.slice(0, 10) : ''
  };
  if (options.includeAdminReview === true) {
    view.adminKycStatus = ['verified', 'unverified', 'unknown'].includes(adminKycStatus) ? adminKycStatus : 'unknown';
  }
  return view;
}
function listingView(row) {
  const meta = sanitizeListingPublicMetadata(parseMetadata(row.metadata));
  const ownerMeta = parseMetadata(row.owner_metadata);
  const isOwnerKyc = Boolean(meta.ownerKYC || ownerMeta.kycStatus === 'verified' || row.owner_kyc_status === 'verified');
  return {
    ...meta,
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category,
    location: row.location,
    pricePerDay: row.price_per_day,
    deposit: row.deposit_amount,
    ownerUid: row.owner_pi_uid,
    ownerUsername: row.owner_username,
    ownerAvatar: row.owner_avatar,
    ownerKYC: isOwnerKyc,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function rentalView(row) { const meta = parseMetadata(row.metadata); return { ...meta, id: row.id, itemId: row.listing_id, renterUid: row.renter_pi_uid, renterUsername: row.renter_username, ownerUid: row.owner_pi_uid, ownerUsername: row.owner_username, startDate: row.start_date, endDate: row.end_date, pricePerDay: row.price_per_day, rentalTotal: row.rental_amount, baseAmount: row.rental_amount, deposit: row.deposit_amount, securityDeposit: row.deposit_amount, rentoraFee: row.platform_fee, totalPlatformFee: row.platform_fee, totalAmount: row.total_amount, status: row.status, paymentStatus: row.payment_status, createdAt: row.created_at, updatedAt: row.updated_at }; }
function transactionView(row) {
  return {
    id: row.id,
    paymentIntentId: row.payment_intent_id,
    piPaymentId: row.pi_payment_id,
    piTxRef: row.pi_txid,
    txid: row.pi_txid,
    amount: row.amount,
    platformFee: row.amount,
    type: row.type || 'platform_fee',
    status: row.status || 'completed',
    userId: row.user_id,
    userUid: row.user_pi_uid,
    user_pi_uid: row.user_pi_uid,
    userUsername: row.user_username,
    userName: row.user_display_name || row.user_username,
    createdAt: row.created_at,
    created_at: row.created_at
  };
}

async function listAll(env, auth) {
  const user = auth?.user || null;
  const isAdminUser = user ? (isAdmin(user.pi_uid, env) || isAdmin(user.username, env)) : false;

  let itemsQuery;
  if (isAdminUser) {
    itemsQuery = env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar, u.metadata owner_metadata FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE l.status != 'deleted' ORDER BY l.created_at DESC`).all();
  } else if (user) {
    itemsQuery = env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar, u.metadata owner_metadata FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE (l.status = 'active' OR l.owner_user_id = ?1) AND l.status != 'deleted' ORDER BY l.created_at DESC`).bind(user.id).all();
  } else {
    itemsQuery = env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar, u.metadata owner_metadata FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE l.status = 'active' ORDER BY l.created_at DESC`).all();
  }

  let rentalsQuery = Promise.resolve({ results: [] });
  let transactionsQuery = Promise.resolve({ results: [] });
  let usersQuery = Promise.resolve({ results: user ? [user] : [] });

  if (user) {
    rentalsQuery = env.RENTORA_DB.prepare(`SELECT r.*, l.price_per_day, ru.pi_uid renter_pi_uid, ru.username renter_username, ou.pi_uid owner_pi_uid, ou.username owner_username FROM rentals r JOIN listings l ON l.id=r.listing_id JOIN users ru ON ru.id=r.renter_user_id JOIN users ou ON ou.id=l.owner_user_id WHERE r.renter_user_id=?1 OR r.owner_user_id=?1 ORDER BY r.created_at DESC`).bind(user.id).all();    transactionsQuery = isAdminUser 
      ? env.RENTORA_DB.prepare(`SELECT t.*, u.pi_uid user_pi_uid, u.username user_username, u.display_name user_display_name FROM transactions t JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC`).all()
      : env.RENTORA_DB.prepare(`SELECT t.*, u.pi_uid user_pi_uid, u.username user_username, u.display_name user_display_name FROM transactions t JOIN users u ON u.id=t.user_id WHERE t.user_id=?1 ORDER BY t.created_at DESC`).bind(user.id).all();
    if (isAdminUser) {
      usersQuery = env.RENTORA_DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    }
  }

  const [items, rentals, transactions, users] = await Promise.all([
    itemsQuery,
    rentalsQuery,
    transactionsQuery,
    usersQuery
  ]);

  const seenRentalIds = new Set();
  const dedupedRentals = [];
  for (const row of (rentals.results || [])) {
    if (row && row.id && !seenRentalIds.has(row.id)) {
      seenRentalIds.add(row.id);
      dedupedRentals.push(rentalView(row));
    }
  }

  const out = {
    items: (items.results || []).map(listingView),
    rentals: dedupedRentals,
    transactions: (transactions.results || []).map(transactionView),
    users: (users.results || []).map((u) => userView(u, env)),
    reviews: [],
    reports: [],
    chats: [],
    timestamp: now()
  };
  if (isAdminUser) {
    const reports = await env.RENTORA_DB.prepare(`SELECT r.*, u.username reporter_username, u.pi_uid reporter_pi_uid FROM reports r JOIN users u ON u.id=r.reporter_user_id ORDER BY r.created_at DESC`).all();
    out.reports = reports.results || [];
  }
  return out;
}

function toCanonicalDecimal(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10000) / 10000;
}

function validatePiPayment(payment, intent, user) {
  const identifier = String(payment?.identifier || payment?.id || '').trim();
  if (!identifier) throw Object.assign(new Error('Pi payment identifier is missing'), { status: 409 });
  if (intent.pi_payment_id && String(intent.pi_payment_id).trim() !== identifier) {
    throw Object.assign(new Error('Pi payment identifier mismatch'), { status: 409 });
  }

  const payerUid = payment?.user?.uid || payment?.from_address?.uid || payment?.user_uid || payment?.uid || '';
  const cleanPayerUid = String(payerUid).trim();
  if (!cleanPayerUid) throw Object.assign(new Error('Pi payment payer identity is missing'), { status: 409 });
  if (cleanPayerUid.toLowerCase() !== String(user.pi_uid).trim().toLowerCase()) {
    throw Object.assign(new Error('Pi payer mismatch'), { status: 403 });
  }

  let paymentMeta = payment?.metadata;
  if (typeof paymentMeta === 'string') {
    try { paymentMeta = JSON.parse(paymentMeta); } catch (_) {}
  }
  const metadataIntent = paymentMeta?.paymentIntentId || paymentMeta?.intentId || paymentMeta?.id;
  if (!metadataIntent || String(metadataIntent) !== String(intent.id)) {
    throw Object.assign(new Error('Pi payment metadata binding is missing or invalid'), { status: 409 });
  }
  if (paymentMeta?.rentalId && String(paymentMeta.rentalId) !== String(intent.rental_id)) {
    throw Object.assign(new Error('Pi payment rental binding mismatch'), { status: 409 });
  }

  const payerAmount = toCanonicalDecimal(payment?.amount);
  const expectedAmount = toCanonicalDecimal(intent.amount);
  if (Math.abs(payerAmount - expectedAmount) > 0.0001) {
    throw Object.assign(new Error('Pi payment amount mismatch'), { status: 409 });
  }

  const net = String(payment?.network || '').trim().toLowerCase();
  if (net === 'pi mainnet' || net === 'mainnet' || net === 'pimainnet') {
    throw Object.assign(new Error('Mainnet payments are not permitted on Pi Testnet'), { status: 409 });
  }

  if (payment?.memo && intent?.memo && String(payment.memo).trim() !== String(intent.memo).trim()) {
    throw Object.assign(new Error('Pi payment memo mismatch'), { status: 409 });
  }

  if (typeof payment?.status === 'object' && payment?.status !== null) {
    if (payment.status.developer_completed) return 'completed';
    if (payment.status.developer_approved) return 'approved';
    if (payment.status.cancelled || payment.status.user_cancelled) return 'cancelled';
    return 'pending';
  }
  return String(payment?.status || 'pending').toLowerCase();
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url); const path = url.pathname; const method = request.method; const origin = request.headers.get('Origin');
    const allowed = origin ? isOriginAllowed(origin, env) : true;    if (method === 'OPTIONS') {
      const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      };
      if (origin && isOriginAllowed(origin, env)) { headers['Access-Control-Allow-Origin'] = origin; headers['Vary'] = 'Origin'; }
      return new Response(null, { status: 204, headers });
    }
    if (origin && !allowed) return errorResponse('Origin not allowed', 403, env, undefined, origin);
    try {
      if (method === 'GET' && path === '/validation-key.txt') { return new Response('d8b5b506fc41746eb0aba3ff56bcb32ed03dd33bf0348a3af22893ba437b437544a2c160e3ba460b7986e1994fa19964a4beabd3ae98620da1f8b90dece4f7b8\n', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } }); }
      if (method === 'GET' && (path === '/privacy' || path === '/privacy.html')) { if (env?.ASSETS && typeof env.ASSETS.fetch === 'function') return env.ASSETS.fetch(new Request(new URL('/privacy.html', request.url), request)); }
      if (method === 'GET' && (path === '/terms' || path === '/terms.html' || path === '/tos')) { if (env?.ASSETS && typeof env.ASSETS.fetch === 'function') return env.ASSETS.fetch(new Request(new URL('/terms.html', request.url), request)); }
      if (method === 'GET' && (path === '/api/health' || path === '/health')) {
        const dbReady = Boolean(env?.RENTORA_DB);
        const kvReady = Boolean(env?.RENTORA_KV);
        const r2Ready = Boolean(env?.RENTORA_MEDIA);
        return jsonResponse({
          status: dbReady && kvReady ? 'ok' : 'degraded',
          service: 'Rentora Cloudflare Worker',
          version: '4.3.0',
          storage: { d1: dbReady, kv: kvReady, r2: r2Ready },
          piApiKeyConfigured: Boolean(env?.PI_API_KEY),
          timestamp: now()
        }, dbReady && kvReady ? 200 : 503, env, origin);
      }
      if (method === 'GET' && path === '/api/auth/me') {
        const { user } = await requireUser(request, env);
        const isAdminUser = isAdmin(user.pi_uid, env) && user.role === 'admin';
        return jsonResponse({
          authenticated: true,
          user: { ...userView(user), isAdmin: isAdminUser },
          isAdmin: isAdminUser
        }, 200, env, origin);
      }
      if (method === 'GET' && path === '/api/wallet/balance') {
        const { user } = await requireUser(request, env);
        const [earnRow, payoutRow] = await Promise.all([
          env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE user_id=?1 AND status='completed' AND type IN ('commission', 'reward', 'earning', 'user_credit', 'deposit_refund')").bind(user.id).first(),
          env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE user_id=?1 AND status='completed' AND type='user_payout'").bind(user.id).first()
        ]);
        const totalEarned = Number(Number(earnRow?.total || 0).toFixed(4));
        const totalPaidOut = Number(Number(payoutRow?.total || 0).toFixed(4));

        let pendingHold = 0;
        if (env.RENTORA_KV) {
          const lockRaw = await env.RENTORA_KV.get(`user_payout_lock:${user.id}`);
          if (lockRaw) {
            try {
              const lockObj = JSON.parse(lockRaw);
              pendingHold = Number(lockObj.amount || 0);
            } catch (_) {}
          }
        }

        const withdrawable = Math.max(0, Number((totalEarned - totalPaidOut - pendingHold).toFixed(4)));

        return jsonResponse({
          success: true,
          balance: {
            withdrawable,
            pending: pendingHold,
            totalEarned,
            totalPaidOut,
            currency: 'PI',
            userUid: user.pi_uid,
            username: user.username
          }
        }, 200, env, origin);
      }
      if (method === 'POST' && path === '/api/wallet/withdraw') {
        return errorResponse(
          'برداشت مستقیم موقتاً غیرفعال است؛ این مسیر قدیمی با ماشین حالت payout_operations سازگار نیست.',
          410,
          env,
          undefined,
          origin
        );
      }
      if (method === 'GET' && path === '/api/sync/all') {
        requireBindings(env);
        let auth = null;
        const authHeader = request.headers.get('Authorization') || '';
        if (authHeader.startsWith('Bearer ')) {
          auth = await requireUser(request, env);
        }
        return jsonResponse(await listAll(env, auth), 200, env, origin);
      }
      if (method === 'GET' && path === '/api/listings') {
        requireBindings(env);
        let auth = null;
        const authHeader = request.headers.get('Authorization') || '';
        if (authHeader.startsWith('Bearer ')) {
          auth = await requireUser(request, env);
        }
        const user = auth?.user || null;
        const isAdminUser = user ? (isAdmin(user.pi_uid, env) && user.role === 'admin') : false;

        let rows;
        if (isAdminUser) {
          rows = await env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar, u.metadata owner_metadata FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE l.status != 'deleted' ORDER BY l.created_at DESC`).bind().all();
        } else if (user) {
          rows = await env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar, u.metadata owner_metadata FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE (l.status = 'active' OR l.owner_user_id = ?1) AND l.status != 'deleted' ORDER BY l.created_at DESC`).bind(user.id).all();
        } else {
          rows = await env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar, u.metadata owner_metadata FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE l.status = 'active' ORDER BY l.created_at DESC`).bind().all();
        }
        return jsonResponse({ success: true, items: (rows.results || []).map(listingView) }, 200, env, origin);
      }
      if (method === 'GET' && path.startsWith('/api/listings/') && !path.slice('/api/listings/'.length).includes('/')) {
        const listingId = path.slice('/api/listings/'.length).trim();
        if (!listingId) return errorResponse('Missing listing ID', 400, env, undefined, origin);
        requireBindings(env);
        let auth = null;
        const authHeader = request.headers.get('Authorization') || '';
        if (authHeader.startsWith('Bearer ')) {
          auth = await requireUser(request, env);
        }
        const user = auth?.user || null;
        const isAdminUser = user ? (isAdmin(user.pi_uid, env) && user.role === 'admin') : false;

        const row = await env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar, u.metadata owner_metadata FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE l.id = ?1 AND l.status != 'deleted' LIMIT 1`).bind(listingId).first();
        if (!row) return errorResponse('Listing not found', 404, env, undefined, origin);

        const isOwner = user && (row.owner_user_id === user.id);
        if (row.status !== 'active' && !isOwner && !isAdminUser) {
          return errorResponse('Listing is not publicly available', 403, env, undefined, origin);
        }
        return jsonResponse({ success: true, item: listingView(row) }, 200, env, origin);
      }
      if (method === 'GET' && path === '/api/admin/overview') {
        const { user } = await requireAdmin(request, env);
        const [usersCount, listingsCount, rentalsCount, transactionsCount, revRow, payoutRow, reportsCount, usersMetaRows] = await Promise.all([
          env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM users").bind().first(),
          env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM listings WHERE status != 'deleted'").bind().first(),
          env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM rentals").bind().first(),
          env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM transactions WHERE status = 'completed' AND (type = 'platform_fee' OR type IS NULL)").bind().first(),
          env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status = 'completed' AND (type = 'platform_fee' OR type IS NULL)").bind().first(),
          env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status = 'completed' AND type = 'admin_payout'").bind().first(),
          env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM reports WHERE status = 'open'").bind().first(),
          env.RENTORA_DB.prepare("SELECT metadata FROM users").bind().all()
        ]);
        let totalLogins = 0;
        let totalLogouts = 0;
        let onlineUsers = 0;
        for (const u of (usersMetaRows?.results || [])) {
          const m = parseMetadata(u.metadata);
          totalLogins += Number(m.loginCount || 0);
          totalLogouts += Number(m.logoutCount || 0);
          if (m.isOnline) onlineUsers++;
        }
        let auditLogs = [];
        if (env?.RENTORA_KV && typeof env.RENTORA_KV.get === 'function') {
          try {
            auditLogs = await env.RENTORA_KV.get('rentora_admin_audit_logs', 'json') || [];
          } catch (_) {}
        }
        const totalRev = Number(revRow?.total || 0);
        const totalPayouts = Number(payoutRow?.total || 0);        const availableBalance = Math.max(0, totalRev - totalPayouts);
        return jsonResponse({
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
            openReports: Number(reportsCount?.c || 0),
            totalLogins,
            totalLogouts,
            onlineUsers,
            auditLogs: Array.isArray(auditLogs) ? auditLogs.slice(0, 20) : []
          }
        }, 200, env, origin);
      }
      if (method === 'POST' && path === '/api/admin/cleanup') {
        const { user } = await requireAdmin(request, env);
        const staleRentalsRes = await env.RENTORA_DB.prepare(
          "UPDATE rentals SET status='cancelled', updated_at=?1 WHERE status='pending_payment' AND julianday(created_at) < julianday('now', '-15 minutes')"
        ).bind(now()).run();
        const staleIntentsRes = await env.RENTORA_DB.prepare(
          "UPDATE payment_intents SET status='cancelled', updated_at=?1 WHERE status='created' AND julianday(created_at) < julianday('now', '-60 minutes')"
        ).bind(now()).run();

        const staleRentalsCount = Number(staleRentalsRes?.meta?.changes || 0);
        const staleIntentsCount = Number(staleIntentsRes?.meta?.changes || 0);

        const audit = await recordAdminAuditLog(env, user, 'CLEANUP_STALE_RECORDS', {
          staleRentalsCancelled: staleRentalsCount,
          staleIntentsCancelled: staleIntentsCount
        });

        return jsonResponse({
          success: true,
          cleaned: {
            staleRentalsCancelled: staleRentalsCount,
            staleIntentsCancelled: staleIntentsCount
          },
          auditLog: audit
        }, 200, env, origin);
      }
      if (method === 'POST' && path === '/api/admin/payout') {
        const { user } = await requireAdmin(request, env);
        const body = await readJson(request);

        const idempotencyKey = payoutIdempotencyKey(request, body);
        if (!idempotencyKey) {
          return errorResponse('Idempotency-Key برای پرداخت الزامی است', 400, env, undefined, origin);
        }

        const [revRow, payoutRow] = await Promise.all([
          env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND (type='platform_fee' OR type IS NULL)").first(),
          env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND type='admin_payout'").first()
        ]);
        const totalRev = Number(revRow?.total || 0);
        const totalPayouts = Number(payoutRow?.total || 0);
        const availableBalance = Math.max(0, totalRev - totalPayouts);

        let requestedAmount = Number(body?.amount || 0);
        if (!requestedAmount || isNaN(requestedAmount) || requestedAmount <= 0) {
          requestedAmount = availableBalance;
        }
        const amount = Number(requestedAmount.toFixed(4));
        if (amount <= 0 || amount > availableBalance) {
          return errorResponse(`مبلغ درخواستی (${amount} π) از موجودی واقعی کارمزدها (${availableBalance.toFixed(4)} π) بیشتر است.`, 400, env, undefined, origin);
        }

        const targetWallet = String(body?.walletAddress || '').trim();
        if (targetWallet && !/^[A-Za-z0-9_.-]{12,70}$/.test(targetWallet)) {
          return errorResponse('فرمت آدرس کیف پول پای نامعتبر است.', 400, env, undefined, origin);
        }

        await claimPayoutOperation(env, {
          idempotencyKey,
          userId: user.id,
          amount,
          type: 'admin_treasury_payout',
          memo: body?.memo,
          targetWallet
        });

        return await executePiA2UPayoutPipeline(env, {
          user,
          amount,
          memo: body?.memo || `Rentora Treasury Payout to ${targetWallet ? targetWallet.slice(0, 8) + '...' : '@' + user.username}`,
          metadataType: 'admin_treasury_payout',
          targetWallet,
          idempotencyKey,
          origin
        });
      }
      if (method === 'GET' && path === '/api/admin/users') {
        const { user } = await requireAdmin(request, env);
        const rows = await env.RENTORA_DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
        return jsonResponse({ success: true, users: (rows.results || []).map((u) => userView(u, env, { includeAdminReview: true })) }, 200, env, origin);