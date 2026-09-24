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

const PAYOUT_ACTIVE_STATES = ['reserved', 'creating', 'pi_created', 'approving', 'approved', 'completing', 'reconciliation_required'];
const PAYOUT_FINAL_STATES = ['completed', 'cancelled'];
const PAYOUT_STALE_MS = 15 * 60 * 1000;
const PAYOUT_LEASE_MS = 5 * 60 * 1000;
const PAYOUT_TRANSITIONS = Object.freeze({
  reserved: ['creating', 'cancelled', 'reconciliation_required'],
  creating: ['pi_created', 'cancelled', 'reconciliation_required'],
  pi_created: ['approving', 'cancelled', 'reconciliation_required'],
  approving: ['approved', 'completed', 'cancelled', 'reconciliation_required'],
  approved: ['completing', 'completed', 'cancelled', 'reconciliation_required'],
  completing: ['completed', 'cancelled', 'reconciliation_required'],
  completed: ['completed'],
  cancelled: ['cancelled'],
  reconciliation_required: ['approving', 'approved', 'completing', 'completed', 'cancelled', 'reconciliation_required']
});

function payoutOperationResponse(op, request, env, extra = {}) {
  const completed = op?.status === 'completed';
  const cancelled = op?.status === 'cancelled';
  return json({
    success: completed,
    pending: !completed && !cancelled,
    status: op?.status,
    paymentId: op?.pi_payment_id || undefined,
    txid: op?.txid || undefined,
    amount: Number(op?.amount || 0),
    recipient: op?.recipient || undefined,
    leaseOwner: op?.lease_owner || undefined,
    idempotent: true,
    ...extra
  }, completed ? 200 : cancelled ? 409 : 202, request, env);
}

async function getPayoutOperation(env, key) {
  return env.RENTORA_DB.prepare('SELECT * FROM payout_operations WHERE operation_key=?1 LIMIT 1').bind(key).first();
}

async function claimPayoutOperation(env, key, details) {
  const existing = await getPayoutOperation(env, key);
  const leaseOwner = `lease_${crypto.randomUUID()}`;
  const leaseExpires = new Date(Date.now() + PAYOUT_LEASE_MS).toISOString();
  if (existing) {
    if (existing.status === 'reserved') {
      if (details.leaseOwner && details.leaseOwner === existing.lease_owner && (!existing.lease_expires_at || existing.lease_expires_at > now())) return { created: true, operation: existing, leaseOwner: details.leaseOwner };
      const takeover = await env.RENTORA_DB.prepare("UPDATE payout_operations SET lease_owner=?1, lease_expires_at=?2, updated_at=?3 WHERE operation_key=?4 AND status='reserved' AND (lease_expires_at IS NULL OR lease_expires_at < ?3)").bind(leaseOwner, leaseExpires, now(), key).run();
      const operation = await getPayoutOperation(env, key);
      if (Number(takeover?.meta?.changes || 0) > 0) return { created: true, operation, leaseOwner };
    }
    return { created: false, operation: await getPayoutOperation(env, key), leaseOwner };
  }
  const nowValue = now();
  const reservation = await env.RENTORA_DB.prepare(`
    INSERT INTO payout_operations(
      id, operation_key, status, amount, user_id, recipient, created_at, updated_at, reservation_expires_at, lease_owner, lease_expires_at
    )
    SELECT ?1, ?2, 'reserved', ?3, ?4, ?5, ?6, ?6, ?7, ?8, ?9    WHERE ?3 > 0 AND ?3 <= (
      COALESCE((SELECT SUM(amount) FROM transactions WHERE status='completed' AND (type='platform_fee' OR type IS NULL)), 0)
      - COALESCE((SELECT SUM(amount) FROM transactions WHERE status='completed' AND type='admin_payout'), 0)
      - COALESCE((SELECT SUM(amount) FROM payout_operations WHERE status IN ('reserved','creating','pi_created','approving','approved','completing','reconciliation_required')), 0)
    )
    ON CONFLICT(operation_key) DO NOTHING
  `).bind(
    `payout_${crypto.randomUUID()}`,
    key,
    details.amount,
    details.userId,
    details.recipient,
    nowValue,
    new Date(Date.now() + PAYOUT_STALE_MS).toISOString(),
    leaseOwner,
    leaseExpires
  ).run();
  const operation = await getPayoutOperation(env, key);
  return { created: Boolean(operation && Number(reservation?.meta?.changes || 0) > 0), operation, leaseOwner, insufficient: !operation };
}

async function acquirePayoutLease(env, operation, states = PAYOUT_ACTIVE_STATES) {
  if (!operation || !states.includes(operation.status)) return null;
  const leaseOwner = 'lease_' + crypto.randomUUID();
  const leaseExpires = new Date(Date.now() + PAYOUT_LEASE_MS).toISOString();
  const placeholders = states.map((_, index) => '?' + (5 + index)).join(',');
  const result = await env.RENTORA_DB.prepare(`UPDATE payout_operations SET lease_owner=?1, lease_expires_at=?2, updated_at=?3 WHERE operation_key=?4 AND status IN (${placeholders}) AND (lease_expires_at IS NULL OR lease_expires_at < ?3)`).bind(leaseOwner, leaseExpires, now(), operation.operation_key, ...states).run();
  if (Number(result?.meta?.changes || 0) !== 1) return null;
  return { ...(await getPayoutOperation(env, operation.operation_key)), lease_owner: leaseOwner };
}

