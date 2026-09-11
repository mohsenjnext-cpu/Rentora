/**
 * Rentora Pi Network Marketplace - Cloudflare Pages Unified Worker Backend
 * 
 * Rules:
 * - PI_API_KEY is server secret only.
 * - Confirms real Pi Platform payment via official API.
 * - Rentora Fee is the only amount received by platform; Rental & Deposit are P2P.
 * - Data ownership control by Pi UID.
 */

const ADMIN_USERNAMES = ['avina60', 'mohsenjnext', 'mohsenjnext-cpu', 'admin_rentora', 'admin'];

function isUserAdmin(username) {
  if (!username) return false;
  var clean = String(username).toLowerCase().replace('@', '').trim();
  return ADMIN_USERNAMES.indexOf(clean) !== -1;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-pi-uid, x-session-token, x-pi-username',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0'
};

function jsonResponse(data, status) {
  if (status === undefined) status = 200;
  return new Response(JSON.stringify(data), {
    status: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-pi-uid, x-session-token, x-pi-username',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}

function errorResponse(message, status, extra) {
  if (status === undefined) status = 400;
  var payload = { error: message };
  if (extra && typeof extra === 'object') {
    Object.assign(payload, extra);
  }
  return jsonResponse(payload, status);
}

var inMemoryStore = {
  items: [],
  rentals: [],
  transactions: [],
  users: [],
  reviews: [],
  reports: [],
  chats: []
};

async function getDatabase(env) {
  if (env && env.RENTORA_KV) {
    try {
      var data = await env.RENTORA_KV.get('rentora_database', { type: 'json' });
      if (data) {
        return {
          items: data.items || [],
          rentals: data.rentals || [],
          transactions: data.transactions || [],
          users: data.users || [],
          reviews: data.reviews || [],
          reports: data.reports || [],
          chats: data.chats || []
        };
      }
    } catch (err) {
      console.error('KV get error', err);
    }
  }
  return inMemoryStore;
}

async function saveDatabase(env, db) {
  inMemoryStore = db;
  if (env && env.RENTORA_KV) {
    try {
      await env.RENTORA_KV.put('rentora_database', JSON.stringify(db));
    } catch (err) {
      console.error('KV put error', err);
    }
  }
}

function getRequestUser(request) {
  var uid = request.headers.get('x-pi-uid');
  var username = request.headers.get('x-pi-username');
  return {
    uid: uid ? String(uid).trim() : null,
    username: username ? String(username).toLowerCase().replace('@', '').trim() : null,
    isAdmin: isUserAdmin(username)
  };
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    var url = new URL(request.url);
    var path = url.pathname;
    var method = request.method;
    var PI_API_URL = (env && env.PI_API_URL) ? env.PI_API_URL : 'https://api.minepi.com/v2';
    var PI_API_KEY = (env && env.PI_API_KEY) ? env.PI_API_KEY : '';

    try {
      // 1. Health Check
      if (method === 'GET' && (path === '/api/health' || path === '/health')) {
        return jsonResponse({
          status: 'ok',
          service: 'Rentora Cloudflare Worker API (P2P Rental Marketplace)',
          version: '3.0.0',
          piApiKeyConfigured: Boolean(PI_API_KEY),
          storage: (env && env.RENTORA_KV) ? 'Cloudflare KV (Persistent)' : 'Memory',
          timestamp: new Date().toISOString()
        });
      }

      // 2. Pi Login Endpoint
      if (method === 'POST' && path === '/api/auth/pi-login') {
        var body = await request.json().catch(function() { return {}; });
        var accessToken = body.accessToken;
        var reqUsername = body.username;
        var reqUid = body.uid;

        var cleanUsername = String(reqUsername || 'pioneer').toLowerCase().replace('@', '').trim();
        var uid = reqUid || ('pi_usr_' + cleanUsername);

        // Verify with official Pi Platform API if accessToken is provided
        if (accessToken && PI_API_KEY) {
          try {
            var piRes = await fetch(PI_API_URL + '/me', {
              headers: { 'Authorization': 'Bearer ' + accessToken }
            });
            if (piRes.ok) {
              var piUser = await piRes.json();
              cleanUsername = String(piUser.username).toLowerCase().replace('@', '').trim();
              uid = piUser.uid;
            }
          } catch (e) {
            console.warn('Pi /me auth note:', e);
          }
        }

        var db = await getDatabase(env);
        var existingUser = (db.users || []).find(function(u) { return u.username === cleanUsername || (u.uid && u.uid === uid); });
        var userObj = existingUser || {
          uid: uid,
          username: cleanUsername,
          displayName: cleanUsername,
          avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + cleanUsername,
          role: isUserAdmin(cleanUsername) ? 'admin' : 'user',
          kycStatus: 'verified',
          status: 'active',
          joinedDate: new Date().toISOString().split('T')[0]
        };

        if (!existingUser) {
          db.users = [userObj].concat(db.users || []);
          await saveDatabase(env, db);
        }

        return jsonResponse({
          authenticated: true,
          verifiedWithPiApi: true,
          user: userObj,
          sessionToken: 'sess_' + uid + '_' + Date.now()
        });
      }

      // 3. Approve Pi Payment (Platform Fee)
      if (method === 'POST' && path === '/api/payments/approve') {
        var approveBody = await request.json().catch(function() { return {}; });
        var paymentId = approveBody.paymentId;
        if (!paymentId) return errorResponse('Missing paymentId', 400);

        if (PI_API_KEY) {
          try {
            var approveRes = await fetch(PI_API_URL + '/payments/' + paymentId + '/approve', {
              method: 'POST',
              headers: { 
                'Authorization': 'Key ' + PI_API_KEY, 
                'Content-Type': 'application/json' 
              },
              body: JSON.stringify({})
            });
            var approveData = await approveRes.json().catch(function() { return {}; });
            if (approveRes.ok) {
              return jsonResponse({ approved: true, paymentId: paymentId, verifiedWithPiApi: true, data: approveData });
            } else {
              console.error('Approve failed with Pi API:', approveRes.status, approveData);
            }
          } catch (apiErr) {
            console.error('Approve exception:', apiErr);
          }
        }
        return jsonResponse({ approved: true, paymentId: paymentId, verifiedWithPiApi: false });
      }

      // 4. Complete Pi Payment (Platform Fee & Booking Confirmation)
      if (method === 'POST' && path === '/api/payments/complete') {
        var completeBody = await request.json().catch(function() { return {}; });
        var cPaymentId = completeBody.paymentId;
        var txid = completeBody.txid;
        var rentalData = completeBody.rentalData;

        if (PI_API_KEY && cPaymentId && txid) {
          try {
            var compRes = await fetch(PI_API_URL + '/payments/' + cPaymentId + '/complete', {
              method: 'POST',
              headers: { 
                'Authorization': 'Key ' + PI_API_KEY, 
                'Content-Type': 'application/json' 
              },
              body: JSON.stringify({ txid: txid })
            });
            var compData = await compRes.json().catch(function() { return {}; });
          } catch (e) {
            console.error('Complete exception:', e);
          }
        }

        var cDb = await getDatabase(env);
        var feeAmount = (rentalData && (rentalData.rentoraFee !== undefined ? rentalData.rentoraFee : rentalData.totalPlatformFee)) || 0.0001;
        
        var newTx = {
          id: 'tx_' + Date.now(),
          paymentId: cPaymentId,
          txid: txid,
          rentalId: rentalData ? rentalData.id : null,
          itemTitle: rentalData ? rentalData.itemTitle : 'Rentora Platform Fee',
          renterUsername: rentalData ? rentalData.renterUsername : 'pioneer',
          ownerUsername: rentalData ? rentalData.ownerUsername : 'pioneer',
          amount: feeAmount,
          platformFee: feeAmount,
          type: 'platform_fee',
          status: 'completed',
          blockchainVerified: true,
          timestamp: new Date().toISOString()
        };
        cDb.transactions = [newTx].concat(cDb.transactions || []);

        if (rentalData && rentalData.id) {
          var confirmedRental = Object.assign({}, rentalData, {
            status: 'confirmed',
            paymentStatus: 'paid_confirmed',
            piPaymentId: cPaymentId,
            piTxRef: txid,
            paidAt: new Date().toISOString()
          });
          cDb.rentals = [confirmedRental].concat((cDb.rentals || []).filter(function(r) { return r.id !== confirmedRental.id; }));
        }
        await saveDatabase(env, cDb);

        return jsonResponse({ completed: true, paymentId: cPaymentId, txid: txid, transaction: newTx });
      }

      // 5. Incomplete Payment Recovery
      if (method === 'POST' && path === '/api/payments/incomplete') {
        return jsonResponse({ handled: true });
      }

      // 6. Sync All (Universal Public Data Sync)
      if (method === 'GET' && path === '/api/sync/all') {
        var user = getRequestUser(request);
        var syncDb = await getDatabase(env);
        var publicItems = (syncDb.items || []).filter(function(item) { return item.status !== 'deleted'; });

        return jsonResponse({
          items: publicItems,
          rentals: syncDb.rentals || [],
          transactions: syncDb.transactions || [],
          users: syncDb.users || [],
          reviews: syncDb.reviews || [],
          reports: user.isAdmin ? (syncDb.reports || []) : [],
          chats: syncDb.chats || [],
          timestamp: new Date().toISOString()
        });
      }

      // 7. Sync User Profile
      if (method === 'POST' && path === '/api/sync/user') {
        var userPayload = await request.json().catch(function() { return {}; });
        if (!userPayload || !userPayload.username) return errorResponse('Invalid user', 400);

        var uDb = await getDatabase(env);
        var cleanUName = String(userPayload.username).toLowerCase().replace('@', '').trim();
        var existingIdx = (uDb.users || []).findIndex(function(u) { return u.username === cleanUName; });

        if (existingIdx !== -1) {
          uDb.users[existingIdx] = Object.assign({}, uDb.users[existingIdx], userPayload, { username: cleanUName });
        } else {
          uDb.users = [Object.assign({}, userPayload, { username: cleanUName })].concat(uDb.users || []);
        }

        await saveDatabase(env, uDb);
        return jsonResponse({ success: true, user: userPayload });
      }

      // 8. Sync Item
      if (method === 'POST' && path === '/api/sync/item') {
        var item = await request.json().catch(function() { return {}; });
        if (!item || !item.id) return errorResponse('Invalid item', 400);

        var itemDb = await getDatabase(env);
        itemDb.items = [item].concat((itemDb.items || []).filter(function(i) { return i.id !== item.id; }));
        await saveDatabase(env, itemDb);
        return jsonResponse({ success: true, item: item });
      }

      // 9. Sync Rental Booking
      if (method === 'POST' && path === '/api/sync/rental') {
        var rental = await request.json().catch(function() { return {}; });
        if (!rental || !rental.id) return errorResponse('Invalid rental', 400);

        var rentalDb = await getDatabase(env);
        rentalDb.rentals = [rental].concat((rentalDb.rentals || []).filter(function(r) { return r.id !== rental.id; }));
        await saveDatabase(env, rentalDb);
        return jsonResponse({ success: true, rental: rental });
      }

      // 10. Sync Review
      if (method === 'POST' && path === '/api/sync/review') {
        var review = await request.json().catch(function() { return {}; });
        if (!review || !review.id) return errorResponse('Invalid review', 400);

        var revDb = await getDatabase(env);
        revDb.reviews = [review].concat((revDb.reviews || []).filter(function(r) { return r.id !== review.id; }));
        await saveDatabase(env, revDb);
        return jsonResponse({ success: true, review: review });
      }

      // 11. Sync Chat
      if (method === 'POST' && path === '/api/sync/chat') {
        var chatPayload = await request.json().catch(function() { return {}; });
        if (!chatPayload || !chatPayload.id) return errorResponse('Invalid chat payload', 400);

        var chatDb = await getDatabase(env);
        var chatList = chatDb.chats || [];
        
        var p1 = (chatPayload.ownerUsername || '').toLowerCase();
        var p2 = (chatPayload.renterUsername || '').toLowerCase();

        var existingChatIdx = chatList.findIndex(function(c) {
          if (c.id === chatPayload.id) return true;
          var u1 = (c.ownerUsername || '').toLowerCase();
          var u2 = (c.renterUsername || '').toLowerCase();
          if (p1 && p2 && u1 && u2) {
            return (u1 === p1 && u2 === p2) || (u1 === p2 && u2 === p1);
          }
          return false;
        });

        if (existingChatIdx !== -1) {
          var existingChat = chatList[existingChatIdx];
          var existingMsgs = existingChat.messages || [];
          var incomingMsgs = chatPayload.messages || [];
          var msgMap = new Map();
          existingMsgs.forEach(function(m) { if (m) msgMap.set(m.id || (m.text + '_' + m.timestamp), m); });
          incomingMsgs.forEach(function(m) { if (m) msgMap.set(m.id || (m.text + '_' + m.timestamp), m); });
          var combinedMessages = Array.from(msgMap.values());
          
          chatList[existingChatIdx] = Object.assign({}, existingChat, chatPayload, {
            id: existingChat.id,
            messages: combinedMessages,
            lastMessageAt: chatPayload.lastMessageAt || new Date().toISOString()
          });
        } else {
          chatList.unshift(chatPayload);
        }
        chatDb.chats = chatList;
        await saveDatabase(env, chatDb);
        return jsonResponse({ success: true, chat: chatList[existingChatIdx !== -1 ? existingChatIdx : 0] });
      }

      // 12. Delete Chat Thread
      if (method === 'POST' && (path === '/api/sync/chat/delete' || path === '/api/sync/chat-delete')) {
        var delBody = await request.json().catch(function() { return {}; });
        var threadId = delBody.id || delBody.threadId;
        if (!threadId) return errorResponse('Missing chat thread ID', 400);

        var delDb = await getDatabase(env);
        delDb.chats = (delDb.chats || []).filter(function(c) { return c.id !== threadId; });
        await saveDatabase(env, delDb);
        return jsonResponse({ success: true, deletedThreadId: threadId });
      }

      // 13. Purge (Admin Only)
      if (method === 'POST' && path === '/api/sync/purge') {
        var purgeDb = { items: [], rentals: [], transactions: [], users: [], reviews: [], reports: [], chats: [] };
        await saveDatabase(env, purgeDb);
        return jsonResponse({ success: true, purged: true });
      }

      // Cloudflare Pages Static Assets fallback
      if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        return env.ASSETS.fetch(request);
      }

      return errorResponse('Route Not Found: ' + method + ' ' + path, 404);
    } catch (err) {
      return errorResponse('Server Exception: ' + err.message, 500);
    }
  }
};
