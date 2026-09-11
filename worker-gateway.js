import paymentWorker from './worker-entry.js';

function now() {
  return new Date().toISOString();
}

function json(data, status, env) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
  if (env?.CORS_ORIGIN) {
    headers['Access-Control-Allow-Origin'] = env.CORS_ORIGIN;
    headers.Vary = 'Origin';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function error(message, status, env) {
  return json({ error: message }, status, env);
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
  const raw = await env.RENTORA_KV.get(`session:${await sha256(token)}`);
  if (!raw) throw Object.assign(new Error('Session expired or revoked'), { status: 401 });
  let session;
  try { session = JSON.parse(raw); } catch { throw Object.assign(new Error('Invalid session'), { status: 401 }); }
  const user = await env.RENTORA_DB.prepare('SELECT * FROM users WHERE pi_uid=?1 LIMIT 1').bind(session.uid).first();
  if (!user || user.status !== 'active') throw Object.assign(new Error('User is not active'), { status: 403 });
  return user;
}

function parseMetadata(value) {
  if (!value) return {};
  try { return JSON.parse(value); } catch { return {}; }
}

function listingView(row) {
  return {
    ...parseMetadata(row.metadata), id: row.id, title: row.title, description: row.description || '',
    category: row.category, location: row.location, pricePerDay: row.price_per_day,
    deposit: row.deposit_amount, ownerUid: row.owner_pi_uid, ownerUsername: row.owner_username,
    ownerAvatar: row.owner_avatar, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function rentalView(row) {
  return {
    ...parseMetadata(row.metadata), id: row.id, itemId: row.listing_id, renterUid: row.renter_pi_uid,
    renterUsername: row.renter_username, ownerUid: row.owner_pi_uid, ownerUsername: row.owner_username,
    startDate: row.start_date, endDate: row.end_date, pricePerDay: row.price_per_day,
    rentalTotal: row.rental_amount, baseAmount: row.rental_amount, deposit: row.deposit_amount,
    securityDeposit: row.deposit_amount, rentoraFee: row.platform_fee, totalPlatformFee: row.platform_fee,
    totalAmount: row.total_amount, status: row.status, paymentStatus: row.payment_status,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function userView(row) {
  return {
    id: row.id, uid: row.pi_uid, piUid: row.pi_uid, username: row.username,
    displayName: row.display_name, avatar: row.avatar_url, role: row.role,
    status: row.status, joinedDate: row.created_at?.slice(0, 10),
  };
}

async function safeSync(request, env) {
  const user = await requireUser(request, env);
  const isAdmin = user.role === 'admin' && String(env.ADMIN_PI_UIDS || '').split(',').map((v) => v.trim()).includes(String(user.pi_uid));

  const [items, rentals, transactions, reviews, chats] = await Promise.all([
    env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid owner_pi_uid, u.username owner_username, u.avatar_url owner_avatar FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE l.status != 'deleted' ORDER BY l.created_at DESC`).all(),
    env.RENTORA_DB.prepare(`SELECT r.*, l.price_per_day, ru.pi_uid renter_pi_uid, ru.username renter_username, ou.pi_uid owner_pi_uid, ou.username owner_username FROM rentals r JOIN listings l ON l.id=r.listing_id JOIN users ru ON ru.id=r.renter_user_id JOIN users ou ON ou.id=l.owner_user_id WHERE r.renter_user_id=?1 OR r.owner_user_id=?1 ORDER BY r.created_at DESC`).bind(user.id).all(),
    env.RENTORA_DB.prepare(`SELECT t.*, u.pi_uid user_pi_uid FROM transactions t JOIN users u ON u.id=t.user_id WHERE t.user_id=?1 ORDER BY t.created_at DESC`).bind(user.id).all(),
    env.RENTORA_DB.prepare(`SELECT r.*, au.pi_uid author_pi_uid, au.username author_username, tu.pi_uid target_pi_uid, tu.username target_username FROM reviews r JOIN users au ON au.id=r.author_user_id JOIN users tu ON tu.id=r.target_user_id WHERE r.author_user_id=?1 OR r.target_user_id=?1 ORDER BY r.created_at DESC`).bind(user.id).all(),
    env.RENTORA_DB.prepare(`SELECT c.*, ou.username owner_username, ru.username renter_username FROM chats c JOIN users ou ON ou.id=c.owner_user_id JOIN users ru ON ru.id=c.renter_user_id WHERE c.owner_user_id=?1 OR c.renter_user_id=?1 ORDER BY c.updated_at DESC`).bind(user.id).all(),
  ]);

  const out = {
    items: (items.results || []).map(listingView),
    rentals: (rentals.results || []).map(rentalView),
    transactions: transactions.results || [],
    users: [userView(user)],
    reviews: reviews.results || [],
    reports: [],
    chats: (chats.results || []).map((c) => ({ ...parseMetadata(c.metadata), id: c.id, ownerUsername: c.owner_username, renterUsername: c.renter_username, updatedAt: c.updated_at })),
    timestamp: now(),
  };

  if (isAdmin) {
    const [users, reports] = await Promise.all([
      env.RENTORA_DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all(),
      env.RENTORA_DB.prepare(`SELECT r.*, u.username reporter_username, u.pi_uid reporter_pi_uid FROM reports r JOIN users u ON u.id=r.reporter_user_id ORDER BY r.created_at DESC`).all(),
    ]);
    out.users = (users.results || []).map(userView);
    out.reports = reports.results || [];
  }
  return json(out, 200, env);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/sync/all') {
      try { return await safeSync(request, env); }
      catch (err) { return error(err?.message || 'Server error', Number(err?.status) || 500, env); }
    }
    return paymentWorker.fetch(request, env, ctx);
  },
};