async function renewPayoutLease(env, operation) {
  if (!operation?.operation_key || !operation?.lease_owner) return null;
  const leaseExpires = new Date(Date.now() + PAYOUT_LEASE_MS).toISOString();
  const renewedAt = now();
  const result = await env.RENTORA_DB.prepare(
    "UPDATE payout_operations SET lease_expires_at=?1, updated_at=?2 WHERE operation_key=?3 AND status=?4 AND lease_owner=?5 AND lease_expires_at IS NOT NULL AND lease_expires_at > ?2"
  ).bind(leaseExpires, renewedAt, operation.operation_key, operation.status, operation.lease_owner).run();
  if (Number(result?.meta?.changes || 0) !== 1) return null;
  return { ...operation, lease_expires_at: leaseExpires, updated_at: renewedAt };
}

async function transitionPayoutOperation(env, key, fromStates, toState, fields = {}) {
  if (!fromStates.every((state) => PAYOUT_TRANSITIONS[state]?.includes(toState))) throw new Error(`Invalid payout transition request: ${fromStates.join(',')} -> ${toState}`);
  const sets = ['status=?1', 'updated_at=?2'];
  const params = [toState, now()];
  if (Object.prototype.hasOwnProperty.call(fields, 'piPaymentId')) { sets.push(`pi_payment_id=?${params.length + 1}`); params.push(fields.piPaymentId); }
  if (Object.prototype.hasOwnProperty.call(fields, 'txid')) { sets.push(`txid=?${params.length + 1}`); params.push(fields.txid); }
  if (Object.prototype.hasOwnProperty.call(fields, 'error')) { sets.push(`error=?${params.length + 1}`); params.push(fields.error); }
  if (Object.prototype.hasOwnProperty.call(fields, 'clearLease') && fields.clearLease) { sets.push('lease_owner=NULL', 'lease_expires_at=NULL'); }
  const keyIndex = params.length + 1;
  params.push(key);
  const stateIndexes = fromStates.map((_, index) => `?${params.length + index + 1}`);
  params.push(...fromStates);
  const leaseClause = Object.prototype.hasOwnProperty.call(fields, 'leaseOwner') ? ` AND lease_owner=?${params.length + 1}` : '';
  if (Object.prototype.hasOwnProperty.call(fields, 'leaseOwner')) params.push(fields.leaseOwner);
  await env.RENTORA_DB.prepare(`UPDATE payout_operations SET ${sets.join(',')} WHERE operation_key=?${keyIndex} AND status IN (${stateIndexes.join(',')})${leaseClause}`).bind(...params).run();
  return getPayoutOperation(env, key);
}

async function markPayoutReconciliationRequired(env, operation, error) {
  if (!operation) return null;
  return transitionPayoutOperation(env, operation.operation_key, PAYOUT_ACTIVE_STATES, 'reconciliation_required', { error: String(error || 'Pi payment state requires reconciliation').slice(0, 1000) });
}

