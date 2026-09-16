import legacyWorker from './_worker.js';

const MAX_BODY_BYTES = 16 * 1024;
const MONEY_SCALE = 10000;

function now() { return new Date().toISOString(); }
function isOriginAllowed(origin, requestUrl, env) {
  if (!origin) return true;
  try { if (origin === new URL(requestUrl).origin) return true; } catch (_) {}
  const configured = (env?.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  return configured.length === 0 || configured.includes('*') || configured.includes(origin);
}
function json(data, status, env, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
  const allowOrigin = origin || env?.CORS_ORIGIN || '';
  if (allowOrigin) { headers['Access-Control-Allow-Origin'] = allowOrigin; headers.Vary = 'Origin'; }
  return new Response(JSON.stringify(data), { status, headers });
}
function error(message, status, env, extra = {}, origin) { return json({ error: message, ...extra }, status, env, origin); }
async function readJson(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw Object.assign(new Error('Request body too large'), { status: 413 });
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
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
  let parsed; try { parsed = JSON.parse(session); } catch { throw Object.assign(new Error('Invalid session'), { status: 401 }); }
  const user = await env.RENTORA_DB.prepare('SELECT * FROM users WHERE pi_uid=?1 LIMIT 1').bind(parsed.uid).first();
  if (!user || user.status !== 'active') throw Object.assign(new Error('User is not active'), { status: 403 });
  return user;
}
async function piFetch(env, path, options = {}) {
  if (!env?.PI_API_KEY) throw Object.assign(new Error('Pi server API key is not configured'), { status: 503 });
  const base = String(env.PI_API_URL || 'https://api.minepi.com/v2').replace(/\/$/, '');
  const headers = new Headers(options.headers || {}); headers.set('Authorization', `Key ${env.PI_API_KEY}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${base}${path}`, { ...options, headers });
}
function validatePayment(payment, intent, user) {
  const identifier = String(payment?.identifier || '');
  if (!identifier || identifier !== String(intent.pi_payment_id || identifier)) throw Object.assign(new Error('Pi payment identifier mismatch'), { status: 409 });
  const payerUid = payment?.user_uid;
  if (String(payerUid || '') !== String(user.pi_uid)) throw Object.assign(new Error('Pi payer mismatch'), { status: 403 });
  if (String(payment?.metadata?.paymentIntentId || '') !== String(intent.id)) throw Object.assign(new Error('Pi payment metadata binding is missing or invalid'), { status: 409 });
  const amount = Number(payment?.amount);
  if (!Number.isFinite(amount) || Math.abs(amount - Number(intent.amount)) > 1e-9) throw Object.assign(new Error('Pi payment amount mismatch'), { status: 409 });
  if (String(payment?.memo || '') !== String(intent.memo)) throw Object.assign(new Error('Pi payment memo mismatch'), { status: 409 });
  if (String(payment?.network || '') !== 'Pi Testnet') throw Object.assign(new Error('Pi payment network mismatch'), { status: 409 });
  return payment.status || {};
}
async function paymentFromPi(env, paymentId) {
  const response = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}`);
  const payment = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error('Unable to verify Pi payment'), { status: 502 });
  return payment;
}
function parseMetadata(value) { if (!value) return {}; try { return JSON.parse(value); } catch { return {}; } }
function dateOnly(value) {
  const text = String(value || '').trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const timestamp = Date.parse(`${text}T00:00:00Z`); if (!Number.isFinite(timestamp)) return null;
  const normalized = new Date(timestamp).toISOString().slice(0, 10); return normalized === text ? text : null;
}
function calculateServerQuote(listing, startDate, endDate, env) {
  const start = Date.parse(`${startDate}T00:00:00Z`), end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw Object.assign(new Error('Invalid rental dates'), { status: 400 });
  const days = Math.ceil((end - start) / 86400000);
  if (days < 1 || days > 365) throw Object.assign(new Error('Rental duration must be between 1 and 365 days'), { status: 400 });
  const dailyRate = Number(listing.price_per_day), deposit = Number(listing.deposit_amount || 0);
  if (!Number.isFinite(dailyRate) || dailyRate < 0 || !Number.isFinite(deposit) || deposit < 0) throw Object.assign(new Error('Listing has invalid pricing'), { status: 409 });
  const dailyUnits = Math.max(0, Math.round((dailyRate + Number.EPSILON) * MONEY_SCALE));
  const depositUnits = Math.max(0, Math.round((deposit + Number.EPSILON) * MONEY_SCALE));
  const rentalUnits = dailyUnits * days;
  let feeRate = Number(listing.platform_fee_rate); if (!Number.isFinite(feeRate) || feeRate <= 0) feeRate = Number(env.PLATFORM_FEE_RATE || 0.05);
  feeRate = Math.max(0, Math.min(0.5, feeRate)); const feeUnits = rentalUnits > 0 ? Math.max(1, Math.round(rentalUnits * feeRate)) : 1;
  return { days, dailyRate: dailyUnits / MONEY_SCALE, rentalTotal: rentalUnits / MONEY_SCALE, deposit: depositUnits / MONEY_SCALE, platformFeeRate: feeRate, platformFee: feeUnits / MONEY_SCALE, totalAmount: feeUnits / MONEY_SCALE };
}
function rentalView(row) {
  const meta = parseMetadata(row.metadata);
  return { ...meta, id: row.id, bookingNumber: meta.bookingNumber || `RN-${String(row.id).slice(-8)}`, agreementId: meta.agreementId || null, itemId: row.listing_id, itemTitle: row.title, itemCategory: row.category, itemImage: meta.itemImage || (Array.isArray(meta.images) ? meta.images[0] : meta.images) || '', itemLocation: row.location, renterUid: row.renter_pi_uid, renterUsername: row.renter_username, ownerUid: row.owner_pi_uid, ownerUsername: row.owner_username, ownerAvatar: row.owner_avatar, startDate: row.start_date, endDate: row.end_date, daysCount: meta.daysCount || Math.max(1, Math.ceil((Date.parse(`${row.end_date}T00:00:00Z`) - Date.parse(`${row.start_date}T00:00:00Z`)) / 86400000)), pricePerDay: row.price_per_day, rentalTotal: row.rental_amount, baseAmount: row.rental_amount, deposit: row.deposit_amount, securityDeposit: row.deposit_amount, rentoraFee: row.platform_fee, totalPlatformFee: row.platform_fee, platformFeeRate: row.platform_fee_rate, totalAmount: row.total_amount, paymentDueToRentora: row.platform_fee, status: row.status, paymentStatus: row.payment_status, piPaymentId: row.pi_payment_id || meta.piPaymentId || null, piTxRef: row.pi_txid || meta.piTxRef || null, createdAt: row.created_at, updatedAt: row.updated_at };
}
async function loadRental(env, rentalId) {
  return env.RENTORA_DB.prepare(`SELECT r.*, l.title, l.category, l.location, l.price_per_day, l.deposit_amount, l.platform_fee_rate, ru.pi_uid AS renter_pi_uid, ru.username AS renter_username, ou.pi_uid AS owner_pi_uid, ou.username AS owner_username, ou.avatar_url AS owner_avatar FROM rentals r JOIN listings l ON l.id=r.listing_id JOIN users ru ON ru.id=r.renter_user_id JOIN users ou ON ou.id=l.owner_user_id WHERE r.id=?1 LIMIT 1`).bind(rentalId).first();
}
async function createRental(request, env, origin) {
  const user = await requireUser(request, env); const body = await readJson(request);
  const requestedRentalId = String(body?.id || '').trim();
  if (requestedRentalId) { const existing = await loadRental(env, requestedRentalId); if (existing) { if (existing.renter_user_id !== user.id) return error('Rental ownership denied', 403, env, {}, origin); return json({ success: true, rental: rentalView(existing), idempotent: true }, 200, env, origin); } }
  const listingId = String(body?.listingId || body?.itemId || '').trim(), startDate = dateOnly(body?.startDate), endDate = dateOnly(body?.endDate);
  if (!listingId) return error('listingId is required', 400, env, {}, origin); if (!startDate || !endDate) return error('Valid startDate and endDate are required', 400, env, {}, origin);
  const listing = await env.RENTORA_DB.prepare(`SELECT l.*, u.pi_uid AS owner_pi_uid, u.username AS owner_username FROM listings l JOIN users u ON u.id=l.owner_user_id WHERE l.id=?1 AND l.status='active' LIMIT 1`).bind(listingId).first();
  if (!listing) return error('Listing not found', 404, env, {}, origin);
  if (listing.status !== 'active') return error('Listing is not available for booking', 409, env, {}, origin);
  if (listing.owner_user_id === user.id || String(listing.owner_pi_uid) === String(user.pi_uid)) return error('Owner cannot rent own listing', 409, env, {}, origin);
  const quote = calculateServerQuote(listing, startDate, endDate, env); const id = `rental_${crypto.randomUUID()}`;
  const bookingNumber = `RN-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`, agreementId = `AGR-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`, createdAt = now();
  const clientMeta = body?.metadata && typeof body.metadata === 'object' ? body.metadata : {};
  const metadata = { ...clientMeta, bookingNumber, agreementId, daysCount: quote.days, itemImage: typeof body?.itemImage === 'string' ? body.itemImage : '', deliveryRequired: Boolean(body?.deliveryRequired), deliveryAddress: String(body?.deliveryAddress || ''), notes: String(body?.notes || ''), settlementType: 'direct_p2p_with_pi_platform_fee', isEscrowApplied: false };
  try { await env.RENTORA_DB.prepare(`INSERT INTO rentals(id, listing_id, renter_user_id, start_date, end_date, rental_amount, deposit_amount, platform_fee, total_amount, status, payment_status, metadata, created_at, updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?8,'pending_payment','unpaid',?9,?10,?10)`).bind(id, listingId, user.id, startDate, endDate, quote.rentalTotal, quote.deposit, quote.platformFee, JSON.stringify(metadata), createdAt, createdAt).run(); }
  catch (err) { if (/already reserved|overlap|UNIQUE|constraint/i.test(String(err?.message || err))) return error('Listing is already reserved for the requested dates', 409, env, {}, origin); throw err; }
  const rental = await loadRental(env, id); return json({ success: true, rental: rentalView(rental) }, 201, env, origin);
}
async function updateRentalStatus(request, env, origin) {
  const user = await requireUser(request, env), body = await readJson(request), rentalId = String(body?.rentalId || '').trim(), action = String(body?.action || '').trim().toLowerCase();
  if (!rentalId || !['handover', 'return'].includes(action)) return error('rentalId and a valid action are required', 400, env, {}, origin);
  const rental = await loadRental(env, rentalId); if (!rental) return error('Rental not found', 404, env, {}, origin);
  const isOwner = rental.owner_user_id === user.id, isRenter = rental.renter_user_id === user.id; if (!isOwner && !isRenter) return error('Access denied to rental', 403, env, {}, origin);
  let nextStatus;
  if (action === 'handover') { if (!['confirmed', 'active'].includes(rental.status)) return error('Rental must be confirmed before handover', 409, env, {}, origin); if (rental.payment_status !== 'completed') return error('Payment must be confirmed before handover', 409, env, {}, origin); if (rental.status === 'active') return json({ success: true, idempotent: true, rental: rentalView(rental) }, 200, env, origin); nextStatus = 'active'; }
  else { if (!isOwner) return error('Only the listing owner can confirm return', 403, env, {}, origin); if (rental.status === 'completed') return json({ success: true, idempotent: true, rental: rentalView(rental) }, 200, env, origin); if (rental.status !== 'active') return error('Rental must be active before return', 409, env, {}, origin); nextStatus = 'completed'; }
  const metadata = parseMetadata(rental.metadata); if (action === 'handover') metadata.handoverConfirmedAt = now(); if (action === 'return') metadata.returnConfirmedAt = now();
  await env.RENTORA_DB.prepare('UPDATE rentals SET status=?1, metadata=?2, updated_at=?3 WHERE id=?4').bind(nextStatus, JSON.stringify(metadata), now(), rentalId).run();
  const updated = await loadRental(env, rentalId); return json({ success: true, idempotent: false, rental: rentalView(updated) }, 200, env, origin);
}
async function approve(request, env) {
  const user = await requireUser(request, env), body = await readJson(request); if (!body.paymentId || !body.paymentIntentId) return error('paymentId and paymentIntentId are required', 400, env);
  let intent = await env.RENTORA_DB.prepare('SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2 LIMIT 1').bind(body.paymentIntentId, user.id).first();
  if (!intent || new Date(intent.expires_at) <= new Date()) return error('Payment intent is invalid or expired', 409, env); if (intent.status === 'completed') return json({ approved: true, paymentId: body.paymentId, idempotent: true }, 200, env); if (intent.pi_payment_id && intent.pi_payment_id !== body.paymentId) return error('Payment ID does not match intent', 409, env);
  const payment = await paymentFromPi(env, body.paymentId), status = validatePayment(payment, { ...intent, pi_payment_id: body.paymentId }, user); if (status.cancelled || status.user_cancelled || status.developer_completed) return error('Pi payment is not approvable in its current state', 409, env);
  if (status.developer_approved) { await env.RENTORA_DB.prepare("UPDATE payment_intents SET pi_payment_id=?1,status='approved',updated_at=?2 WHERE id=?3 AND status IN ('created','approved')").bind(body.paymentId, now(), intent.id).run(); return json({ approved: true, paymentId: body.paymentId, idempotent: true }, 200, env); }
  const approvalResponse = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}/approve`, { method: 'POST', body: '{}' }), approval = await approvalResponse.json().catch(() => ({})); if (!approvalResponse.ok) return error('Pi payment approval failed', 502, env, { details: approval });
  const claim = await env.RENTORA_DB.prepare("UPDATE payment_intents SET pi_payment_id=?1,status='approved',updated_at=?2 WHERE id=?3 AND status='created' AND pi_payment_id IS NULL").bind(body.paymentId, now(), intent.id).run();
  if (!Number(claim?.meta?.changes || 0)) { intent = await env.RENTORA_DB.prepare('SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2 LIMIT 1').bind(intent.id, user.id).first(); if (!intent || intent.pi_payment_id !== body.paymentId || !['approved', 'completed'].includes(intent.status)) return error('Payment intent was concurrently claimed by another payment', 409, env); }
  return json({ approved: true, paymentId: body.paymentId, data: approval, idempotent: Number(claim?.meta?.changes || 0) === 0 }, 200, env);
}
async function complete(request, env) {
  const user = await requireUser(request, env), body = await readJson(request); if (!body.paymentId || !body.txid || !body.paymentIntentId) return error('paymentId, txid and paymentIntentId are required', 400, env);
  const intent = await env.RENTORA_DB.prepare('SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2 LIMIT 1').bind(body.paymentIntentId, user.id).first(); if (!intent) return error('Payment intent not found', 404, env); if (intent.status === 'completed') return json({ completed: true, paymentId: intent.pi_payment_id, txid: intent.pi_txid, idempotent: true }, 200, env); if (intent.pi_payment_id && intent.pi_payment_id !== body.paymentId) return error('Payment ID does not match intent', 409, env); if (!['approved', 'completed'].includes(intent.status)) return error('Payment intent is not approved for completion', 409, env);
  const payment = await paymentFromPi(env, body.paymentId), status = validatePayment(payment, { ...intent, pi_payment_id: body.paymentId }, user); if (status.cancelled || status.user_cancelled) return error('Pi payment is cancelled', 409, env);
  const alreadyCompleted = Boolean(status.developer_completed);
  if (!alreadyCompleted) { const completionResponse = await piFetch(env, `/payments/${encodeURIComponent(body.paymentId)}/complete`, { method: 'POST', body: JSON.stringify({ txid: body.txid }) }); const completion = await completionResponse.json().catch(() => ({})); if (!completionResponse.ok) return error('Pi payment completion failed', 502, env, { details: completion }); if (!completion?.status?.developer_completed) return error('Pi did not confirm server-side completion', 502, env, { details: completion }); }
  else if (payment?.transaction?.txid && String(payment.transaction.txid) !== String(body.txid)) return error('Pi transaction ID mismatch', 409, env);
  await env.RENTORA_DB.batch([
    env.RENTORA_DB.prepare("UPDATE payment_intents SET pi_payment_id=?1,pi_txid=?2,status='completed',updated_at=?3 WHERE id=?4 AND status IN ('approved','completed')").bind(body.paymentId, body.txid, now(), intent.id),
    env.RENTORA_DB.prepare("UPDATE rentals SET payment_status='completed',status='confirmed',updated_at=?1 WHERE id=?2").bind(now(), intent.rental_id),
    env.RENTORA_DB.prepare("INSERT OR IGNORE INTO transactions(id,payment_intent_id,pi_payment_id,pi_txid,user_id,amount,type,status,created_at) VALUES(?1,?2,?3,?4,?5,?6,'platform_fee','completed',?7)").bind(`tx_${crypto.randomUUID()}`, intent.id, body.paymentId, body.txid, user.id, intent.amount, now()),
  ]);
  await env.RENTORA_KV.put(`payment-complete:${intent.id}`, JSON.stringify({ paymentId: body.paymentId, txid: body.txid, at: now() }), { expirationTtl: 60 * 60 * 24 * 30 });
  return json({ completed: true, paymentId: body.paymentId, txid: body.txid, recovered: alreadyCompleted }, 200, env);
}
export default { async fetch(request, env, ctx) {
  const url = new URL(request.url), origin = request.headers.get('Origin'); if (!isOriginAllowed(origin, request.url, env)) return error('Origin not allowed', 403, env, {}, origin);
  if (request.method === 'POST' && url.pathname === '/api/sync/rental') { try { return await createRental(request, env, origin); } catch (err) { return error(err?.message || 'Server error', Number(err?.status) || 500, env, {}, origin); } }
  if (request.method === 'POST' && url.pathname === '/api/sync/rental/status') { try { return await updateRentalStatus(request, env, origin); } catch (err) { return error(err?.message || 'Server error', Number(err?.status) || 500, env, {}, origin); } }
  if (request.method === 'POST' && url.pathname === '/api/payments/approve') { try { return await approve(request, env); } catch (err) { return error(err?.message || 'Server error', Number(err?.status) || 500, env, {}, origin); } }
  if (request.method === 'POST' && url.pathname === '/api/payments/complete') { try { return await complete(request, env); } catch (err) { return error(err?.message || 'Server error', Number(err?.status) || 500, env, {}, origin); } }
  return legacyWorker.fetch(request, env, ctx);
} };