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
function jsonResponse(data, status, env, origin) {
  const allowOrigin = origin || env?.CORS_ORIGIN || '';
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' };
  if (allowOrigin) { headers['Access-Control-Allow-Origin'] = allowOrigin; headers['Vary'] = 'Origin'; }
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
function piErrorMessage(data, fallback = 'Pi network error') {
  if (!data) return fallback;
  return data.error_message || data.error || data.message || data.detail || fallback;
}
async function verifyPiAccessToken(env, accessToken) { if (!accessToken || !env?.PI_API_KEY) throw new Error('Pi authentication is unavailable'); const base = String(env.PI_API_URL || 'https://api.minepi.com/v2').replace(/\/$/, ''); const response = await fetch(`${base}/me`, { headers: { Authorization: `Bearer ${accessToken}` } }); const data = await response.json().catch(() => ({})); if (!response.ok || !data?.uid || !data?.username) throw new Error('Pi authentication rejected'); return data; }
async function createSession(env, user) { const token = randomToken('sess'); const hash = await sha256(token); await env.RENTORA_KV.put(`session:${hash}`, JSON.stringify({ uid: user.pi_uid, username: user.username, role: user.role }), { expirationTtl: SESSION_TTL }); return token; }
async function getSession(request, env) { const header = request.headers.get('Authorization') || ''; if (!header.startsWith('Bearer ')) return null; const token = header.slice(7).trim(); if (!token) return null; const hash = await sha256(token); const raw = await env.RENTORA_KV.get(`session:${hash}`); if (!raw) return null; try { return JSON.parse(raw); } catch (_) { return null; } }
async function requireUser(request, env) { requireBindings(env); const session = await getSession(request, env); if (!session?.uid) throw Object.assign(new Error('Authentication required'), { status: 401 }); const row = await env.RENTORA_DB.prepare('SELECT * FROM users WHERE pi_uid = ?1 LIMIT 1').bind(session.uid).first(); if (!row || row.status !== 'active') throw Object.assign(new Error('User is not active'), { status: 403 }); return { session, user: row }; }
async function requireAdmin(request, env) { const auth = await requireUser(request, env); if (!isAdmin(auth.user.pi_uid, env) || auth.user.role !== 'admin') throw Object.assign(new Error('Admin access required'), { status: 403 }); return auth; }
function parseMetadata(value) { if (!value) return {}; try { return JSON.parse(value); } catch (_) { return {}; } }
function userView(row, env) {
  const meta = parseMetadata(row.metadata);
  const isAdm = env ? (isAdmin(row.pi_uid, env) || isAdmin(row.username, env)) : row.role === 'admin';
  const isVerifiedPioneer = meta.kycStatus === 'verified' || row.kyc_status === 'verified';
  return {
    ...meta,
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
    kycStatus: isVerifiedPioneer ? 'verified' : 'unverified',
    isOfficialSdk: true,
    joinedDate: row.created_at ? row.created_at.slice(0, 10) : ''
  };
}
function listingView(row) { const meta = sanitizeListingPublicMetadata(parseMetadata(row.metadata)); return { ...meta, id: row.id, title: row.title, description: row.description || '', category: row.category, location: row.location, pricePerDay: row.price_per_day, deposit: row.deposit_amount, ownerUid: row.owner_pi_uid, ownerUsername: row.owner_username, ownerAvatar: row.owner_avatar, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }; }
function rentalView(row) { const meta = parseMetadata(row.metadata); return { ...meta, id: row.id, itemId: row.listing_id, renterUid: row.renter_pi_uid, renterUsername: row.renter_username, ownerUid: row.owner_pi_uid, ownerUsername: row.owner_username, startDate: row.start_date, endDate: row.end_date, pricePerDay: row.price_per_day, rentalTotal: row.rental_amount, baseAmount: row.rental_amount, deposit: row.deposit_amount, securityDeposit: row.deposit_amount, rentoraFee: row.platform_fee, totalPlatformFee: row.platform_fee, totalAmount: row.total_amount, status: row.status, paymentStatus: row.payment_status, createdAt: row.created_at, updatedAt: row.updated_at }; }

async function listAll(env, auth) {
  const user = auth?.user || null;
  const isAdminUser = user ? (isAdmin(user.pi_uid, env) || isAdmin(user.username, env)) : false;

  let itemsQuery;
  if (isAdminUser) {
    itemsQuery = env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE l.status != 'deleted' ORDER BY l.created_at DESC`).all();
  } else if (user) {
    itemsQuery = env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE (l.status = 'active' OR l.owner_user_id = ?1) AND l.status != 'deleted' ORDER BY l.created_at DESC`).bind(user.id).all();
  } else {
    itemsQuery = env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE l.status = 'active' ORDER BY l.created_at DESC`).all();
  }

  let rentalsQuery = Promise.resolve({ results: [] });
  let transactionsQuery = Promise.resolve({ results: [] });
  let usersQuery = Promise.resolve({ results: user ? [user] : [] });

  if (user) {
    rentalsQuery = env.RENTORA_DB.prepare(`SELECT r.*, l.price_per_day, ru.pi_uid renter_pi_uid, ru.username renter_username, ou.pi_uid owner_pi_uid, ou.username owner_username FROM rentals r JOIN listings l ON l.id=r.listing_id JOIN users ru ON ru.id=r.renter_user_id JOIN users ou ON ou.id=l.owner_user_id WHERE r.renter_user_id=?1 OR r.owner_user_id=?1 ORDER BY r.created_at DESC`).bind(user.id).all();
    transactionsQuery = isAdminUser 
      ? env.RENTORA_DB.prepare(`SELECT t.*, u.pi_uid user_pi_uid FROM transactions t JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC`).all()
      : env.RENTORA_DB.prepare(`SELECT t.*, u.pi_uid user_pi_uid FROM transactions t JOIN users u ON u.id=t.user_id WHERE t.user_id=?1 ORDER BY t.created_at DESC`).bind(user.id).all();
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
    transactions: transactions.results || [],
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

function validatePiPayment(payment, intent, user) {
  const identifier = String(payment?.identifier || payment?.id || '');
  if (!identifier) throw Object.assign(new Error('Pi payment identifier is missing'), { status: 409 });
  if (identifier !== String(intent.pi_payment_id || identifier)) throw Object.assign(new Error('Pi payment identifier mismatch'), { status: 409 });
  const payerUid = payment?.user?.uid || payment?.from_address?.uid || payment?.user_uid || payment?.uid;
  if (!payerUid) throw Object.assign(new Error('Pi payment payer identity is missing'), { status: 409 });
  if (String(payerUid).toLowerCase() !== String(user.pi_uid).toLowerCase()) throw Object.assign(new Error('Pi payer mismatch'), { status: 403 });
  let paymentMeta = payment?.metadata;
  if (typeof paymentMeta === 'string') {
    try { paymentMeta = JSON.parse(paymentMeta); } catch (_) {}
  }
  const metadataIntent = paymentMeta?.paymentIntentId || paymentMeta?.intentId || paymentMeta?.id;
  if (!metadataIntent || String(metadataIntent) !== String(intent.id)) throw Object.assign(new Error('Pi payment metadata binding is missing or invalid'), { status: 409 });
  const amount = Number(payment?.amount);
  if (!Number.isFinite(amount) || Math.abs(amount - Number(intent.amount)) > 0.001) throw Object.assign(new Error('Pi payment amount mismatch'), { status: 409 });
  if (payment?.memo && intent?.memo && String(payment.memo).trim() !== String(intent.memo).trim()) throw Object.assign(new Error('Pi payment memo mismatch'), { status: 409 });
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
    const allowed = isOriginAllowed(origin, request.url, env);
    if (method === 'OPTIONS') {
      if (!allowed) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin'
        }
      });
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
          rows = await env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE l.status != 'deleted' ORDER BY l.created_at DESC`).bind().all();
        } else if (user) {
          rows = await env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE (l.status = 'active' OR l.owner_user_id = ?1) AND l.status != 'deleted' ORDER BY l.created_at DESC`).bind(user.id).all();
        } else {
          rows = await env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE l.status = 'active' ORDER BY l.created_at DESC`).bind().all();
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

        const row = await env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE l.id = ?1 AND l.status != 'deleted' LIMIT 1`).bind(listingId).first();
        if (!row) return errorResponse('Listing not found', 404, env, undefined, origin);

        const isOwner = user && (row.owner_user_id === user.id);
        if (row.status !== 'active' && !isOwner && !isAdminUser) {
          return errorResponse('Listing is not publicly available', 403, env, undefined, origin);
        }
        return jsonResponse({ success: true, item: listingView(row) }, 200, env, origin);
      }
      if (method === 'GET' && path === '/api/admin/overview') {
        const { user } = await requireAdmin(request, env);
        const [usersCount, listingsCount, rentalsCount, transactionsCount, revRow, payoutRow, reportsCount] = await Promise.all([
          env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM users").bind().first(),
          env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM listings WHERE status != 'deleted'").bind().first(),
          env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM rentals").bind().first(),
          env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM transactions WHERE status = 'completed' AND (type = 'platform_fee' OR type IS NULL)").bind().first(),
          env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status = 'completed' AND (type = 'platform_fee' OR type IS NULL)").bind().first(),
          env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status = 'completed' AND type = 'admin_payout'").bind().first(),
          env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM reports WHERE status = 'open'").bind().first()
        ]);
        const totalRev = Number(revRow?.total || 0);
        const totalPayouts = Number(payoutRow?.total || 0);
        const availableBalance = Math.max(0, totalRev - totalPayouts);
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
            openReports: Number(reportsCount?.c || 0)
          }
        }, 200, env, origin);
      }
      if (method === 'POST' && path === '/api/admin/payout') {
        const { user } = await requireAdmin(request, env);
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
          return errorResponse(`مبلغ درخواستی (${amount} π) از موجودی واقعی کارمزدها (${availableBalance.toFixed(4)} π) بیشتر است.`, 400, env, undefined, origin);
        }

        try {
          try {
            const incRes = await piFetch(env, '/payments/incomplete_server_payments');
            if (incRes.ok) {
              const incData = await incRes.json().catch(() => ({}));
              const incompleteList = incData?.incomplete_server_payments || (Array.isArray(incData) ? incData : []);
              for (const p of incompleteList) {
                const pid = p?.identifier || p?.id;
                if (!pid) continue;
                const txid = p?.transaction?.txid;
                if (p?.status?.transaction_verified && txid) {
                  await piFetch(env, `/payments/${encodeURIComponent(pid)}/complete`, { method: 'POST', body: JSON.stringify({ txid }) }).catch(() => {});
                  await env.RENTORA_DB.prepare(
                    "INSERT INTO transactions(id, payment_intent_id, pi_payment_id, pi_txid, user_id, amount, type, status, created_at) VALUES(?1, ?2, ?3, ?4, ?5, ?6, 'admin_payout', 'completed', ?7) ON CONFLICT(pi_payment_id) DO UPDATE SET pi_txid=excluded.pi_txid, status='completed'"
                  ).bind(`tx_${crypto.randomUUID()}`, null, pid, txid, user.id, Number(p?.amount || 0), now()).run().catch(() => {});
                } else {
                  await piFetch(env, `/payments/${encodeURIComponent(pid)}/cancel`, { method: 'POST', body: '{}' }).catch(() => {});
                }
              }
            }
          } catch (_) {}

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
            const incRes = await piFetch(env, '/payments/incomplete_server_payments');
            if (incRes.ok) {
              const incData = await incRes.json().catch(() => ({}));
              const incompleteList = incData?.incomplete_server_payments || (Array.isArray(incData) ? incData : []);
              for (const p of incompleteList) {
                const pid = p?.identifier || p?.id;
                if (pid) {
                  const txid = p?.transaction?.txid;
                  if (p?.status?.transaction_verified && txid) {
                    await piFetch(env, `/payments/${encodeURIComponent(pid)}/complete`, { method: 'POST', body: JSON.stringify({ txid }) }).catch(() => {});
                  } else {
                    await piFetch(env, `/payments/${encodeURIComponent(pid)}/cancel`, { method: 'POST', body: '{}' }).catch(() => {});
                  }
                }
              }
            }
            piRes = await piFetch(env, '/payments', {
              method: 'POST',
              body: JSON.stringify({ payment: paymentPayload })
            });
            created = await piRes.json().catch(() => ({}));
          }

          if (!piRes.ok || !created?.identifier) {
            const errMsg = piErrorMessage(created, 'ایجاد تراکنش واریز به کاربر در شبکه پای رد شد.');
            return errorResponse(errMsg, 502, env, created, origin);
          }

          const paymentId = created.identifier || created.id;

          const appRes = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}/approve`, {
            method: 'POST',
            body: '{}'
          });
          const approved = await appRes.json().catch(() => ({}));
          if (!appRes.ok && !approved?.status?.developer_approved) {
            const errMsg = piErrorMessage(approved, 'تایید تراکنش واریز در سرور پای ناموفق بود.');
            return errorResponse(errMsg, 502, env, approved, origin);
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
            return jsonResponse({
              success: true,
              pending: true,
              paymentId,
              amount,
              recipient: targetWallet || user.username,
              message: `تراکنش واریز مبلغ ${amount} π در شبکه پای تایید شد و پس از اجرای بلاک‌چین نهایی می‌گردد.`
            }, 202, env, origin);
          }

          const compRes = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}/complete`, {
            method: 'POST',
            body: JSON.stringify({ txid })
          });
          const compData = await compRes.json().catch(() => ({}));
          if (!compRes.ok && !compData?.status?.developer_completed) {
            const errMsg = piErrorMessage(compData, 'تکمیل نهایی تراکنش در شبکه پای ناموفق بود.');
            return errorResponse(errMsg, 502, env, compData, origin);
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

          return jsonResponse({
            success: true,
            paymentId,
            txid,
            amount,
            recipient: targetWallet || user.username,
            message: `مبلغ ${amount} π با موفقیت به حساب پای ${targetWallet ? targetWallet.slice(0, 8) + '...' : '@' + user.username} واریز گردید.`
          }, 200, env, origin);
        } catch (err) {
          console.error('Payout error', err);
          return errorResponse(err.message || 'خطا در اجرای تسویه حساب', 500, env, undefined, origin);
        }
      }
      if (method === 'GET' && path === '/api/admin/users') {
        const { user } = await requireAdmin(request, env);
        const rows = await env.RENTORA_DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
        return jsonResponse({ success: true, users: (rows.results || []).map((u) => userView(u, env)) }, 200, env, origin);
      }
      if (method === 'POST' && path.startsWith('/api/admin/users/') && path.endsWith('/status')) {
        const targetUserId = path.slice('/api/admin/users/'.length, -'/status'.length).trim();
        if (!targetUserId) return errorResponse('Missing target user ID', 400, env, undefined, origin);
        const { user } = await requireAdmin(request, env);
        const body = await readJson(request);
        const newStatus = String(body?.status || '').trim().toLowerCase();
        if (!['active', 'suspended'].includes(newStatus)) {
          return errorResponse("Status must be 'active' or 'suspended'", 400, env, undefined, origin);
        }
        const target = await env.RENTORA_DB.prepare("SELECT * FROM users WHERE id=?1 OR pi_uid=?1 OR lower(username)=lower(?1) LIMIT 1").bind(targetUserId).first();
        if (!target) return errorResponse('User not found', 404, env, undefined, origin);
        if (isAdmin(target.pi_uid, env) && newStatus === 'suspended') {
          return errorResponse('Cannot suspend master admin', 403, env, undefined, origin);
        }
        await env.RENTORA_DB.prepare("UPDATE users SET status=?1, updated_at=?2 WHERE id=?3").bind(newStatus, now(), target.id).run();
        const updated = await env.RENTORA_DB.prepare("SELECT * FROM users WHERE id=?1").bind(target.id).first();
        return jsonResponse({ success: true, user: userView(updated, env) }, 200, env, origin);
      }
      if (method === 'POST' && path.startsWith('/api/admin/listings/') && path.endsWith('/status')) {
        const listingId = path.slice('/api/admin/listings/'.length, -'/status'.length).trim();
        if (!listingId) return errorResponse('Missing listing ID', 400, env, undefined, origin);
        const { user } = await requireAdmin(request, env);
        const body = await readJson(request);
        const newStatus = String(body?.status || '').trim().toLowerCase();
        if (!['active', 'paused', 'deleted'].includes(newStatus)) {
          return errorResponse("Status must be 'active', 'paused', or 'deleted'", 400, env, undefined, origin);
        }
        const existing = await env.RENTORA_DB.prepare("SELECT * FROM listings WHERE id=?1 LIMIT 1").bind(listingId).first();
        if (!existing) return errorResponse('Listing not found', 404, env, undefined, origin);
        await env.RENTORA_DB.prepare("UPDATE listings SET status=?1, updated_at=?2 WHERE id=?3").bind(newStatus, now(), listingId).run();
        return jsonResponse({ success: true, listingId, status: newStatus }, 200, env, origin);
      }
      if (method === 'POST' && path === '/api/auth/pi-login') {
        requireBindings(env);
        const body = await readJson(request);
        const piUser = await verifyPiAccessToken(env, body.accessToken);
        const uid = String(piUser.uid);
        const username = cleanUsername(piUser.username);
        const isAdminUser = isAdmin(uid, env) || isAdmin(username, env);
        const isKyced = Boolean(
          piUser?.kyc_status === true ||
          piUser?.kyc_status === 'verified' ||
          piUser?.is_kyc === true ||
          piUser?.kyc === true ||
          piUser?.credentials?.kyc === true ||
          body?.user?.kyc_status === true ||
          body?.user?.kyc_status === 'verified' ||
          body?.user?.is_kyc === true ||
          body?.user?.kyc === true ||
          body?.user?.credentials?.kyc === true ||
          body?.kycStatus === 'verified' ||
          (Array.isArray(piUser?.roles) && (
            piUser.roles.includes('kyc') ||
            piUser.roles.includes('kyced') ||
            piUser.roles.includes('pioneer_kyc')
          )) ||
          (Array.isArray(body?.user?.roles) && (
            body.user.roles.includes('kyc') ||
            body.user.roles.includes('kyced') ||
            body.user.roles.includes('pioneer_kyc')
          ))
        );
        const kycStatus = isKyced ? 'verified' : 'unverified';
        const existing = await env.RENTORA_DB.prepare('SELECT * FROM users WHERE pi_uid=?1 LIMIT 1').bind(uid).first();
        const role = (isAdmin(uid, env) || isAdmin(username, env)) ? 'admin' : 'user';
        const userId = existing?.id || `usr_${crypto.randomUUID()}`;
        if (existing) {
          const oldMeta = parseMetadata(existing.metadata);
          await env.RENTORA_DB.prepare("UPDATE users SET username=?1, display_name=?2, role=?3, status=CASE WHEN status='suspended' THEN status ELSE 'active' END, metadata=?4, updated_at=?5 WHERE id=?6").bind(username, existing.display_name || username, role, JSON.stringify({ ...oldMeta, kycStatus, isOfficialSdk: true }), now(), userId).run();
        } else {
          await env.RENTORA_DB.prepare("INSERT INTO users(id,pi_uid,username,display_name,role,status,metadata,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,'active',?6,?7,?7)").bind(userId, uid, username, username, role, JSON.stringify({ kycStatus, isOfficialSdk: true }), now()).run();
        }
        const user = await env.RENTORA_DB.prepare('SELECT * FROM users WHERE id=?1').bind(userId).first();
        if (user.status !== 'active') return errorResponse('User is suspended', 403, env, undefined, origin);
        const sessionToken = await createSession(env, user);
        return jsonResponse({ authenticated: true, verifiedWithPiApi: true, user: userView(user, env), sessionToken, uid, username }, 200, env, origin);
      }
      if (method === 'POST' && path === '/api/auth/logout') { requireBindings(env); const header = request.headers.get('Authorization') || ''; if (header.startsWith('Bearer ')) { const token = header.slice(7).trim(); if (token) await env.RENTORA_KV.delete(`session:${await sha256(token)}`); } return jsonResponse({ success: true }, 200, env, origin); }
      if (method === 'POST' && path === '/api/payments/intent') {
        const { user } = await requireUser(request, env);
        const body = await readJson(request);
        if (!body.rentalId) return errorResponse('rentalId is required', 400, env, undefined, origin);
        const rental = await env.RENTORA_DB.prepare(`SELECT r.*, l.title, l.id listing_id, l.price_per_day, l.deposit_amount FROM rentals r JOIN listings l ON l.id=r.listing_id WHERE r.id=?1 AND r.renter_user_id=?2 LIMIT 1`).bind(body.rentalId, user.id).first();
        if (!rental) return errorResponse('Rental not found', 404, env, undefined, origin);
        if (!['draft','pending_payment'].includes(rental.status)) return errorResponse('Rental is not payable', 409, env, undefined, origin);
        const existing = await env.RENTORA_DB.prepare('SELECT * FROM payment_intents WHERE rental_id=?1 LIMIT 1').bind(rental.id).first();
        if (existing && existing.status !== 'cancelled' && new Date(existing.expires_at) > new Date()) {
          return jsonResponse({ paymentIntentId: existing.id, id: existing.id, amount: existing.amount, memo: existing.memo, expiresAt: existing.expires_at, status: existing.status }, 200, env, origin);
        }
        const id = `pii_${crypto.randomUUID()}`;
        const memo = `Rentora Fee #${String(rental.id).slice(-12)}`;
        const expires = new Date(Date.now() + PAYMENT_INTENT_TTL * 1000).toISOString();
        if (existing) {
          await env.RENTORA_DB.prepare(`UPDATE payment_intents SET id=?1, amount=?2, memo=?3, status='created', pi_payment_id=NULL, pi_txid=NULL, created_at=?4, expires_at=?5, updated_at=?4 WHERE rental_id=?6`).bind(id, rental.platform_fee, memo, now(), expires, rental.id).run();
        } else {
          await env.RENTORA_DB.prepare(`INSERT INTO payment_intents(id,rental_id,user_id,amount,memo,status,created_at,expires_at,updated_at) VALUES(?1,?2,?3,?4,?5,'created',?6,?7,?6)`).bind(id, rental.id, user.id, rental.platform_fee, memo, now(), expires).run();
        }
        await env.RENTORA_DB.prepare(`UPDATE rentals SET payment_status='pending', status='pending_payment', updated_at=?1 WHERE id=?2`).bind(now(), rental.id).run();
        await env.RENTORA_KV.put(`payment-intent:${id}`, JSON.stringify({ userId: user.id, rentalId: rental.id, amount: rental.platform_fee, memo }), { expirationTtl: PAYMENT_INTENT_TTL });
        return jsonResponse({ paymentIntentId: id, id, amount: rental.platform_fee, memo, expiresAt: expires }, 201, env, origin);
      }
      if (method === 'POST' && path === '/api/payments/approve') {
        const { user } = await requireUser(request, env); const body = await readJson(request); if (!body.paymentId || !body.paymentIntentId) return errorResponse('paymentId and paymentIntentId are required', 400, env, undefined, origin);
        let intent = await env.RENTORA_DB.prepare('SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2 LIMIT 1').bind(body.paymentIntentId, user.id).first(); if (!intent || new Date(intent.expires_at) <= new Date()) return errorResponse('Payment intent is invalid or expired', 409, env, undefined, origin); if (intent.status === 'completed') return jsonResponse({ approved: true, paymentId: body.paymentId, idempotent: true }, 200, env, origin);
        if (intent.pi_payment_id && intent.pi_payment_id !== body.paymentId) return errorResponse('Payment ID does not match intent', 409, env, undefined, origin);
        if (intent.status === 'approved' && intent.pi_payment_id === body.paymentId) return jsonResponse({ approved: true, paymentId: body.paymentId, idempotent: true }, 200, env, origin);
        const paymentResponse = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}`); const payment = await paymentResponse.json().catch(() => ({})); if (!paymentResponse.ok) return errorResponse('Unable to verify Pi payment', 502, env, undefined, origin);
        const status = validatePiPayment(payment, intent, user);
        if (!['created','pending','approved'].includes(status)) return errorResponse(`Pi payment cannot be approved from status ${status || 'unknown'}`, 409, env, undefined, origin);
        const approveResponse = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}/approve`, { method: 'POST', body: '{}' }); const approved = await approveResponse.json().catch(() => ({})); if (!approveResponse.ok && !(approveResponse.status === 400 && String(JSON.stringify(approved)).toLowerCase().includes('already'))) return errorResponse('Pi payment approval failed', 502, env, { details: approved }, origin);
        const claim = await env.RENTORA_DB.prepare(`UPDATE payment_intents SET pi_payment_id=?1,status='approved',updated_at=?2 WHERE id=?3 AND status='created' AND pi_payment_id IS NULL`).bind(body.paymentId, now(), intent.id).run();
        if (!Number(claim?.meta?.changes || 0)) { intent = await env.RENTORA_DB.prepare('SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2 LIMIT 1').bind(intent.id, user.id).first(); if (!intent || intent.pi_payment_id !== body.paymentId || !['approved','completed'].includes(intent.status)) return errorResponse('Payment intent was concurrently claimed by another payment', 409, env, undefined, origin); }
        return jsonResponse({ approved: true, paymentId: body.paymentId, data: approved, idempotent: Number(claim?.meta?.changes || 0) === 0 }, 200, env, origin);
      }
      if (method === 'POST' && path === '/api/payments/complete') {
        const { user } = await requireUser(request, env); const body = await readJson(request); if (!body.paymentId || !body.txid || !body.paymentIntentId) return errorResponse('paymentId, txid and paymentIntentId are required', 400, env, undefined, origin);
        const intent = await env.RENTORA_DB.prepare('SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2 LIMIT 1').bind(body.paymentIntentId, user.id).first(); if (!intent) return errorResponse('Payment intent not found', 404, env, undefined, origin); if (intent.status === 'completed') return jsonResponse({ completed: true, paymentId: intent.pi_payment_id, txid: intent.pi_txid, idempotent: true }, 200, env, origin);
        if (intent.pi_payment_id && intent.pi_payment_id !== body.paymentId) return errorResponse('Payment ID does not match intent', 409, env, undefined, origin); if (!['approved','completed'].includes(String(intent.status || '').toLowerCase())) return errorResponse('Payment intent is not approved for completion', 409, env, undefined, origin);
        const paymentResponse = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}`); const payment = await paymentResponse.json().catch(() => ({})); if (!paymentResponse.ok) return errorResponse('Unable to verify Pi payment before completion', 502, env, undefined, origin);
        const status = validatePiPayment(payment, { ...intent, pi_payment_id: body.paymentId }, user); if (!['approved','completed','complete'].includes(status)) return errorResponse(`Pi payment cannot be completed from status ${status || 'unknown'}`, 409, env, undefined, origin);
        const completionResponse = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}/complete`, { method: 'POST', body: JSON.stringify({ txid: body.txid }) }); const completion = await completionResponse.json().catch(() => ({})); if (!completionResponse.ok && !['completed','complete'].includes(status)) return errorResponse('Pi payment completion failed', 502, env, { details: completion }, origin);
        await env.RENTORA_DB.batch([env.RENTORA_DB.prepare(`UPDATE payment_intents SET pi_payment_id=?1,pi_txid=?2,status='completed',updated_at=?3 WHERE id=?4 AND status IN ('approved','completed')`).bind(body.paymentId, body.txid, now(), intent.id),env.RENTORA_DB.prepare(`UPDATE rentals SET payment_status='completed',status='confirmed',updated_at=?1 WHERE id=?2`).bind(now(), intent.rental_id),env.RENTORA_DB.prepare(`INSERT OR IGNORE INTO transactions(id,payment_intent_id,pi_payment_id,pi_txid,user_id,amount,type,status,created_at) VALUES(?1,?2,?3,?4,?5,?6,'platform_fee','completed',?7)`).bind(`tx_${crypto.randomUUID()}`, intent.id, body.paymentId, body.txid, user.id, intent.amount, now())]);
        await env.RENTORA_KV.put(`payment-complete:${intent.id}`, JSON.stringify({ paymentId: body.paymentId, txid: body.txid, at: now() }), { expirationTtl: 60 * 60 * 24 * 30 });
        return jsonResponse({ completed: true, paymentId: body.paymentId, txid: body.txid, data: completion }, 200, env, origin);
      }
      if (method === 'POST' && path === '/api/payments/incomplete') {
        const body = await readJson(request);
        const paymentObj = body?.payment || {};
        const paymentId = String(body?.paymentId || paymentObj?.identifier || paymentObj?.id || '').trim();
        const txid = String(body?.txid || paymentObj?.transaction?.txid || '').trim();
        if (!paymentId) return jsonResponse({ handled: false, error: 'paymentId is required' }, 400, env, origin);
        try {
          const response = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}`);
          const payment = await response.json().catch(() => ({}));
          if (response.ok) {
            const resolvedTxid = txid || payment?.transaction?.txid;
            if (payment?.status?.developer_completed) {
              await env.RENTORA_DB.prepare("UPDATE payment_intents SET status='completed', pi_txid=?1, updated_at=?2 WHERE pi_payment_id=?3").bind(resolvedTxid || null, now(), paymentId).run().catch(() => {});
            } else if (payment?.status?.transaction_verified && resolvedTxid) {
              await piFetch(env, `/payments/${encodeURIComponent(paymentId)}/complete`, { method: 'POST', body: JSON.stringify({ txid: resolvedTxid }) }).catch(() => {});
              await env.RENTORA_DB.prepare("UPDATE payment_intents SET status='completed', pi_txid=?1, updated_at=?2 WHERE pi_payment_id=?3").bind(resolvedTxid, now(), paymentId).run().catch(() => {});
            } else if (!payment?.status?.developer_approved) {
              await piFetch(env, `/payments/${encodeURIComponent(paymentId)}/approve`, { method: 'POST', body: '{}' }).catch(() => {});
            }
          }
        } catch (_) {}
        return jsonResponse({ handled: true }, 200, env, origin);
      }
      if (method === 'POST' && path === '/api/sync/item') { const { user } = await requireUser(request, env); const item = await readJson(request);
        if (!item?.id || !String(item.title || '').trim()) return errorResponse('Invalid listing', 400, env, undefined, origin);
        const cInfo = item.contactInfo || (item.phoneContact ? { contactPhone: item.phoneContact } : null);
        const sanitizedItem = sanitizeListingPublicMetadata(item);
        const existing = await env.RENTORA_DB.prepare('SELECT * FROM listings WHERE id=?1 LIMIT 1').bind(item.id).first();
        if (existing) {
          if (existing.owner_user_id !== user.id && !isAdmin(user.pi_uid, env)) return errorResponse('Listing ownership denied', 403, env, undefined, origin);
          const isDeleting = item.status === 'deleted' && existing.status !== 'deleted';
          const existingMeta = parseMetadata(existing.metadata);
          const price = Number(existing.price_per_day); const deposit = Number(existing.deposit_amount);
          await env.RENTORA_DB.prepare(`UPDATE listings SET title=?1,description=?2,category=?3,location=?4,status=?5,metadata=?6,updated_at=?7 WHERE id=?8`).bind(String(item.title).trim(), item.description || '', item.category || null, item.location || null, item.status || 'active', JSON.stringify(sanitizedItem), now(), item.id).run();
          if (cInfo && typeof cInfo === 'object') {
            const cName = String(cInfo.contactName || cInfo.name || '').trim() || null;
            const cPhone = String(cInfo.contactPhone || cInfo.phone || cInfo.phoneContact || '').trim() || null;
            const cWhatsapp = String(cInfo.whatsapp || '').trim() || null;
            const cMethod = String(cInfo.preferredContactMethod || cInfo.method || 'phone').trim().toLowerCase();
            const cHours = String(cInfo.contactHours || cInfo.hours || '').trim() || null;
            const cNotes = String(cInfo.coordinationNotes || cInfo.notes || '').trim() || null;
            await env.RENTORA_DB.prepare(`INSERT INTO listing_contacts(listing_id, contact_name, contact_phone, whatsapp, preferred_contact_method, contact_hours, coordination_notes, updated_at) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(listing_id) DO UPDATE SET contact_name=excluded.contact_name, contact_phone=excluded.contact_phone, whatsapp=excluded.whatsapp, preferred_contact_method=excluded.preferred_contact_method, contact_hours=excluded.contact_hours, coordination_notes=excluded.coordination_notes, updated_at=excluded.updated_at`).bind(item.id, cName, cPhone, cWhatsapp, cMethod, cHours, cNotes, now()).run().catch(() => {});
          }
          if (isDeleting) {
            await env.RENTORA_DB.prepare("DELETE FROM listing_contacts WHERE listing_id=?1").bind(item.id).run().catch(() => {});
            const existingImgIds = extractImageIds(existingMeta.images);
            const newImgIds = extractImageIds(item.images);
            const allImgIds = [...new Set([...existingImgIds, ...newImgIds])];
            for (const id of allImgIds) {
              if (ctx && typeof ctx.waitUntil === 'function') {
                ctx.waitUntil(safeDeleteMediaImage(id, env));
              } else {
                await safeDeleteMediaImage(id, env);
              }
            }
          }
          return jsonResponse({ success: true, item: { ...sanitizedItem, pricePerDay: price, deposit } }, 200, env, origin);
        }
        const price = Number(item.pricePerDay); const deposit = Number(item.deposit || 0);
        if (!Number.isFinite(price) || price < 0 || !Number.isFinite(deposit) || deposit < 0) return errorResponse('Invalid listing price', 400, env, undefined, origin);
        await env.RENTORA_DB.prepare(`INSERT INTO listings(id,owner_user_id,title,description,category,location,price_per_day,deposit_amount,platform_fee_rate,status,metadata,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,'active',?10,?11,?11)`).bind(item.id, user.id, String(item.title).trim(), item.description || '', item.category || null, item.location || null, price, deposit, Number(env.PLATFORM_FEE_RATE || 0.05), JSON.stringify(sanitizedItem), now()).run();
        if (cInfo && typeof cInfo === 'object') {
          const cName = String(cInfo.contactName || cInfo.name || '').trim() || null;
          const cPhone = String(cInfo.contactPhone || cInfo.phone || cInfo.phoneContact || '').trim() || null;
          const cWhatsapp = String(cInfo.whatsapp || '').trim() || null;
          const cMethod = String(cInfo.preferredContactMethod || cInfo.method || 'phone').trim().toLowerCase();
          const cHours = String(cInfo.contactHours || cInfo.hours || '').trim() || null;
          const cNotes = String(cInfo.coordinationNotes || cInfo.notes || '').trim() || null;
          await env.RENTORA_DB.prepare(`INSERT INTO listing_contacts(listing_id, contact_name, contact_phone, whatsapp, preferred_contact_method, contact_hours, coordination_notes, updated_at) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(listing_id) DO UPDATE SET contact_name=excluded.contact_name, contact_phone=excluded.contact_phone, whatsapp=excluded.whatsapp, preferred_contact_method=excluded.preferred_contact_method, contact_hours=excluded.contact_hours, coordination_notes=excluded.coordination_notes, updated_at=excluded.updated_at`).bind(item.id, cName, cPhone, cWhatsapp, cMethod, cHours, cNotes, now()).run().catch(() => {});
        }
        return jsonResponse({ success: true, item: sanitizedItem }, 201, env, origin);
      }
      if (method === 'GET' && path.startsWith('/api/rentals/') && path.endsWith('/contact')) {
        const rentalId = path.slice('/api/rentals/'.length, -'/contact'.length).trim();
        if (!rentalId) return errorResponse('Missing rental ID', 400, env, undefined, origin);
        const { user } = await requireUser(request, env);

        const row = await env.RENTORA_DB.prepare(`
          SELECT
            r.id AS rental_id,
            r.listing_id,
            r.renter_user_id,
            r.status AS rental_status,
            r.payment_status,
            l.owner_user_id,
            l.title AS listing_title,
            u.username AS owner_username,
            u.display_name AS owner_display_name,
            lc.contact_name,
            lc.contact_phone,
            lc.whatsapp,
            lc.preferred_contact_method,
            lc.contact_hours,
            lc.coordination_notes,
            lc.updated_at AS contact_updated_at
          FROM rentals r
          JOIN listings l ON l.id = r.listing_id
          JOIN users u ON u.id = l.owner_user_id
          LEFT JOIN listing_contacts lc ON lc.listing_id = l.id
          WHERE r.id = ?1
          LIMIT 1
        `).bind(rentalId).first();

        if (!row) return errorResponse('Rental not found', 404, env, undefined, origin);

        const isRenter = (row.renter_user_id === user.id);
        const isOwner = (row.owner_user_id === user.id);
        const isAdminUser = isAdmin(user.pi_uid, env) && user.role === 'admin';

        if (!isRenter && !isOwner && !isAdminUser) {
          return errorResponse('Access denied to rental contact details', 403, env, undefined, origin);
        }

        if (isRenter && !isOwner && !isAdminUser) {
          const isPaid = (row.payment_status === 'completed');
          const isValidRentalState = ['confirmed', 'active', 'completed'].includes(row.rental_status);
          if (!isPaid || !isValidRentalState) {
            return errorResponse('Contact information is locked until rental payment is confirmed', 403, env, undefined, origin);
          }
        }

        const headers = {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
        };
        const allowOrigin = origin || env?.CORS_ORIGIN || '';
        if (allowOrigin) { headers['Access-Control-Allow-Origin'] = allowOrigin; headers['Vary'] = 'Origin'; }

        return new Response(JSON.stringify({
          success: true,
          rentalId: row.rental_id,
          listingId: row.listing_id,
          listingTitle: row.listing_title,
          ownerUsername: row.owner_username,
          contact: {
            contactName: row.contact_name || row.owner_display_name || row.owner_username,
            contactPhone: row.contact_phone || '',
            whatsapp: row.whatsapp || '',
            preferredContactMethod: row.preferred_contact_method || 'phone',
            contactHours: row.contact_hours || '',
            coordinationNotes: row.coordination_notes || ''
          }
        }), { status: 200, headers });
      }
      if (method === 'GET' && path.startsWith('/api/listings/') && path.endsWith('/contact')) {
        const listingId = path.slice('/api/listings/'.length, -'/contact'.length).trim();
        if (!listingId) return errorResponse('Missing listing ID', 400, env, undefined, origin);
        const { user } = await requireUser(request, env);

        const row = await env.RENTORA_DB.prepare(`
          SELECT
            l.id AS listing_id,
            l.owner_user_id,
            l.title AS listing_title,
            lc.contact_name,
            lc.contact_phone,
            lc.whatsapp,
            lc.preferred_contact_method,
            lc.contact_hours,
            lc.coordination_notes,
            lc.updated_at AS contact_updated_at
          FROM listings l
          LEFT JOIN listing_contacts lc ON lc.listing_id = l.id
          WHERE l.id = ?1
          LIMIT 1
        `).bind(listingId).first();

        if (!row) return errorResponse('Listing not found', 404, env, undefined, origin);

        const isOwner = (row.owner_user_id === user.id);
        const isAdminUser = isAdmin(user.pi_uid, env) && user.role === 'admin';
        if (!isOwner && !isAdminUser) {
          return errorResponse('Access denied to listing contact details', 403, env, undefined, origin);
        }

        const headers = {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
        };
        const allowOrigin = origin || env?.CORS_ORIGIN || '';
        if (allowOrigin) { headers['Access-Control-Allow-Origin'] = allowOrigin; headers['Vary'] = 'Origin'; }

        return new Response(JSON.stringify({
          success: true,
          listingId: row.listing_id,
          listingTitle: row.listing_title,
          contact: {
            contactName: row.contact_name || '',
            contactPhone: row.contact_phone || '',
            whatsapp: row.whatsapp || '',
            preferredContactMethod: row.preferred_contact_method || 'phone',
            contactHours: row.contact_hours || '',
            coordinationNotes: row.coordination_notes || ''
          }
        }), { status: 200, headers });
      }

      // =========================================================================
      // SECURE MARKETPLACE CONVERSATIONS & MESSAGING (ONE UNIFIED CHAT SYSTEM)
      // =========================================================================
      if (method === 'GET' && path === '/api/conversations') {
        const { user } = await requireUser(request, env);
        const rows = await env.RENTORA_DB.prepare(`
          SELECT
            c.id,
            c.listing_id,
            c.rental_id,
            c.owner_user_id,
            c.renter_user_id,
            c.type,
            c.status,
            c.last_message_text,
            c.last_message_at,
            c.created_at,
            c.updated_at,
            l.title AS listing_title,
            l.price_per_day,
            l.location AS listing_location,
            ou.pi_uid AS owner_pi_uid,
            ou.username AS owner_username,
            ou.display_name AS owner_display_name,
            ou.avatar_url AS owner_avatar,
            ru.pi_uid AS renter_pi_uid,
            ru.username AS renter_username,
            ru.display_name AS renter_display_name,
            ru.avatar_url AS renter_avatar,
            r.status AS rental_status,
            r.payment_status AS rental_payment_status,
            r.rental_amount,
            r.platform_fee,
            r.start_date,
            r.end_date
          FROM conversations c
          JOIN listings l ON l.id = c.listing_id
          JOIN users ou ON ou.id = c.owner_user_id
          JOIN users ru ON ru.id = c.renter_user_id
          LEFT JOIN rentals r ON r.id = c.rental_id
          WHERE (c.owner_user_id = ?1 OR c.renter_user_id = ?1)
            AND c.status != 'archived'
          ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
        `).bind(user.id).all();

        const conversations = (rows.results || []).map(row => {
          const isOwner = row.owner_user_id === user.id;
          const isPaid = row.rental_payment_status === 'completed' && ['confirmed', 'active', 'completed'].includes(row.rental_status);
          return {
            id: row.id,
            listingId: row.listing_id,
            rentalId: row.rental_id || null,
            type: isPaid ? 'post_booking' : (row.type || 'pre_booking'),
            status: row.status,
            isPostBookingUnlocked: isPaid,
            listing: {
              id: row.listing_id,
              title: row.listing_title,
              pricePerDay: row.price_per_day,
              location: row.listing_location
            },
            otherUser: isOwner ? {
              id: row.renter_user_id,
              uid: row.renter_pi_uid,
              username: row.renter_username,
              displayName: row.renter_display_name,
              avatar: row.renter_avatar,
              role: 'renter'
            } : {
              id: row.owner_user_id,
              uid: row.owner_pi_uid,
              username: row.owner_username,
              displayName: row.owner_display_name,
              avatar: row.owner_avatar,
              role: 'owner'
            },
            rental: row.rental_id ? {
              id: row.rental_id,
              status: row.rental_status,
              paymentStatus: row.rental_payment_status,
              startDate: row.start_date,
              endDate: row.end_date
            } : null,
            lastMessageText: row.last_message_text || '',
            lastMessageAt: row.last_message_at || row.created_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };
        });

        const headers = {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
        };
        if (origin) { headers['Access-Control-Allow-Origin'] = origin; headers['Vary'] = 'Origin'; }
        return new Response(JSON.stringify({ success: true, conversations }), { status: 200, headers });
      }

      if (method === 'POST' && path === '/api/conversations') {
        const { user } = await requireUser(request, env);
        const body = await readJson(request);
        const listingId = String(body?.listingId || '').trim();
        const rentalId = body?.rentalId ? String(body.rentalId).trim() : null;

        let targetListingId = listingId;
        let targetOwnerId = null;
        let targetRenterId = user.id;
        let convType = 'pre_booking';

        if (rentalId) {
          const rental = await env.RENTORA_DB.prepare(`
            SELECT r.*, l.id AS listing_id, l.owner_user_id
            FROM rentals r
            JOIN listings l ON l.id = r.listing_id
            WHERE r.id = ?1
            LIMIT 1
          `).bind(rentalId).first();

          if (!rental) return errorResponse('Rental not found', 404, env, undefined, origin);
          const isRenter = (rental.renter_user_id === user.id);
          const isOwner = (rental.owner_user_id === user.id);
          const isAdminUser = isAdmin(user.pi_uid, env) && user.role === 'admin';
          if (!isRenter && !isOwner && !isAdminUser) return errorResponse('Access denied to rental conversation', 403, env, undefined, origin);

          targetListingId = rental.listing_id;
          targetOwnerId = rental.owner_user_id;
          targetRenterId = rental.renter_user_id;
          const isPaid = (rental.payment_status === 'completed' && ['confirmed', 'active', 'completed'].includes(rental.status));
          convType = isPaid ? 'post_booking' : 'pre_booking';
        } else {
          if (!targetListingId) return errorResponse('listingId is required', 400, env, undefined, origin);
          const listing = await env.RENTORA_DB.prepare('SELECT * FROM listings WHERE id=?1 AND status != "deleted" LIMIT 1').bind(targetListingId).first();
          if (!listing) return errorResponse('Listing not found', 404, env, undefined, origin);
          if (listing.owner_user_id === user.id) return errorResponse('Self-conversation is not allowed', 400, env, undefined, origin);
          targetOwnerId = listing.owner_user_id;
          targetRenterId = user.id;
          convType = 'pre_booking';
        }

        let existing = await env.RENTORA_DB.prepare(`
          SELECT * FROM conversations
          WHERE listing_id = ?1 AND renter_user_id = ?2 AND type = ?3
          LIMIT 1
        `).bind(targetListingId, targetRenterId, convType).first();

        if (existing) {
          if (rentalId && !existing.rental_id) {
            await env.RENTORA_DB.prepare('UPDATE conversations SET rental_id=?1, updated_at=?2 WHERE id=?3').bind(rentalId, now(), existing.id).run();
          }
          return jsonResponse({ success: true, conversationId: existing.id, conversation: existing }, 200, env, origin);
        }

        const convId = `conv_${crypto.randomUUID()}`;
        await env.RENTORA_DB.prepare(`
          INSERT INTO conversations(id, listing_id, rental_id, owner_user_id, renter_user_id, type, status, created_at, updated_at)
          VALUES(?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, ?7)
        `).bind(convId, targetListingId, rentalId, targetOwnerId, targetRenterId, convType, now()).run();

        const created = await env.RENTORA_DB.prepare('SELECT * FROM conversations WHERE id=?1').bind(convId).first();
        return jsonResponse({ success: true, conversationId: convId, conversation: created }, 201, env, origin);
      }

      if (method === 'GET' && path.startsWith('/api/conversations/') && path.endsWith('/messages')) {
        const convId = path.slice('/api/conversations/'.length, -'/messages'.length).trim();
        if (!convId) return errorResponse('Missing conversation ID', 400, env, undefined, origin);
        const { user } = await requireUser(request, env);

        const conv = await env.RENTORA_DB.prepare(`
          SELECT c.*, r.status AS rental_status, r.payment_status AS rental_payment_status
          FROM conversations c
          LEFT JOIN rentals r ON r.id = c.rental_id
          WHERE c.id = ?1
          LIMIT 1
        `).bind(convId).first();

        if (!conv) return errorResponse('Conversation not found', 404, env, undefined, origin);
        const isParticipant = (conv.owner_user_id === user.id || conv.renter_user_id === user.id);
        const isAdminUser = isAdmin(user.pi_uid, env) && user.role === 'admin';
        if (!isParticipant && !isAdminUser) return errorResponse('Access denied to conversation', 403, env, undefined, origin);

        const rows = await env.RENTORA_DB.prepare(`
          SELECT
            m.id,
            m.conversation_id,
            m.sender_user_id,
            m.message_text,
            m.message_type,
            m.moderation_status,
            m.created_at,
            u.pi_uid AS sender_pi_uid,
            u.username AS sender_username,
            u.display_name AS sender_display_name,
            u.avatar_url AS sender_avatar
          FROM messages m
          JOIN users u ON u.id = m.sender_user_id
          WHERE m.conversation_id = ?1
          ORDER BY m.created_at ASC
        `).bind(convId).all();

        const isPaid = conv.rental_payment_status === 'completed' && ['confirmed', 'active', 'completed'].includes(conv.rental_status);
        const type = isPaid ? 'post_booking' : (conv.type || 'pre_booking');

        const headers = {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
        };
        if (origin) { headers['Access-Control-Allow-Origin'] = origin; headers['Vary'] = 'Origin'; }

        return new Response(JSON.stringify({
          success: true,
          conversationId: convId,
          type,
          isPostBookingUnlocked: isPaid,
          messages: (rows.results || []).map(m => ({
            id: m.id,
            conversationId: m.conversation_id,
            senderUid: m.sender_pi_uid,
            senderUsername: m.sender_username,
            senderDisplayName: m.sender_display_name,
            senderAvatar: m.sender_avatar,
            text: m.message_text,
            messageType: m.message_type,
            createdAt: m.created_at
          }))
        }), { status: 200, headers });
      }

      if (method === 'POST' && path.startsWith('/api/conversations/') && path.endsWith('/messages')) {
        const convId = path.slice('/api/conversations/'.length, -'/messages'.length).trim();
        if (!convId) return errorResponse('Missing conversation ID', 400, env, undefined, origin);
        const { user } = await requireUser(request, env);
        const body = await readJson(request);
        const rawText = String(body?.text || '').trim();
        if (!rawText) return errorResponse('Message text cannot be empty', 400, env, undefined, origin);
        if (rawText.length > 2000) return errorResponse('Message is too long (max 2000 characters)', 400, env, undefined, origin);

        const conv = await env.RENTORA_DB.prepare(`
          SELECT c.*, r.status AS rental_status, r.payment_status AS rental_payment_status
          FROM conversations c
          LEFT JOIN rentals r ON r.id = c.rental_id
          WHERE c.id = ?1
          LIMIT 1
        `).bind(convId).first();

        if (!conv) return errorResponse('Conversation not found', 404, env, undefined, origin);
        const isParticipant = (conv.owner_user_id === user.id || conv.renter_user_id === user.id);
        const isAdminUser = isAdmin(user.pi_uid, env) && user.role === 'admin';
        if (!isParticipant && !isAdminUser) return errorResponse('Access denied to send message in this conversation', 403, env, undefined, origin);

        const isPaid = conv.rental_payment_status === 'completed' && ['confirmed', 'active', 'completed'].includes(conv.rental_status);
        const isPreBooking = !isPaid || conv.type === 'pre_booking';

        // Authoritative Anti-Bypass Filter Inspection
        if (isPreBooking) {
          const bypassCheck = detectBypassAttempt(rawText);
          if (bypassCheck.isBlocked) {
            return errorResponse(
              'برای امنیت کاربران و حفظ خدمات Rentora، تبادل اطلاعات تماس قبل از رزرو مجاز نیست.',
              400,
              env,
              { code: 'CONTACT_INFO_BLOCKED', policy: 'pre_booking_anti_bypass' },
              origin
            );
          }
        }

        const msgId = `msg_${crypto.randomUUID()}`;
        const msgType = String(body?.messageType || 'text').trim().toLowerCase();
        const allowedTypes = ['text', 'system', 'handover_notice', 'status_update'];
        const finalType = allowedTypes.includes(msgType) ? msgType : 'text';

        await env.RENTORA_DB.prepare(`
          INSERT INTO messages(id, conversation_id, sender_user_id, message_text, message_type, moderation_status, created_at)
          VALUES(?1, ?2, ?3, ?4, ?5, 'approved', ?6)
        `).bind(msgId, convId, user.id, rawText, finalType, now()).run();

        await env.RENTORA_DB.prepare(`
          UPDATE conversations
          SET last_message_text=?1, last_message_at=?2, updated_at=?2
          WHERE id=?3
        `).bind(rawText.slice(0, 100), now(), convId).run();

        const headers = {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
        };
        if (origin) { headers['Access-Control-Allow-Origin'] = origin; headers['Vary'] = 'Origin'; }

        return new Response(JSON.stringify({
          success: true,
          message: {
            id: msgId,
            conversationId: convId,
            senderUid: user.pi_uid,
            senderUsername: user.username,
            senderDisplayName: user.display_name,
            senderAvatar: user.avatar_url,
            text: rawText,
            messageType: finalType,
            createdAt: now()
          }
        }), { status: 201, headers });
      }

      if (method === 'POST' && path.startsWith('/api/conversations/') && path.endsWith('/archive')) {
        const convId = path.slice('/api/conversations/'.length, -'/archive'.length).trim();
        if (!convId) return errorResponse('Missing conversation ID', 400, env, undefined, origin);
        const { user } = await requireUser(request, env);

        const conv = await env.RENTORA_DB.prepare('SELECT * FROM conversations WHERE id=?1 LIMIT 1').bind(convId).first();
        if (!conv) return errorResponse('Conversation not found', 404, env, undefined, origin);
        if (conv.owner_user_id !== user.id && conv.renter_user_id !== user.id && !isAdmin(user.pi_uid, env)) {
          return errorResponse('Access denied', 403, env, undefined, origin);
        }
        await env.RENTORA_DB.prepare('UPDATE conversations SET status="archived", updated_at=?1 WHERE id=?2').bind(now(), convId).run();
        return jsonResponse({ success: true, archived: true, id: convId }, 200, env, origin);
      }

      // Legacy chat endpoints permanently disabled and removed
      if (method === 'POST' && (path === '/api/sync/chat' || path === '/api/sync/chat/delete' || path === '/api/sync/chat-delete')) {
        return errorResponse('Legacy chat endpoints have been permanently deprecated. Please use /api/conversations', 410, env, undefined, origin);
      }

      // =========================================================================
      // AUTHORITATIVE RENTAL-BASED RATING & REVIEW SYSTEM
      // =========================================================================
      if (method === 'GET' && path.startsWith('/api/rentals/') && path.endsWith('/review-status')) {
        const rentalId = path.slice('/api/rentals/'.length, -'/review-status'.length).trim();
        if (!rentalId) return errorResponse('Missing rental ID', 400, env, undefined, origin);
        const { user } = await requireUser(request, env);

        const rental = await env.RENTORA_DB.prepare(`
          SELECT r.*, l.id AS listing_id, l.title AS listing_title, l.owner_user_id,
                 ru.username AS renter_username, ru.display_name AS renter_display_name, ru.avatar_url AS renter_avatar,
                 ou.username AS owner_username, ou.display_name AS owner_display_name, ou.avatar_url AS owner_avatar
          FROM rentals r
          JOIN listings l ON l.id = r.listing_id
          JOIN users ru ON ru.id = r.renter_user_id
          JOIN users ou ON ou.id = l.owner_user_id
          WHERE r.id = ?1
          LIMIT 1
        `).bind(rentalId).first();

        if (!rental) return errorResponse('Rental not found', 404, env, undefined, origin);

        const isRenter = (rental.renter_user_id === user.id);
        const isOwner = (rental.owner_user_id === user.id);
        const isAdminUser = isAdmin(user.pi_uid, env) && user.role === 'admin';

        if (!isRenter && !isOwner && !isAdminUser) {
          return errorResponse('Access denied to rental review status', 403, env, undefined, origin);
        }

        const isCompleted = (rental.status === 'completed');
        const isPaid = (rental.payment_status === 'completed');
        const isEligible = isCompleted && isPaid;

        const reviews = await env.RENTORA_DB.prepare(`
          SELECT r.*, u.username AS reviewer_username, u.display_name AS reviewer_display_name, u.avatar_url AS reviewer_avatar
          FROM reviews r
          JOIN users u ON u.id = r.reviewer_user_id
          WHERE r.rental_id = ?1
        `).bind(rentalId).all();

        const reviewList = reviews.results || [];
        const myReview = reviewList.find(r => r.reviewer_user_id === user.id) || null;
        const otherReview = reviewList.find(r => r.reviewer_user_id !== user.id) || null;

        const headers = {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
        };
        if (origin) { headers['Access-Control-Allow-Origin'] = origin; headers['Vary'] = 'Origin'; }

        return new Response(JSON.stringify({
          success: true,
          rentalId: rental.id,
          listingId: rental.listing_id,
          listingTitle: rental.listing_title,
          isEligible,
          userRole: isRenter ? 'renter' : (isOwner ? 'owner' : 'admin'),
          otherParty: isRenter ? {
            id: rental.owner_user_id,
            username: rental.owner_username,
            displayName: rental.owner_display_name,
            avatar: rental.owner_avatar
          } : {
            id: rental.renter_user_id,
            username: rental.renter_username,
            displayName: rental.renter_display_name,
            avatar: rental.renter_avatar
          },
          myReview: myReview ? {
            id: myReview.id,
            rating: myReview.rating,
            reviewText: myReview.review_text || '',
            createdAt: myReview.created_at
          } : null,
          otherReview: otherReview ? {
            id: otherReview.id,
            rating: otherReview.rating,
            reviewText: otherReview.review_text || '',
            createdAt: otherReview.created_at
          } : null,
          hasUserReviewed: Boolean(myReview),
          hasOtherReviewed: Boolean(otherReview)
        }), { status: 200, headers });
      }

      if (method === 'POST' && path.startsWith('/api/rentals/') && path.endsWith('/reviews')) {
        const rentalId = path.slice('/api/rentals/'.length, -'/reviews'.length).trim();
        if (!rentalId) return errorResponse('Missing rental ID', 400, env, undefined, origin);
        const { user } = await requireUser(request, env);
        const body = await readJson(request);

        const rawRating = body?.rating;
        if (rawRating === undefined || rawRating === null || typeof rawRating !== 'number' || !Number.isInteger(rawRating)) {
          return errorResponse('Rating must be an integer between 1 and 5', 400, env, undefined, origin);
        }
        const rating = Number(rawRating);
        if (rating < 1 || rating > 5) {
          return errorResponse('Rating must be an integer between 1 and 5', 400, env, undefined, origin);
        }

        const reviewText = String(body?.reviewText || body?.comment || '').trim();
        if (reviewText.length > 1000) {
          return errorResponse('Review text is too long (max 1000 characters)', 400, env, undefined, origin);
        }

        const rental = await env.RENTORA_DB.prepare(`
          SELECT r.*, l.id AS listing_id, l.owner_user_id
          FROM rentals r
          JOIN listings l ON l.id = r.listing_id
          WHERE r.id = ?1
          LIMIT 1
        `).bind(rentalId).first();

        if (!rental) return errorResponse('Rental not found', 404, env, undefined, origin);

        const isRenter = (rental.renter_user_id === user.id);
        const isOwner = (rental.owner_user_id === user.id);

        if (!isRenter && !isOwner) {
          return errorResponse('Only participants of this rental are permitted to leave a review', 403, env, undefined, origin);
        }

        if (rental.status !== 'completed' || rental.payment_status !== 'completed') {
          return errorResponse('Review is only permitted after rental is completed and payment is verified', 403, env, undefined, origin);
        }

        const reviewerUserId = user.id;
        const revieweeUserId = isRenter ? rental.owner_user_id : rental.renter_user_id;

        if (reviewerUserId === revieweeUserId) {
          return errorResponse('Self-rating is not allowed', 400, env, undefined, origin);
        }

        const existing = await env.RENTORA_DB.prepare(`
          SELECT id FROM reviews
          WHERE rental_id = ?1 AND reviewer_user_id = ?2 AND reviewee_user_id = ?3
          LIMIT 1
        `).bind(rentalId, reviewerUserId, revieweeUserId).first();

        if (existing) {
          return errorResponse('Duplicate review: you have already submitted a review for this rental', 409, env, undefined, origin);
        }

        const reviewId = `rev_${crypto.randomUUID()}`;
        const createdAt = now();

        await env.RENTORA_DB.prepare(`
          INSERT INTO reviews(id, rental_id, listing_id, reviewer_user_id, reviewee_user_id, rating, review_text, status, created_at, updated_at)
          VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, 'approved', ?8, ?8)
        `).bind(reviewId, rentalId, rental.listing_id, reviewerUserId, revieweeUserId, rating, reviewText || null, createdAt).run();

        const headers = {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
        };
        if (origin) { headers['Access-Control-Allow-Origin'] = origin; headers['Vary'] = 'Origin'; }

        return new Response(JSON.stringify({
          success: true,
          review: {
            id: reviewId,
            rentalId,
            listingId: rental.listing_id,
            reviewerUserId,
            reviewerUsername: user.username,
            revieweeUserId,
            rating,
            reviewText,
            createdAt
          }
        }), { status: 201, headers });
      }

      if (method === 'GET' && path.startsWith('/api/users/') && path.endsWith('/reviews')) {
        const identifier = path.slice('/api/users/'.length, -'/reviews'.length).trim();
        if (!identifier) return errorResponse('Missing user identifier', 400, env, undefined, origin);

        const targetUser = await env.RENTORA_DB.prepare(`
          SELECT id, pi_uid, username, display_name, avatar_url
          FROM users
          WHERE id = ?1 OR pi_uid = ?1 OR lower(username) = lower(?1)
          LIMIT 1
        `).bind(identifier).first();

        if (!targetUser) return errorResponse('User not found', 404, env, undefined, origin);

        const rows = await env.RENTORA_DB.prepare(`
          SELECT
            r.id,
            r.rental_id,
            r.listing_id,
            r.rating,
            r.review_text,
            r.created_at,
            u.username AS reviewer_username,
            u.display_name AS reviewer_display_name,
            u.avatar_url AS reviewer_avatar,
            l.title AS listing_title
          FROM reviews r
          JOIN users u ON u.id = r.reviewer_user_id
          JOIN listings l ON l.id = r.listing_id
          WHERE r.reviewee_user_id = ?1 AND r.status = 'approved'
          ORDER BY r.created_at DESC
        `).bind(targetUser.id).all();

        const reviewList = rows.results || [];
        const totalReviews = reviewList.length;
        const averageRating = totalReviews > 0
          ? Number((reviewList.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
          : null;

        const headers = {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
          'X-Content-Type-Options': 'nosniff'
        };
        if (origin) { headers['Access-Control-Allow-Origin'] = origin; headers['Vary'] = 'Origin'; }

        return new Response(JSON.stringify({
          success: true,
          userId: targetUser.id,
          username: targetUser.username,
          stats: {
            totalReviews,
            averageRating,
            isNew: totalReviews === 0
          },
          reviews: reviewList.map(r => ({
            id: r.id,
            rentalId: r.rental_id,
            listingId: r.listing_id,
            listingTitle: r.listing_title,
            reviewerUsername: r.reviewer_username,
            reviewerDisplayName: r.reviewer_display_name,
            reviewerAvatar: r.reviewer_avatar,
            rating: r.rating,
            reviewText: r.review_text || '',
            createdAt: r.created_at
          }))
        }), { status: 200, headers });
      }

      if (method === 'GET' && path.startsWith('/api/listings/') && path.endsWith('/reviews')) {
        const listingId = path.slice('/api/listings/'.length, -'/reviews'.length).trim();
        if (!listingId) return errorResponse('Missing listing ID', 400, env, undefined, origin);

        const listing = await env.RENTORA_DB.prepare(`
          SELECT id, title, owner_user_id FROM listings WHERE id = ?1 AND status != 'deleted' LIMIT 1
        `).bind(listingId).first();

        if (!listing) return errorResponse('Listing not found', 404, env, undefined, origin);

        const rows = await env.RENTORA_DB.prepare(`
          SELECT
            r.id,
            r.rental_id,
            r.listing_id,
            r.rating,
            r.review_text,
            r.created_at,
            u.username AS reviewer_username,
            u.display_name AS reviewer_display_name,
            u.avatar_url AS reviewer_avatar
          FROM reviews r
          JOIN users u ON u.id = r.reviewer_user_id
          WHERE r.listing_id = ?1 AND r.reviewee_user_id = ?2 AND r.status = 'approved'
          ORDER BY r.created_at DESC
        `).bind(listing.id, listing.owner_user_id).all();

        const reviewList = rows.results || [];
        const totalReviews = reviewList.length;
        const averageRating = totalReviews > 0
          ? Number((reviewList.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1))
          : null;

        const headers = {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
          'X-Content-Type-Options': 'nosniff'
        };
        if (origin) { headers['Access-Control-Allow-Origin'] = origin; headers['Vary'] = 'Origin'; }

        return new Response(JSON.stringify({
          success: true,
          listingId: listing.id,
          stats: {
            totalReviews,
            averageRating,
            isNew: totalReviews === 0
          },
          reviews: reviewList.map(r => ({
            id: r.id,
            rentalId: r.rental_id,
            reviewerUsername: r.reviewer_username,
            reviewerDisplayName: r.reviewer_display_name,
            reviewerAvatar: r.reviewer_avatar,
            rating: r.rating,
            reviewText: r.review_text || '',
            createdAt: r.created_at
          }))
        }), { status: 200, headers });
      }

      // =========================================================================
      // AUTHORITATIVE DISPUTES & VIOLATION REPORTS
      // =========================================================================
      if (method === 'POST' && path === '/api/reports') {
        const { user } = await requireUser(request, env);
        const body = await readJson(request);

        const targetType = String(body?.type || body?.targetType || 'listing').trim().toLowerCase();
        const targetId = String(body?.targetId || body?.targetUsername || body?.targetTitle || '').trim();
        const reason = String(body?.reason || 'other').trim();
        const details = String(body?.details || body?.description || '').trim();

        if (!targetId) return errorResponse('Target identifier is required', 400, env, undefined, origin);
        if (!reason) return errorResponse('Report reason is required', 400, env, undefined, origin);
        if (details.length > 2000) return errorResponse('Details too long (max 2000 characters)', 400, env, undefined, origin);

        const reportId = `rep_${crypto.randomUUID()}`;
        const meta = {
          targetUsername: body?.targetUsername || null,
          targetTitle: body?.targetTitle || null,
          details,
          reporterUsername: user.username
        };

        await env.RENTORA_DB.prepare(`
          INSERT INTO reports(id, reporter_user_id, target_type, target_id, reason, status, metadata, created_at, updated_at)
          VALUES(?1, ?2, ?3, ?4, ?5, 'open', ?6, ?7, ?7)
        `).bind(reportId, user.id, targetType, targetId, reason, JSON.stringify(meta), now()).run();

        return jsonResponse({
          success: true,
          reportId,
          report: {
            id: reportId,
            reporterUserId: user.id,
            reporterUsername: user.username,
            targetType,
            targetId,
            reason,
            status: 'open',
            details,
            createdAt: now()
          }
        }, 201, env, origin);
      }

      if (method === 'POST' && path.startsWith('/api/reports/') && path.endsWith('/resolve')) {
        const reportId = path.slice('/api/reports/'.length, -'/resolve'.length).trim();
        if (!reportId) return errorResponse('Missing report ID', 400, env, undefined, origin);
        const { user } = await requireAdmin(request, env);
        const body = await readJson(request);
        const status = String(body?.status || 'resolved').trim().toLowerCase();
        const allowed = ['resolved', 'dismissed', 'reviewing'];
        const finalStatus = allowed.includes(status) ? status : 'resolved';

        const report = await env.RENTORA_DB.prepare('SELECT id FROM reports WHERE id=?1 LIMIT 1').bind(reportId).first();
        if (!report) return errorResponse('Report not found', 404, env, undefined, origin);

        await env.RENTORA_DB.prepare('UPDATE reports SET status=?1, updated_at=?2 WHERE id=?3')
          .bind(finalStatus, now(), reportId).run();

        return jsonResponse({ success: true, reportId, status: finalStatus, resolvedBy: user.username }, 200, env, origin);
      }

      // Legacy review endpoint permanently deprecated
      if (method === 'POST' && path === '/api/sync/review') {
        return errorResponse('Legacy review endpoint is deprecated. Please use POST /api/rentals/:rentalId/reviews', 410, env, undefined, origin);
      }

      if (method === 'POST' && path === '/api/sync/rental') {
        const { user } = await requireUser(request, env);
        const rental = await readJson(request);
        if (!rental?.id || !rental.itemId || !rental.startDate || !rental.endDate) return errorResponse('Invalid rental', 400, env, undefined, origin);
        const listing = await env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE l.id=?1 AND l.status='active' LIMIT 1`).bind(rental.itemId).first();
        if (!listing) return errorResponse('Listing not found', 404, env, undefined, origin);
        if (listing.owner_user_id === user.id) return errorResponse('Owner cannot rent own listing', 409, env, undefined, origin);
        const start = new Date(`${rental.startDate}T00:00:00Z`);
        const end = new Date(`${rental.endDate}T00:00:00Z`);
        const days = Math.max(1, Math.ceil((end - start) / 86400000));
        const rentalAmount = Number(listing.price_per_day) * days;
        const deposit = Number(listing.deposit_amount);
        const fee = Math.max(0.0001, rentalAmount * Number(listing.platform_fee_rate || env.PLATFORM_FEE_RATE || 0.05));
        const total = fee;

        // Cancel previous pending_payment rentals by the same renter on the same listing so they don't block themselves
        await env.RENTORA_DB.prepare(`UPDATE rentals SET status='cancelled', updated_at=?1 WHERE listing_id=?2 AND renter_user_id=?3 AND status='pending_payment' AND id<>?4`).bind(now(), listing.id, user.id, rental.id).run().catch(() => {});

        const existing = await env.RENTORA_DB.prepare('SELECT id FROM rentals WHERE id=?1').bind(rental.id).first();
        const metadata = JSON.stringify({ ...rental, id: rental.id, itemId: listing.id, ownerUid: listing.owner_pi_uid, ownerUsername: listing.owner_username, renterUid: user.pi_uid, renterUsername: user.username, daysCount: days, pricePerDay: listing.price_per_day, rentalTotal: rentalAmount, baseAmount: rentalAmount, deposit, securityDeposit: deposit, rentoraFee: fee, totalPlatformFee: fee, paymentDueToRentora: fee });
        if (existing) {
          const own = await env.RENTORA_DB.prepare('SELECT renter_user_id FROM rentals WHERE id=?1').bind(rental.id).first();
          if (!own || own.renter_user_id !== user.id) return errorResponse('Rental ownership denied', 403, env, undefined, origin);
          await env.RENTORA_DB.prepare(`UPDATE rentals SET start_date=?1,end_date=?2,rental_amount=?3,deposit_amount=?4,platform_fee=?5,total_amount=?6,metadata=?7,updated_at=?8 WHERE id=?9`).bind(rental.startDate, rental.endDate, rentalAmount, deposit, fee, total, metadata, now(), rental.id).run();
        } else {
          await env.RENTORA_DB.prepare(`INSERT INTO rentals(id,listing_id,renter_user_id,start_date,end_date,rental_amount,deposit_amount,platform_fee,total_amount,status,payment_status,metadata,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,'pending_payment','unpaid',?10,?11,?11)`).bind(rental.id, listing.id, user.id, rental.startDate, rental.endDate, rentalAmount, deposit, fee, total, metadata, now()).run();
        }
        const saved = await env.RENTORA_DB.prepare(`SELECT r.*, l.price_per_day, ru.pi_uid renter_pi_uid, ru.username renter_username, ou.pi_uid owner_pi_uid, ou.username owner_username FROM rentals r JOIN listings l ON l.id=r.listing_id JOIN users ru ON ru.id=r.renter_user_id JOIN users ou ON ou.id=l.owner_user_id WHERE r.id=?1`).bind(rental.id).first();
        return jsonResponse({ success: true, rental: rentalView(saved) }, 200, env, origin);
      }
      if (method === 'POST' && path === '/api/sync/rental/status') { const { user } = await requireUser(request, env); const body = await readJson(request); const rentalId = String(body?.rentalId || '').trim(); const action = String(body?.action || '').trim().toLowerCase(); if (!rentalId || !['handover','return'].includes(action)) return errorResponse('rentalId and a valid action are required', 400, env, undefined, origin); const rental = await env.RENTORA_DB.prepare(`SELECT r.*, l.owner_user_id, l.price_per_day, ru.pi_uid renter_pi_uid, ru.username renter_username, ou.pi_uid owner_pi_uid, ou.username owner_username FROM rentals r JOIN listings l ON l.id=r.listing_id JOIN users ru ON ru.id=r.renter_user_id JOIN users ou ON ou.id=l.owner_user_id WHERE r.id=?1 LIMIT 1`).bind(rentalId).first(); if (!rental) return errorResponse('Rental not found', 404, env, undefined, origin); if (rental.renter_user_id !== user.id && rental.owner_user_id !== user.id) return errorResponse('Rental access denied', 403, env, undefined, origin); const meta = parseMetadata(rental.metadata); const targetStatus = action === 'handover' ? 'active' : 'completed'; const expectedStatus = action === 'handover' ? 'confirmed' : 'active'; const flag = action === 'handover' ? 'isHandoverConfirmed' : 'isReturnConfirmed'; const timestampKey = action === 'handover' ? 'handoverTimestamp' : 'returnTimestamp'; if (rental.status === targetStatus && meta[flag]) return jsonResponse({ success: true, idempotent: true, rental: rentalView(rental) }, 200, env, origin); if (rental.status !== expectedStatus) return errorResponse(`Invalid rental transition from ${rental.status || 'unknown'}`, 409, env, undefined, origin); const updatedMeta = { ...meta, [flag]: true, [timestampKey]: now() }; const updatedAt = now(); const claim = await env.RENTORA_DB.prepare(`UPDATE rentals SET status=?1,metadata=?2,updated_at=?3 WHERE id=?4 AND status=?5`).bind(targetStatus, JSON.stringify(updatedMeta), updatedAt, rentalId, expectedStatus).run(); if (!Number(claim?.meta?.changes || 0)) return errorResponse('Rental transition was concurrently changed', 409, env, undefined, origin); const saved = await env.RENTORA_DB.prepare(`SELECT r.*, l.price_per_day, ru.pi_uid renter_pi_uid, ru.username renter_username, ou.pi_uid owner_pi_uid, ou.username owner_username FROM rentals r JOIN listings l ON l.id=r.listing_id JOIN users ru ON ru.id=r.renter_user_id JOIN users ou ON ou.id=l.owner_user_id WHERE r.id=?1`).bind(rentalId).first(); return jsonResponse({ success: true, rental: rentalView(saved) }, 200, env, origin); }
      if (method === 'POST' && path === '/api/sync/user') {
        const { user } = await requireUser(request, env);
        const body = await readJson(request);
        const allowed = { displayName: body.displayName, avatar: body.avatar, bio: body.bio, location: body.location, phoneMasked: body.phoneMasked };
        const meta = { ...parseMetadata(user.metadata), ...Object.fromEntries(Object.entries(allowed).filter(([,v]) => v !== undefined)) };
        const newAvatar = body.avatar !== undefined ? String(body.avatar).trim() : user.avatar_url;
        const newDisplayName = body.displayName !== undefined ? String(body.displayName).trim() : user.display_name;
        const oldAvatar = user.avatar_url;
        await env.RENTORA_DB.prepare('UPDATE users SET display_name=?1,avatar_url=?2,metadata=?3,updated_at=?4 WHERE id=?5').bind(newDisplayName || user.display_name || user.username, newAvatar || null, JSON.stringify(meta), now(), user.id).run();
        if (oldAvatar && newAvatar && oldAvatar !== newAvatar) {
          const oldIds = extractImageIds(oldAvatar);
          for (const oldId of oldIds) {
            if (ctx && typeof ctx.waitUntil === 'function') {
              ctx.waitUntil(safeDeleteMediaImage(oldId, env));
            } else {
              await safeDeleteMediaImage(oldId, env);
            }
          }
        }
        const updated = await env.RENTORA_DB.prepare('SELECT * FROM users WHERE id=?1').bind(user.id).first();
        return jsonResponse({ success: true, user: userView(updated, env) }, 200, env, origin);
      }
      if (method === 'POST' && path === '/api/upload') {
        const { user } = await requireUser(request, env);
        const body = await readJson(request, 2 * 1024 * 1024);
        const data = String(body?.data || '').trim();
        const mimeType = String(body?.mimeType || 'image/jpeg').trim().toLowerCase();
        if (!data || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
          return errorResponse('Invalid image format. Supported formats: JPEG, PNG, WebP.', 400, env, undefined, origin);
        }
        if (data.length > 2 * 1024 * 1024) {
          return errorResponse('Image file size exceeds the 2MB limit.', 413, env, undefined, origin);
        }
        let bytes;
        try {
          const commaIdx = data.indexOf(',');
          const base64Data = commaIdx !== -1 ? data.slice(commaIdx + 1) : data;
          const binaryStr = atob(base64Data);
          bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
        } catch (_) {
          return errorResponse('Invalid base64 image data', 400, env, undefined, origin);
        }
        if (bytes.byteLength > 2 * 1024 * 1024) {
          return errorResponse('Image file size exceeds the 2MB limit.', 413, env, undefined, origin);
        }
        const detectedMime = detectImageFormat(bytes);
        if (!detectedMime) {
          return errorResponse('Invalid image magic bytes. Supported formats: JPEG, PNG, WebP.', 400, env, undefined, origin);
        }
        const normalizedMime = (mimeType === 'image/jpg') ? 'image/jpeg' : mimeType;
        if (detectedMime !== normalizedMime) {
          return errorResponse(`MIME type mismatch: declared '${mimeType}' but detected '${detectedMime}'`, 400, env, undefined, origin);
        }
        const imgId = `img_${crypto.randomUUID()}`;
        if (env?.RENTORA_MEDIA) {
          await env.RENTORA_MEDIA.put(`images/${imgId}`, bytes, {
            httpMetadata: {
              contentType: detectedMime,
              cacheControl: 'public, max-age=31536000, immutable'
            },
            customMetadata: {
              uploaderUid: user.pi_uid,
              createdAt: now()
            }
          });
        } else if (env?.RENTORA_KV) {
          await env.RENTORA_KV.put(`image:${imgId}`, data, {
            expirationTtl: 60 * 60 * 24 * 365,
            metadata: { mimeType: detectedMime, uploaderUid: user.pi_uid, createdAt: now() }
          });
        } else {
          return errorResponse('Storage bindings required', 503, env, undefined, origin);
        }
        return jsonResponse({ success: true, id: imgId, url: `/api/images/${imgId}` }, 201, env, origin);
      }
      if (method === 'GET' && path.startsWith('/api/images/')) {
        const imgId = path.slice('/api/images/'.length).trim();
        if (!imgId || !/^img_[a-zA-Z0-9_-]+$/.test(imgId)) return errorResponse('Invalid image ID', 400, env, undefined, origin);

        // 1. Primary: Retrieve from Cloudflare R2 if available
        if (env?.RENTORA_MEDIA) {
          try {
            const r2Obj = await env.RENTORA_MEDIA.get(`images/${imgId}`);
            if (r2Obj) {
              const mime = r2Obj.httpMetadata?.contentType || 'image/jpeg';
              const cacheControl = r2Obj.httpMetadata?.cacheControl || 'public, max-age=31536000, immutable';
              const headers = {
                'Content-Type': mime,
                'Cache-Control': cacheControl,
                'X-Content-Type-Options': 'nosniff'
              };
              if (r2Obj.httpEtag) headers['ETag'] = r2Obj.httpEtag;
              return new Response(r2Obj.body, { status: 200, headers });
            }
          } catch (r2Err) {
            console.warn('R2 get error for', imgId, r2Err?.message);
          }
        }

        // 2. Fallback: Retrieve from Cloudflare KV
        if (env?.RENTORA_KV) {
          const item = await env.RENTORA_KV.getWithMetadata(`image:${imgId}`);
          if (item?.value) {
            const raw = item.value;
            const mime = item.metadata?.mimeType || 'image/jpeg';
            let binary;
            if (typeof raw === 'string' && raw.startsWith('data:')) {
              const commaIdx = raw.indexOf(',');
              const base64Data = commaIdx !== -1 ? raw.slice(commaIdx + 1) : raw;
              binary = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            } else if (typeof raw === 'string') {
              binary = Uint8Array.from(raw, c => c.charCodeAt(0));
            } else {
              binary = raw;
            }

            // 3. Lazy migration to R2 in background if R2 is present
            if (env?.RENTORA_MEDIA && binary) {
              const lazyMigrate = (async () => {
                try {
                  await env.RENTORA_MEDIA.put(`images/${imgId}`, binary, {
                    httpMetadata: {
                      contentType: mime,
                      cacheControl: 'public, max-age=31536000, immutable'
                    },
                    customMetadata: {
                      uploaderUid: item.metadata?.uploaderUid || 'legacy_migration',
                      createdAt: item.metadata?.createdAt || now()
                    }
                  });
                } catch (migErr) {
                  console.warn('Lazy R2 migration failed for', imgId, migErr?.message);
                }
              })();
              if (ctx && typeof ctx.waitUntil === 'function') {
                ctx.waitUntil(lazyMigrate);
              }
            }

            return new Response(binary, {
              status: 200,
              headers: {
                'Content-Type': mime,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-Content-Type-Options': 'nosniff'
              }
            });
          }
        }

        return errorResponse('Image not found', 404, env, undefined, origin);
      }
      if (method === 'POST' && path === '/api/sync/purge') { const { user } = await requireAdmin(request, env); await env.RENTORA_DB.batch([env.RENTORA_DB.prepare('DELETE FROM transactions'), env.RENTORA_DB.prepare('DELETE FROM payment_intents'), env.RENTORA_DB.prepare('DELETE FROM rentals'), env.RENTORA_DB.prepare('DELETE FROM reviews'), env.RENTORA_DB.prepare('DELETE FROM listings'), env.RENTORA_DB.prepare('DELETE FROM messages'), env.RENTORA_DB.prepare('DELETE FROM conversations'), env.RENTORA_DB.prepare('DELETE FROM reports'), env.RENTORA_DB.prepare('DELETE FROM listing_contacts')]); return jsonResponse({ success: true, purged: true, by: user.pi_uid }, 200, env, origin); }
      if (path.startsWith('/api/')) return errorResponse('Route Not Found', 404, env, undefined, origin);
      if (env?.ASSETS && typeof env.ASSETS.fetch === 'function') return env.ASSETS.fetch(request);
      return errorResponse('Route Not Found', 404, env, undefined, origin);
    } catch (err) {
      console.error('Rentora worker error', err);
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
      return errorResponse(displayMessage, status, env, undefined, origin);
    }
  }
};