async function fetchPiPayment(env, paymentId) {
  const response = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}`);
  const payment = await response.json().catch(() => ({}));
  return { response, payment, status: normalizeStatus(payment?.status) };
}

async function validateA2UPayment(env, operation, payment) {
  const identifier = String(payment?.identifier || payment?.id || '').trim();
  if (!identifier || identifier !== String(operation?.pi_payment_id || '').trim()) {
    throw Object.assign(new Error('Pi A2U payment identifier does not match payout operation'), { status: 409 });
  }
  const user = await env.RENTORA_DB.prepare('SELECT pi_uid FROM users WHERE id=?1 LIMIT 1').bind(operation.user_id).first();
  const expectedUid = String(user?.pi_uid || '').trim().toLowerCase();
  const actualUid = String(payment?.user_uid || payment?.uid || '').trim().toLowerCase();
  if (!expectedUid || !actualUid || actualUid !== expectedUid) {
    throw Object.assign(new Error('Pi A2U recipient uid does not match payout operation'), { status: 409 });
  }
  const actualAmount = Math.round(Number(payment?.amount || 0) * 10000) / 10000;
  const expectedAmount = Math.round(Number(operation?.amount || 0) * 10000) / 10000;
  if (!Number.isFinite(actualAmount) || Math.abs(actualAmount - expectedAmount) > 0.0001) {
    throw Object.assign(new Error('Pi A2U payment amount does not match payout operation'), { status: 409 });
  }
  if (payment?.direction !== 'app_to_user') {
    throw Object.assign(new Error('Pi payment direction is not app-to-user'), { status: 409 });
  }
  if (payment?.network !== 'Pi Testnet') {
    throw Object.assign(new Error('Pi A2U payment is not on Pi Testnet'), { status: 409 });
  }
  const metadata = parsePaymentMetadata(payment?.metadata);
  if (metadata?.type !== 'admin_treasury_payout' || String(metadata?.operationKey || '') !== String(operation.operation_key)) {
    throw Object.assign(new Error('Pi A2U payment metadata does not match payout operation'), { status: 409 });
  }
  return true;
}

async function persistCompletedPayout(env, operation, paymentId, txid, verifiedPayment = null) {
  if (!txid) return markPayoutReconciliationRequired(env, operation, 'Completed Pi payment has no transaction id');
  try {
    const payment = verifiedPayment || (await fetchPiPayment(env, paymentId)).payment;
    await validateA2UPayment(env, operation, payment);
  } catch (error) {
    return markPayoutReconciliationRequired(env, operation, error.message || 'Pi A2U payment validation failed');
  }
  const existing = await env.RENTORA_DB.prepare('SELECT * FROM transactions WHERE pi_payment_id=?1 OR pi_txid=?2 LIMIT 1').bind(paymentId, txid).first();
  if (existing && (String(existing.pi_txid || '') !== String(txid) || Number(existing.amount) !== Number(operation.amount))) {
    return markPayoutReconciliationRequired(env, operation, 'Payment id is already linked to a conflicting transaction');
  }
  if (existing) {
    if (String(existing.pi_payment_id || '') !== String(paymentId) || String(existing.pi_txid || '') !== String(txid)) return markPayoutReconciliationRequired(env, operation, 'Payment id or transaction id is already linked to a conflicting transaction');
    await transitionPayoutOperation(env, operation.operation_key, ['approving', 'approved', 'completing', 'reconciliation_required', 'completed'], 'completed', { piPaymentId: paymentId, txid });
    return getPayoutOperation(env, operation.operation_key);
  }
  const batchResults = await env.RENTORA_DB.batch([
    env.RENTORA_DB.prepare("INSERT OR IGNORE INTO transactions(id,payment_intent_id,pi_payment_id,pi_txid,user_id,amount,type,status,created_at) VALUES(?1,NULL,?2,?3,?4,?5,'admin_payout','completed',?6)").bind(`tx_${crypto.randomUUID()}`, paymentId, txid, operation.user_id, operation.amount, now()),
    env.RENTORA_DB.prepare("UPDATE payout_operations SET status='completed',pi_payment_id=COALESCE(?1,pi_payment_id),txid=?2,error=NULL,updated_at=?3,lease_owner=NULL,lease_expires_at=NULL WHERE operation_key=?4 AND status IN ('approving','approved','completing','reconciliation_required') AND EXISTS (SELECT 1 FROM transactions WHERE pi_payment_id=?1 AND pi_txid=?2 AND user_id=?5 AND amount=?6 AND type='admin_payout' AND status='completed')").bind(paymentId, txid, now(), operation.operation_key, operation.user_id, operation.amount)
  ]);
  const completionUpdate = batchResults?.[1];
  if (Number(completionUpdate?.meta?.changes || 0) !== 1) {
    return markPayoutReconciliationRequired(env, operation, 'Completed payout transaction was not durably linked to the payout operation');
  }
  return getPayoutOperation(env, operation.operation_key);
}

async function completePayoutOperation(env, operation) {
  const leased = await acquirePayoutLease(env, operation, ['approved', 'completing']);
  if (!leased) return getPayoutOperation(env, operation.operation_key);
  operation = leased;
  if (!operation?.pi_payment_id) return markPayoutReconciliationRequired(env, operation, 'Cannot complete payout without a durable Pi payment id');
  const current = await fetchPiPayment(env, operation.pi_payment_id);
  if (!current.response.ok) return markPayoutReconciliationRequired(env, operation, `Unable to read Pi payment before completion (${current.response.status})`);
  if (current.status.cancelled || current.status.user_cancelled) return transitionPayoutOperation(env, operation.operation_key, PAYOUT_ACTIVE_STATES, 'cancelled', { error: 'Pi payment was cancelled' });
  try {
    await validateA2UPayment(env, operation, current.payment);
  } catch (error) {
    return markPayoutReconciliationRequired(env, operation, error.message || 'Pi A2U payment validation failed');
  }
  const currentTxid = current.payment?.transaction?.txid || operation.txid;
  if (current.status.developer_completed) return persistCompletedPayout(env, operation, operation.pi_payment_id, currentTxid, current.payment);
  if (!currentTxid) return transitionPayoutOperation(env, operation.operation_key, ['approved', 'completing'], 'approved');
  operation = await transitionPayoutOperation(env, operation.operation_key, ['approved', 'reconciliation_required'], 'completing', { txid: currentTxid, leaseOwner: operation.lease_owner });
  const beforeComplete = await fetchPiPayment(env, operation.pi_payment_id);
  if (!beforeComplete.response.ok) return markPayoutReconciliationRequired(env, operation, `Unable to reconcile Pi payment before complete (${beforeComplete.response.status})`);
  try {
    await validateA2UPayment(env, operation, beforeComplete.payment);
  } catch (error) {
    return markPayoutReconciliationRequired(env, operation, error.message || 'Pi A2U payment validation failed');
  }
  if (beforeComplete.status.developer_completed) return persistCompletedPayout(env, operation, operation.pi_payment_id, beforeComplete.payment?.transaction?.txid || currentTxid, beforeComplete.payment);
  operation = await renewPayoutLease(env, operation);
  if (!operation) return getPayoutOperation(env, operation?.operation_key);
  let completionResponse;
  let completion;
  try {
    completionResponse = await piFetch(env, `/payments/${encodeURIComponent(operation.pi_payment_id)}/complete`, { method: 'POST', body: JSON.stringify({ txid: currentTxid }) });
    completion = await completionResponse.json().catch(() => ({}));
  } catch (error) {
    return markPayoutReconciliationRequired(env, operation, error.message || 'Pi completion request was ambiguous');
  }
  if (!completionResponse.ok && !completion?.status?.developer_completed) {
    const afterError = await fetchPiPayment(env, operation.pi_payment_id).catch(() => null);
    if (afterError?.response?.ok && afterError.status.developer_completed) return persistCompletedPayout(env, operation, operation.pi_payment_id, afterError.payment?.transaction?.txid || currentTxid);
    return markPayoutReconciliationRequired(env, operation, piErrorMessage(completion, 'Pi completion requires reconciliation'));
  }
  const afterComplete = await fetchPiPayment(env, operation.pi_payment_id).catch(() => null);
  if (!afterComplete?.response?.ok) return markPayoutReconciliationRequired(env, operation, 'Pi A2U completion could not be re-verified');
  try {
    await validateA2UPayment(env, operation, afterComplete.payment);
  } catch (error) {
    return markPayoutReconciliationRequired(env, operation, error.message || 'Pi A2U payment validation failed after completion');
  }
  const verifiedTxid = afterComplete.payment?.transaction?.txid || completion?.transaction?.txid || completion?.status?.txid || currentTxid;
  return persistCompletedPayout(env, operation, operation.pi_payment_id, verifiedTxid, afterComplete.payment);
}

async function resumePayoutOperation(env, operation) {
  if (!operation) return null;
  if (PAYOUT_FINAL_STATES.includes(operation.status)) return operation;
  if (operation.status === 'reconciliation_required' && !operation.pi_payment_id) return operation;  if (operation.status === 'reconciliation_required' && operation.pi_payment_id) operation = await transitionPayoutOperation(env, operation.operation_key, ['reconciliation_required'], 'approving', { piPaymentId: operation.pi_payment_id });
  if (!operation.pi_payment_id && operation.status !== 'reserved') return markPayoutReconciliationRequired(env, operation, 'Operation has no durable Pi payment id and may have crossed a create boundary');
  if (operation.status === 'reserved') return operation;
  if (operation.status === 'creating' && operation.lease_expires_at && operation.lease_expires_at > now()) return operation;
  if (operation.status === 'creating') return markPayoutReconciliationRequired(env, operation, 'Create phase was interrupted before payment id persistence');
  if (operation.status === 'pi_created') operation = await transitionPayoutOperation(env, operation.operation_key, ['pi_created'], 'approving', { piPaymentId: operation.pi_payment_id });
  if (operation.status === 'approving') {
    const leased = await acquirePayoutLease(env, operation, ['approving']);
    if (!leased) return getPayoutOperation(env, operation.operation_key);
    operation = leased;
    const current = await fetchPiPayment(env, operation.pi_payment_id);
    if (!current.response.ok) return markPayoutReconciliationRequired(env, operation, `Unable to read Pi payment before approval (${current.response.status})`);
    if (current.status.cancelled || current.status.user_cancelled) return transitionPayoutOperation(env, operation.operation_key, ['approving'], 'cancelled', { error: 'Pi payment was cancelled' });
    try {
      await validateA2UPayment(env, operation, current.payment);
    } catch (error) {
      return markPayoutReconciliationRequired(env, operation, error.message || 'Pi A2U payment validation failed before approval');
    }
    if (current.status.developer_completed) return persistCompletedPayout(env, operation, operation.pi_payment_id, current.payment?.transaction?.txid, current.payment);
    if (!current.status.developer_approved) {
      operation = await renewPayoutLease(env, operation);
      if (!operation) return getPayoutOperation(env, operation?.operation_key);
      let approvedResponse;
      let approved;
      try {
        approvedResponse = await piFetch(env, `/payments/${encodeURIComponent(operation.pi_payment_id)}/approve`, { method: 'POST', body: '{}' });
        approved = await approvedResponse.json().catch(() => ({}));
      } catch (error) {
        return markPayoutReconciliationRequired(env, operation, error.message || 'Pi approval request was ambiguous');
      }
      if (!approvedResponse.ok) {
        const approvedError = String(JSON.stringify(approved));
        const alreadyApprovedText = 'Current payment is already approved';
        const alreadyApproved = approvedError.toLowerCase().includes(alreadyApprovedText.toLowerCase()) || approvedError.toLowerCase().includes('already approved');
        if (!alreadyApproved) return markPayoutReconciliationRequired(env, operation, piErrorMessage(approved, 'Pi approval requires reconciliation'));
        const reconciled = await fetchPiPayment(env, operation.pi_payment_id);
        if (!reconciled.response.ok) return markPayoutReconciliationRequired(env, operation, 'Already-approved response could not be reconciled');
        if (reconciled.status.developer_completed) return persistCompletedPayout(env, operation, operation.pi_payment_id, reconciled.payment?.transaction?.txid);
        if (!reconciled.status.developer_approved) return markPayoutReconciliationRequired(env, operation, 'Pi reported already approved but GET did not confirm approval');
        current.payment = reconciled.payment;
      }
    }
    operation = await transitionPayoutOperation(env, operation.operation_key, ['approving'], 'approved', { piPaymentId: operation.pi_payment_id, clearLease: true });
  }
  if (operation.status === 'approved' || operation.status === 'completing') return completePayoutOperation(env, operation);
  return operation;
}

async function reconcileStalePayoutOperations(env) {
  const recoveryScanSucceeded = await autoResolveIncompleteServerPayments(env, null);
  const cutoff = new Date(Date.now() - PAYOUT_STALE_MS).toISOString();
  const rows = await env.RENTORA_DB.prepare(`SELECT * FROM payout_operations WHERE status IN ('reserved','creating','pi_created','approving','approved','completing','reconciliation_required') AND updated_at < ?1 LIMIT 50`).bind(cutoff).all();
  for (const operation of rows?.results || []) {
    if (!operation.pi_payment_id) {
      if (recoveryScanSucceeded && operation.reservation_expires_at && operation.reservation_expires_at <= now()) {
        await transitionPayoutOperation(env, operation.operation_key, ['reserved', 'creating', 'reconciliation_required'], 'cancelled', { error: 'Stale payout operation expired without a recoverable Pi payment id', clearLease: true });
      } else {
        await markPayoutReconciliationRequired(env, operation, 'Stale payout operation has no payment id');
      }
      continue;
    }
    try { await resumePayoutOperation(env, operation); } catch (error) { await markPayoutReconciliationRequired(env, operation, error.message); }
  }
}

function userView(row, env, options = {}) {
  let meta = {};
  try { meta = row.metadata ? JSON.parse(row.metadata) : {}; } catch (_) {}
  const isAdmin = adminAllowed(row.pi_uid, env) || adminAllowed(row.username, env);
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
    role: isAdmin ? 'admin' : 'user',
    status: row.status || 'active',
    kycStatus: resolvedKycStatus,
    isOfficialSdk: true,
    joinedDate: row.created_at?.slice(0, 10) || '',
    lastLoginAt: meta.lastLoginAt || null,
    lastLogoutAt: meta.lastLogoutAt || null,
    loginCount: Number(meta.loginCount || 0),
    logoutCount: Number(meta.logoutCount || 0),
    isOnline: Boolean(meta.isOnline)
  };
  if (options.includeAdminReview === true) {
    view.adminKycStatus = ['verified', 'unverified', 'unknown'].includes(adminKycStatus) ? adminKycStatus : 'unknown';
  }
  return view;
}

function isOriginAllowed(origin, env) {
  if (!origin) return false;
  const configured = String(env?.CORS_ORIGIN || '').split(',').map((v) => v.trim()).filter(Boolean);
  if (configured.length === 0) return false;
  if (configured.includes('*')) return false;
  return configured.includes(origin);
}

function json(data, status = 200, request = null, env = null) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  const origin = request?.headers?.get('Origin');  if (origin && isOriginAllowed(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
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
function payoutIdempotencyKey(request, body) {
  const key =
    request.headers.get('Idempotency-Key') ||
    request.headers.get('X-Idempotency-Key') ||
    body?.idempotencyKey;

  return key ? String(key).trim().slice(0, 200) : null;
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
  const metaIntentId = meta?.paymentIntentId || meta?.intentId || meta?.id;  if (!metaIntentId || String(metaIntentId) !== String(intent.id)) {
    throw Object.assign(new Error('Pi payment metadata binding is missing or invalid'), { status: 409 });
  }
  if (meta?.rentalId && String(meta.rentalId) !== String(intent.rental_id)) {
    throw Object.assign(new Error('Pi payment rental binding mismatch'), { status: 409 });
  }

  const payerAmount = Math.round(Number(payment?.amount || 0) * 10000) / 10000;
  const expectedAmount = Math.round(Number(intent.amount || 0) * 10000) / 10000;
  if (Math.abs(payerAmount - expectedAmount) > 0.0001) {
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
    await env.RENTORA_DB.batch([
      env.RENTORA_DB.prepare("UPDATE payment_intents SET pi_payment_id=?1,status='approved',updated_at=?2 WHERE id=?3 AND status IN ('created','approved')").bind(body.paymentId, now(), intent.id),
      env.RENTORA_DB.prepare("UPDATE rentals SET status='payment_approved',updated_at=?1 WHERE id=?2 AND status IN ('pending_payment','payment_approved')").bind(now(), intent.rental_id)
    ]);
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
    return json({ error: 'paymentId, txid and paymentIntentId are required', traceId, stage: 'params_validation' }, 400, request, env);  }
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
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const paymentObj = body?.payment || {};
  const paymentId = String(body?.paymentId || paymentObj?.identifier || paymentObj?.id || '').trim();
  const paymentIntentId = String(body?.paymentIntentId || paymentObj?.metadata?.paymentIntentId || '').trim();

  if (!paymentId || !paymentIntentId) {
    return json({ handled: false, error: 'paymentId and paymentIntentId are required', traceId }, 400, request, env);
  }

  const intent = await env.RENTORA_DB.prepare(
    'SELECT * FROM payment_intents WHERE id=?1 AND user_id=?2 LIMIT 1'
  ).bind(paymentIntentId, user.id).first();

  if (!intent) {
    return json({ handled: false, error: 'Payment intent not found', traceId }, 404, request, env);
  }

  if (intent.status === 'completed') {
    return json({
      handled: true,
      status: 'completed',
      paymentId: intent.pi_payment_id || paymentId,
      txid: intent.pi_txid || undefined,
      idempotent: true,
      traceId
    }, 200, request, env);
  }

  if (intent.pi_payment_id && intent.pi_payment_id !== paymentId) {
    return json({ handled: false, error: 'Payment ID does not match intent', traceId }, 409, request, env);
  }

  try {
    const response = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}`);
    const payment = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json({ handled: false, error: 'Unable to verify Pi payment', traceId }, 502, request, env);
    }

    let status;
    try {
      status = validatePayment(payment, { ...intent, pi_payment_id: paymentId }, user);
    } catch (valErr) {
      return json({ handled: false, error: valErr.message, traceId }, valErr.status || 409, request, env);
    }

    if (status.cancelled || status.user_cancelled) {
      return json({ handled: false, error: 'Pi payment is cancelled', traceId }, 409, request, env);
    }

    let txid = String(payment?.transaction?.txid || '').trim();

    if (!status.developer_completed && status.developer_approved && payment?.status?.transaction_verified && txid) {
      const compRes = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}/complete`, {
        method: 'POST',
        body: JSON.stringify({ txid })
      });
      const compData = await compRes.json().catch(() => ({}));
      if (!compRes.ok && !compData?.status?.developer_completed) {
        return json({ handled: false, error: piErrorMessage(compData, 'Pi payment completion failed'), traceId }, 502, request, env);
      }
      const refreshed = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}`);
      const refreshedPayment = await refreshed.json().catch(() => ({}));
      if (!refreshed.ok) {
        return json({ handled: false, error: 'Unable to re-verify Pi payment completion', traceId }, 502, request, env);
      }
      try {
        status = validatePayment(refreshedPayment, { ...intent, pi_payment_id: paymentId }, user);
      } catch (valErr) {
        return json({ handled: false, error: valErr.message, traceId }, valErr.status || 409, request, env);
      }
      txid = String(refreshedPayment?.transaction?.txid || txid).trim();
      if (!status.developer_completed || !txid) {
        return json({ handled: true, status: 'pending', paymentId, traceId }, 202, request, env);
      }
    }

    if (status.developer_completed) {
      if (!txid) {
        return json({ handled: false, error: 'Pi payment is completed but has no verified transaction id; reconciliation is required.', traceId }, 409, request, env);
      }
      await env.RENTORA_DB.batch([
        env.RENTORA_DB.prepare("UPDATE payment_intents SET pi_payment_id=?1,pi_txid=?2,status='completed',updated_at=?3 WHERE id=?4 AND user_id=?5").bind(paymentId, txid, now(), intent.id, user.id),
        env.RENTORA_DB.prepare("UPDATE rentals SET payment_status='completed',status='confirmed',updated_at=?1 WHERE id=?2 AND renter_user_id=?3").bind(now(), intent.rental_id, user.id),
        env.RENTORA_DB.prepare("INSERT OR IGNORE INTO transactions(id,payment_intent_id,pi_payment_id,pi_txid,user_id,amount,type,status,created_at) VALUES(?1,?2,?3,?4,?5,?6,'platform_fee','completed',?7)").bind(`tx_${crypto.randomUUID()}`, intent.id, paymentId, txid, user.id, intent.amount, now())
      ]);
      return json({ handled: true, status: 'completed', paymentId, txid, traceId }, 200, request, env);
    }

    if (!status.developer_approved) {
      const appRes = await piFetch(env, `/payments/${encodeURIComponent(paymentId)}/approve`, {
        method: 'POST',
        body: '{}'
      });
      const appData = await appRes.json().catch(() => ({}));
      if (!appRes.ok && !(appRes.status === 400 && String(JSON.stringify(appData)).toLowerCase().includes('already'))) {
        return json({ handled: false, error: piErrorMessage(appData, 'Pi payment approval failed'), traceId }, 502, request, env);
      }
      return json({ handled: true, status: 'approved', paymentId, traceId }, 200, request, env);
    }

    return json({ handled: true, status: 'pending', paymentId, traceId }, 202, request, env);
  } catch (err) {
    console.error(`[Incomplete ${traceId}] error:`, err);
    return json({ handled: false, error: 'Payment recovery failed', traceId }, 500, request, env);
  }
}

async function enqueuePayoutReconciliation(env, payment, reason, metadata = {}) {
  const paymentId = payment?.identifier || payment?.id || null;
  if (!paymentId) return null;
  const operationKey = metadata.operationKey || metadata.payoutOperationKey || null;
  const payload = JSON.stringify({ payment, reason, metadata });
  await env.RENTORA_DB.prepare(`
    INSERT INTO payout_reconciliation_queue(id, pi_payment_id, operation_key, status, payload, created_at, updated_at)
    VALUES(?1, ?2, ?3, 'reconciliation_required', ?4, ?5, ?5)
    ON CONFLICT(pi_payment_id) DO UPDATE SET status='reconciliation_required', payload=?4, updated_at=?5
  `).bind(`recon_${crypto.randomUUID()}`, paymentId, operationKey, payload, now()).run();
  return paymentId;
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
      const metadata = parsePaymentMetadata(payment?.metadata);
      const operationKey = metadata?.operationKey || metadata?.payoutOperationKey;
      let operation = operationKey
        ? await getPayoutOperation(env, operationKey)
        : await env.RENTORA_DB.prepare('SELECT * FROM payout_operations WHERE pi_payment_id=?1 LIMIT 1').bind(pid).first();
      const isPayout = metadata?.type === 'admin_treasury_payout' || Boolean(operationKey) || Boolean(operation);
      if (!isPayout) continue;
      if (!operation) {
        await enqueuePayoutReconciliation(env, payment, 'Orphan payout payment has no matching payout operation', metadata);
        continue;
      }
      if (operation.pi_payment_id && operation.pi_payment_id !== pid) {
        await markPayoutReconciliationRequired(env, operation, 'Incomplete payment id conflicts with operation payment id');
        await enqueuePayoutReconciliation(env, payment, 'Payment id conflicts with payout operation', metadata);
        continue;
      }
      const paymentCandidate = await fetchPiPayment(env, pid);
      if (!paymentCandidate.response.ok) { await markPayoutReconciliationRequired(env, operation, 'Incomplete payment could not be fetched'); await enqueuePayoutReconciliation(env, payment, 'Incomplete payment GET failed', metadata); continue; }
      if (!operation.pi_payment_id) {
        if (operation.status === 'creating') {
          try {
            await validateA2UPayment(env, { ...operation, pi_payment_id: pid }, paymentCandidate.payment);
          } catch (error) {
            await markPayoutReconciliationRequired(env, operation, error.message || 'Incomplete payout payment failed validation before binding');
            await enqueuePayoutReconciliation(env, paymentCandidate.payment, error.message || 'Incomplete payout payment failed validation before binding', metadata);
            continue;
          }
          operation = await transitionPayoutOperation(env, operation.operation_key, ['creating'], 'pi_created', { piPaymentId: pid });
        } else if (operation.status !== 'pi_created' && operation.status !== 'approving' && operation.status !== 'approved' && operation.status !== 'completing') {
          await markPayoutReconciliationRequired(env, operation, 'Incomplete payment cannot be attached from current operation state');
          continue;
        }
      }
      const current = paymentCandidate;
      if (current.status.cancelled || current.status.user_cancelled) { await transitionPayoutOperation(env, operation.operation_key, PAYOUT_ACTIVE_STATES, 'cancelled', { error: 'Pi incomplete payment was cancelled' }); continue; }
      if (current.status.developer_completed) { await persistCompletedPayout(env, operation, pid, current.payment?.transaction?.txid, current.payment); continue; }
      try {
        await validateA2UPayment(env, operation, current.payment);
      } catch (error) {
        await markPayoutReconciliationRequired(env, operation, error.message || 'Pi A2U payment validation failed during recovery');
        await enqueuePayoutReconciliation(env, current.payment, error.message || 'Incomplete payout payment failed validation', metadata);
        continue;
      }
      if (current.status.developer_approved || current.status.transaction_verified) {
        if (operation.status === 'pi_created') operation = await transitionPayoutOperation(env, operation.operation_key, ['pi_created'], 'approving', { piPaymentId: pid });
        if (operation.status === 'approving') {
          const leased = await acquirePayoutLease(env, operation, ['approving']);
          if (!leased) continue;
          operation = leased;
          operation = await transitionPayoutOperation(env, operation.operation_key, ['approving'], 'approved', { piPaymentId: pid, txid: current.payment?.transaction?.txid || null, clearLease: true, leaseOwner: operation.lease_owner });
        }
        continue;
      }
      await markPayoutReconciliationRequired(env, operation, 'Incomplete payment has no safely actionable Pi state');
    }
  } catch (err) { console.warn('autoResolveIncompleteServerPayments warning:', err); return false; }
  return true;
}

async function createPayoutPayment(env, operation, leaseOwner, paymentPayload) {
  const requestedLeaseOwner = leaseOwner || operation.lease_owner;
  operation = await transitionPayoutOperation(env, operation.operation_key, ['reserved'], 'creating', { leaseOwner: requestedLeaseOwner });
  if (!operation || operation.status !== 'creating' || operation.lease_owner !== requestedLeaseOwner) {
    return operation;
  }
  operation = await renewPayoutLease(env, operation);
  if (!operation) return getPayoutOperation(env, operation?.operation_key);
  let piRes;
  let created;
  try {
    piRes = await piFetch(env, '/payments', { method: 'POST', body: JSON.stringify({ payment: paymentPayload }) });
    created = await piRes.json().catch(() => ({}));
  } catch (error) {
    return markPayoutReconciliationRequired(env, operation, error.message || 'Pi create request was ambiguous');
  }
  if (!piRes.ok || !created?.identifier) return transitionPayoutOperation(env, operation.operation_key, ['creating'], 'cancelled', { error: piErrorMessage(created, 'Pi payment creation was rejected') });
  const createdPaymentId = created.identifier || created.id;
  try {
    await validateA2UPayment(env, { ...operation, pi_payment_id: createdPaymentId }, created);
  } catch (error) {
    return markPayoutReconciliationRequired(env, operation, error.message || 'Created Pi A2U payment failed validation');
  }
  return transitionPayoutOperation(env, operation.operation_key, ['creating'], 'pi_created', { piPaymentId: createdPaymentId, leaseOwner: leaseOwner || operation.lease_owner, clearLease: true });
}

async function adminRoute(request, env, path) {
  const user = await requireUser(request, env);
  if (!(adminAllowed(user.pi_uid, env) || adminAllowed(user.username, env))) return json({ error: 'Admin access required' }, 403, request, env);
  if (path === '/api/admin/users') {
    const rows = await env.RENTORA_DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    return json({ success: true, users: (rows.results || []).map((row) => userView(row, env)) }, 200, request, env);
  }
  if (path === '/api/admin/overview') {
    const [usersCount, listingsCount, rentalsCount, transactionsCount, revRow, payoutRow, reportsCount, usersMetaRows] = await Promise.all([
      env.RENTORA_DB.prepare('SELECT COUNT(*) AS c FROM users').first(),
      env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM listings WHERE status != 'deleted'").first(),      env.RENTORA_DB.prepare('SELECT COUNT(*) AS c FROM rentals').first(),
      env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM transactions WHERE status='completed' AND (type='platform_fee' OR type IS NULL)").first(),
      env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND (type='platform_fee' OR type IS NULL)").first(),
      env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND type='admin_payout'").first(),
      env.RENTORA_DB.prepare("SELECT COUNT(*) AS c FROM reports WHERE status='open'").first().catch(() => ({ c: 0 })),
      env.RENTORA_DB.prepare("SELECT metadata FROM users").all().catch(() => ({ results: [] }))
    ]);
    let totalLogins = 0;
    let totalLogouts = 0;
    let onlineUsers = 0;
    for (const u of (usersMetaRows?.results || [])) {
      let m = {};
      try { m = u.metadata ? JSON.parse(u.metadata) : {}; } catch (_) {}
      totalLogins += Number(m.loginCount || 0);
      totalLogouts += Number(m.logoutCount || 0);
      if (m.isOnline) onlineUsers++;
    }
    const totalRev = Number(revRow?.total || 0);
    const totalPayouts = Number(payoutRow?.total || 0);
    const availableBalance = Math.max(0, totalRev - totalPayouts);
    let auditLogs = [];
    if (env?.RENTORA_KV && typeof env.RENTORA_KV.get === 'function') {
      try {
        auditLogs = await env.RENTORA_KV.get('rentora_admin_audit_logs', 'json') || [];
      } catch (_) {}
    }
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
        openReports: Number(reportsCount?.c || 0),
        totalLogins,
        totalLogouts,
        onlineUsers,
        auditLogs: Array.isArray(auditLogs) ? auditLogs.slice(0, 20) : []
      }
    }, 200, request, env);
  }
  if (path === '/api/admin/cleanup' && request.method === 'POST') {
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

    return json({
      success: true,
      cleaned: {
        staleRentalsCancelled: staleRentalsCount,
        staleIntentsCancelled: staleIntentsCount
      },
      auditLog: audit
    }, 200, request, env);
  }
  if (path === '/api/admin/payout' && request.method === 'POST') {
    await reconcileStalePayoutOperations(env);
    const body = await readJson(request);
    const [revRow, payoutRow] = await Promise.all([
      env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND (type='platform_fee' OR type IS NULL)").first(),
      env.RENTORA_DB.prepare("SELECT SUM(amount) AS total FROM transactions WHERE status='completed' AND type='admin_payout'").first()
    ]);
    const availableBalance = Math.max(0, Number(revRow?.total || 0) - Number(payoutRow?.total || 0));
    let requestedAmount = Number(body?.amount || 0);
    if (!requestedAmount || Number.isNaN(requestedAmount) || requestedAmount <= 0) requestedAmount = availableBalance;
    const amount = Number(requestedAmount.toFixed(4));
    if (amount <= 0 || amount > availableBalance) return json({ error: `مبلغ درخواستی (${amount} π) از موجودی واقعی کارمزدها (${availableBalance.toFixed(4)} π) بیشتر است.` }, 400, request, env);
    if (String(body?.walletAddress || '').trim()) return json({ error: 'آدرس کیف پول مستقیم قابل تعیین نیست؛ A2U فقط به کیف پول فعلی کاربر احراز‌شده از طریق Pi UID پرداخت می‌کند.' }, 400, request, env);
    const operationKey = payoutIdempotencyKey(request, body);
    if (!operationKey) return json({ error: 'Idempotency-Key برای پرداخت الزامی است.' }, 400, request, env);
    let claim = await claimPayoutOperation(env, operationKey, { amount, userId: user.id, recipient: user.username, leaseOwner: request.headers.get('X-Payout-Lease-Owner') || body?.leaseOwner || null });
    if (!claim.operation) return json({ error: 'موجودی treasury برای reservation کافی نیست.' }, 409, request, env);
    if (!claim.created) {
      if (Number(claim.operation.amount) !== amount || claim.operation.user_id !== user.id) return json({ error: 'کلید idempotency قبلاً برای درخواست دیگری استفاده شده است.' }, 409, request, env);
      if (claim.operation.status === 'completed' || claim.operation.status === 'cancelled' || claim.operation.status === 'reconciliation_required') return payoutOperationResponse(claim.operation, request, env);
      if (claim.operation.status === 'creating' && (!claim.operation.lease_expires_at || claim.operation.lease_expires_at <= now())) {
        await autoResolveIncompleteServerPayments(env, user);
        claim.operation = await getPayoutOperation(env, operationKey);
      }
      const resumed = await resumePayoutOperation(env, claim.operation);
      return payoutOperationResponse(resumed, request, env);
    }
    let operation = claim.operation;
    try {      await autoResolveIncompleteServerPayments(env, user);
      operation = await transitionPayoutOperation(env, operationKey, ['reserved'], 'creating', { leaseOwner: claim.leaseOwner || operation.lease_owner });
      const paymentPayload = {
        amount,
        memo: String(body?.memo || `Rentora Treasury Payout to @${user.username}`).slice(0, 120),
        metadata: { type: 'admin_treasury_payout', operationKey, adminUid: user.pi_uid, adminUsername: user.username, requestedAt: now() },
        uid: user.pi_uid
      };
      operation = await createPayoutPayment(env, operation, claim.leaseOwner || operation.lease_owner, paymentPayload);
      operation = await resumePayoutOperation(env, operation);
      if (operation?.status === 'completed') {
        await recordAdminAuditLog(env, user, 'PAYOUT_COMPLETED', { amount, paymentId: operation.pi_payment_id, txid: operation.txid, recipient: user.username, operationKey });
      }
      return payoutOperationResponse(operation, request, env);
    } catch (err) {
      operation = await markPayoutReconciliationRequired(env, operation, err.message || 'payout requires reconciliation');
      return payoutOperationResponse(operation, request, env, { error: err.message || 'payout requires reconciliation' });
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
        if (origin && isOriginAllowed(origin, env)) {
          headers['Access-Control-Allow-Origin'] = origin;
        }
        return new Response(null, { status: 204, headers });
      }
      if (request.method === 'GET' && path === '/validation-key.txt') {
        return new Response('d8b5b506fc41746eb0aba3ff56bcb32ed03dd33bf0348a3af22893ba437b437544a2c160e3ba460b7986e1994fa19964a4beabd3ae98620da1f8b90dece4f7b8\n', {
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }
        });
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
      if ((request.method === 'GET' && (path === '/api/admin/overview' || path === '/api/admin/users')) || (request.method === 'POST' && (path === '/api/admin/payout' || path === '/api/admin/cleanup'))) return await adminRoute(request, env, path);
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
  }};

export const __payoutTestHooks = {
  claimPayoutOperation,
  createPayoutPayment,
  transitionPayoutOperation,
  resumePayoutOperation,
  persistCompletedPayout,
  reconcileStalePayoutOperations,
  autoResolveIncompleteServerPayments,
  PAYOUT_TRANSITIONS
};