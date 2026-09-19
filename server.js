import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable CORS for frontend running on GitHub Pages or custom domains
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-pi-uid', 'x-session-token', 'x-pi-username']
}));
app.use(express.json({ limit: '10mb' }));

const PI_API_URL = process.env.PI_API_URL || 'https://api.minepi.com/v2';
const PI_API_KEY = process.env.PI_API_KEY || '';
const NODE_ENV = process.env.NODE_ENV || 'production';

console.log('=====================================================');
console.log('  RENTORA P2P MARKETPLACE - PI MAINNET BACKEND       ');
console.log('  Mode: STRICT ZERO-MOCK PRODUCTION                  ');
console.log('=====================================================');

if (!PI_API_KEY) {
  console.warn('⚠️  [SECURITY] PI_API_KEY is not configured in environment variables.');
  console.warn('⚠️  Pi Payment approval and completion will be rejected until PI_API_KEY is provided.');
} else {
  console.log('🔒 [SECURITY] Server API Key loaded. Official Pi Platform integration active.');
}

// Master Admin Pi Usernames
const ADMIN_USERNAMES = ['avina60', 'mohsenjnext', 'mohsenjnext-cpu', 'admin_rentora', 'admin'];
const isUserAdmin = (username) => {
  if (!username) return false;
  return ADMIN_USERNAMES.includes(String(username).toLowerCase().replace('@', '').trim());
};

// Data Persistence Store
const DB_FILE = path.join(__dirname, 'rentora_database.json');

function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('[DB Read Error]', err.message);
  }
  return { items: [], rentals: [], transactions: [] };
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB Write Error]', err.message);
  }
}

function getRequestUser(req) {
  const uid = req.headers['x-pi-uid'];
  const username = req.headers['x-pi-username'];
  const authHeader = req.headers['authorization'];
  
  return {
    uid: uid ? String(uid).trim() : null,
    username: username ? String(username).toLowerCase().replace('@', '').trim() : null,
    accessToken: authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null,
    isAdmin: isUserAdmin(username)
  };
}

// -------------------------------------------------------------
// 1. Strict Pi Network Authentication Endpoint
// Verifies user accessToken directly with Pi Platform: GET https://api.minepi.com/v2/me
// ZERO MOCK: Fails with 401 if Pi Platform does not verify the token
// -------------------------------------------------------------
app.post('/api/auth/pi-login', async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ 
        error: "Missing required accessToken from Pi Network SDK" 
      });
    }

    // Direct Verification with official Pi Core Team servers
    let piUser = null;
    try {
      const piRes = await fetch(`${PI_API_URL}/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (piRes.ok) {
        piUser = await piRes.json();
      } else {
        const errDetails = await piRes.text();
        console.warn(`[Pi Auth Rejected] Pi Platform returned status ${piRes.status}:`, errDetails);
        return res.status(401).json({ 
          error: "Unauthorized: Access token rejected by Pi Network Platform",
          piStatus: piRes.status
        });
      }
    } catch (fetchErr) {
      console.error('[Pi Auth Network Error]', fetchErr.message);
      return res.status(502).json({ 
        error: "Bad Gateway: Could not reach Pi Network Core Team authentication servers" 
      });
    }

    if (!piUser || !piUser.uid || !piUser.username) {
      return res.status(401).json({ 
        error: "Unauthorized: Invalid user payload returned by Pi Network Platform" 
      });
    }

    const cleanUsername = String(piUser.username).toLowerCase().replace('@', '').trim();
    console.log(`[Pi Auth Verified] Pioneer @${cleanUsername} (UID: ${piUser.uid}) authenticated successfully.`);

    return res.json({
      authenticated: true,
      verifiedWithPiApi: true,
      user: {
        uid: piUser.uid,
        username: cleanUsername,
        displayName: cleanUsername,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
        role: isUserAdmin(cleanUsername) ? 'admin' : 'user',
        kycVerified: true,
        authMethod: 'pi_network_sdk_v2'
      },
      sessionToken: 'sess_' + Buffer.from(`${piUser.uid}:${Date.now()}`).toString('base64')
    });
  } catch (err) {
    console.error('[Pi Auth Server Error]', err);
    res.status(500).json({ error: "Internal authentication error" });
  }
});

// -------------------------------------------------------------
// 2. Strict Pi Payment Server Approval Endpoint
// STRICT: Calls POST https://api.minepi.com/v2/payments/{paymentId}/approve
// Uses Server API Key: Authorization: Key <PI_API_KEY>
// ZERO MOCK: Rejects if PI_API_KEY is missing or Pi API returns non-200
// -------------------------------------------------------------
app.post('/api/payments/approve', async (req, res) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: "Missing required paymentId parameter" });
    }

    if (!PI_API_KEY) {
      console.error(`[Pi Payment Approval FAILED] Cannot approve payment ${paymentId} because PI_API_KEY is not configured.`);
      return res.status(503).json({ 
        error: "Server payment gateway not configured. Please set PI_API_KEY in server environment." 
      });
    }

    console.log(`[Pi Payment Approval] Requesting approval from Pi Core Team API for paymentId: ${paymentId}`);

    const approveRes = await fetch(`${PI_API_URL}/payments/${paymentId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${PI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await approveRes.json();

    if (approveRes.ok) {
      console.log(`[Pi Payment Approval] SUCCESS: Payment ${paymentId} approved by Pi Platform.`);
      return res.json({ 
        approved: true, 
        paymentId, 
        verifiedWithPiApi: true,
        data 
      });
    } else {
      console.error(`[Pi Payment Approval REJECTED] Pi Platform returned HTTP ${approveRes.status}:`, data);
      return res.status(approveRes.status).json({ 
        error: data.error || data.message || "Payment approval rejected by Pi Network Platform" 
      });
    }
  } catch (err) {
    console.error('[Pi Payment Approval Network Exception]', err);
    res.status(500).json({ error: "Network error connecting to Pi Network Platform" });
  }
});

// -------------------------------------------------------------
// 3. Strict Pi Payment Server Completion Endpoint
// STRICT: Calls POST https://api.minepi.com/v2/payments/{paymentId}/complete
// Uses Server API Key: Authorization: Key <PI_API_KEY> with body { txid }
// GATED: Database record created ONLY AFTER Pi Platform returns 200 OK
// ZERO MOCK: Rejects if PI_API_KEY is missing or Pi API returns non-200
// -------------------------------------------------------------
app.post('/api/payments/complete', async (req, res) => {
  try {
    const { paymentId, txid, rentalData } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: "Missing required paymentId parameter" });
    }

    if (!txid) {
      return res.status(400).json({ error: "Missing required blockchain txid parameter" });
    }

    if (!PI_API_KEY) {
      console.error(`[Pi Payment Completion FAILED] Cannot complete payment ${paymentId} because PI_API_KEY is not configured.`);
      return res.status(503).json({ 
        error: "Server payment gateway not configured. Please set PI_API_KEY in server environment." 
      });
    }

    console.log(`[Pi Payment Completion] Submitting completion to Pi Platform: paymentId=${paymentId}, txid=${txid}`);

    const completeRes = await fetch(`${PI_API_URL}/payments/${paymentId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${PI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ txid })
    });

    const data = await completeRes.json();

    if (!completeRes.ok) {
      console.error(`[Pi Payment Completion REJECTED] Pi Platform returned HTTP ${completeRes.status}:`, data);
      return res.status(completeRes.status).json({ 
        error: data.error || data.message || "Payment completion rejected by Pi Network Platform" 
      });
    }

    console.log(`[Pi Payment Completion] SUCCESS: Payment ${paymentId} completed on Pi Mainnet!`);

    // Persist verified rental and transaction
    const db = readDb();

    const newTx = {
      id: "tx_" + Date.now(),
      paymentId,
      txid,
      amount: rentalData?.totalPlatformFee || (data?.amount ? parseFloat(data.amount) : 0.1),
      itemTitle: rentalData?.itemTitle || 'Rental Booking',
      renterUsername: rentalData?.renterUsername || 'pioneer',
      ownerUsername: rentalData?.ownerUsername || 'pioneer',
      status: 'completed',
      blockchainVerified: true,
      timestamp: new Date().toISOString()
    };

    db.transactions = [newTx, ...(db.transactions || [])];

    let confirmedRental = null;
    if (rentalData && rentalData.itemId) {
      confirmedRental = {
        ...rentalData,
        status: 'confirmed',
        paymentStatus: 'paid_confirmed',
        paymentId,
        txid,
        paidAt: new Date().toISOString()
      };
      db.rentals = [confirmedRental, ...(db.rentals || []).filter(r => r.id !== confirmedRental.id)];
    }

    writeDb(db);

    return res.json({
      completed: true,
      paymentId,
      txid,
      verifiedWithPiApi: true,
      transaction: newTx,
      rental: confirmedRental
    });
  } catch (err) {
    console.error('[Pi Payment Completion Network Exception]', err);
    res.status(500).json({ error: "Network error completing payment with Pi Network Platform" });
  }
});

// -------------------------------------------------------------
// 4. Strict Incomplete Payment Handler
// Communicates directly with Pi Platform
// -------------------------------------------------------------
app.post('/api/payments/incomplete', async (req, res) => {
  try {
    const { payment } = req.body;
    if (!payment || !payment.identifier) {
      return res.status(400).json({ error: "Missing payment payload" });
    }

    if (!PI_API_KEY) {
      return res.status(503).json({ error: "PI_API_KEY not configured" });
    }

    const paymentId = payment.identifier;
    const txid = payment.transaction?.txid;

    const statusRes = await fetch(`${PI_API_URL}/payments/${paymentId}`, {
      method: 'GET',
      headers: { 'Authorization': `Key ${PI_API_KEY}` }
    });

    if (statusRes.ok) {
      const piPayment = await statusRes.json();
      console.log(`[Pi Incomplete Recovery] Payment ${paymentId} status on Pi Platform:`, piPayment.status);

      if (piPayment.status?.developer_approved && !piPayment.status?.developer_completed && txid) {
        const compRes = await fetch(`${PI_API_URL}/payments/${paymentId}/complete`, {
          method: 'POST',
          headers: { 'Authorization': `Key ${PI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ txid })
        });
        return res.json({ handled: true, action: 'completed', ok: compRes.ok });
      }
    }

    return res.json({ handled: true, status: 'acknowledged' });
  } catch (err) {
    console.error('[Incomplete Payment Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. Secure Sync & Privacy Endpoints
// -------------------------------------------------------------
app.get('/api/sync/all', (req, res) => {
  try {
    const user = getRequestUser(req);
    const db = readDb();

    const publicItems = (db.items || []).filter(item => item.status !== 'deleted');

    let authorizedRentals = [];
    if (user.isAdmin) {
      authorizedRentals = db.rentals || [];
    } else if (user.uid || user.username) {
      authorizedRentals = (db.rentals || []).filter(r => 
        (user.uid && (r.renterUid === user.uid || r.ownerUid === user.uid)) ||
        (user.username && (
          String(r.renterUsername).toLowerCase() === user.username || 
          String(r.ownerUsername).toLowerCase() === user.username
        ))
      );
    }

    let authorizedTransactions = [];
    if (user.isAdmin) {
      authorizedTransactions = db.transactions || [];
    } else if (user.uid || user.username) {
      authorizedTransactions = (db.transactions || []).filter(t => 
        (user.uid && (t.renterUid === user.uid || t.ownerUid === user.uid)) ||
        (user.username && (
          String(t.renterUsername).toLowerCase() === user.username || 
          String(t.ownerUsername).toLowerCase() === user.username
        ))
      );
    }

    return res.json({
      items: publicItems,
      rentals: authorizedRentals,
      transactions: authorizedTransactions,
      authenticatedAs: user.username || 'guest',
      isAdmin: user.isAdmin,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Sync All Error]', err);
    res.status(500).json({ error: "Failed to sync marketplace data" });
  }
});

app.post('/api/sync/item', (req, res) => {
  try {
    const user = getRequestUser(req);
    const item = req.body;

    if (!item || !item.id || !item.title) {
      return res.status(400).json({ error: "Invalid item payload" });
    }

    if (!user.uid && !user.username) {
      return res.status(401).json({ error: "Authentication required to publish item" });
    }

    const db = readDb();
    const existing = db.items.find(i => i.id === item.id);

    if (existing && !user.isAdmin) {
      const isOwner = (user.uid && existing.ownerUid === user.uid) || 
                      (user.username && existing.ownerUsername?.toLowerCase() === user.username);
      if (!isOwner) {
        return res.status(403).json({ error: "Forbidden: You are not the owner of this item" });
      }
    }

    db.items = [item, ...(db.items || []).filter(i => i.id !== item.id)];
    writeDb(db);

    return res.json({ success: true, item });
  } catch (err) {
    console.error('[Sync Item Error]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync/rental', (req, res) => {
  try {
    const user = getRequestUser(req);
    const rental = req.body;

    if (!rental || !rental.id) {
      return res.status(400).json({ error: "Invalid rental payload" });
    }

    if (!user.uid && !user.username) {
      return res.status(401).json({ error: "Authentication required to update rental" });
    }

    const db = readDb();
    const existing = db.rentals.find(r => r.id === rental.id);

    if (existing && !user.isAdmin) {
      const isParticipant = 
        (user.uid && (existing.renterUid === user.uid || existing.ownerUid === user.uid)) ||
        (user.username && (
          existing.renterUsername?.toLowerCase() === user.username || 
          existing.ownerUsername?.toLowerCase() === user.username
        ));
      
      if (!isParticipant) {
        return res.status(403).json({ error: "Forbidden: You are not a party to this rental" });
      }
    }

    db.rentals = [rental, ...(db.rentals || []).filter(r => r.id !== rental.id)];
    writeDb(db);

    return res.json({ success: true, rental });
  } catch (err) {
    console.error('[Sync Rental Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Server-Authoritative Quote Endpoint
app.post('/api/rentals/quote', (req, res) => {
  try {
    const user = getRequestUser(req);
    if (!user.uid && !user.username) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { listingId, startDate, endDate } = req.body || {};
    if (!listingId || !startDate || !endDate) {
      return res.status(400).json({ error: "listingId, startDate, and endDate are required" });
    }

    const db = readDb();
    const listing = (db.items || []).find(i => String(i.id) === String(listingId));
    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }
    if (listing.status && listing.status !== 'active') {
      return res.status(409).json({ error: "Listing is not currently active for booking" });
    }

    const isOwner = (user.uid && listing.ownerUid === user.uid) ||
                    (user.username && listing.ownerUsername?.toLowerCase() === user.username);
    if (isOwner) {
      return res.status(400).json({ error: "Owners cannot book their own listing" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid ISO 8601 date format" });
    }
    if (start >= end) {
      return res.status(400).json({ error: "End date must be strictly after start date" });
    }

    const diffMs = end.getTime() - start.getTime();
    const daysCount = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const dailyRate = Number(Number(listing.pricePerDay || 0).toFixed(4));
    const depositAmount = Number(Number(listing.deposit || 0).toFixed(4));
    const baseRentalAmount = Number((daysCount * dailyRate).toFixed(4));
    const platformFee = Math.max(0.0001, Number((baseRentalAmount * 0.05).toFixed(4)));
    const totalAmount = Number((baseRentalAmount + depositAmount + platformFee).toFixed(4));

    const quoteId = `qt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const quote = {
      quoteId,
      listingId: listing.id,
      listingTitle: listing.title,
      ownerUid: listing.ownerUid,
      ownerUsername: listing.ownerUsername,
      renterUid: user.uid,
      renterUsername: user.username,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      daysCount,
      pricePerDay: dailyRate,
      baseRentalAmount,
      depositAmount,
      platformFee,
      totalAmount,
      currency: "PI",
      createdAt,
      expiresAt
    };

    if (!db.quotes) db.quotes = [];
    db.quotes = [quote, ...db.quotes.filter(q => q.quoteId !== quoteId)].slice(0, 500);
    writeDb(db);

    return res.status(201).json({ success: true, quote });
  } catch (err) {
    console.error('[Rental Quote Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Server-Authoritative Rental Booking Creation
app.post('/api/rentals', (req, res) => {
  try {
    const user = getRequestUser(req);
    if (!user.uid && !user.username) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { quoteId, listingId, startDate, endDate } = req.body || {};
    const db = readDb();
    let quote = null;

    if (quoteId) {
      quote = (db.quotes || []).find(q => q.quoteId === quoteId);
      if (!quote) {
        return res.status(410).json({ error: "Quote expired or not found" });
      }
      if (new Date(quote.expiresAt) <= new Date()) {
        return res.status(410).json({ error: "Quote expired" });
      }
    }

    const targetListingId = quote ? quote.listingId : listingId;
    const targetStart = quote ? quote.startDate : startDate;
    const targetEnd = quote ? quote.endDate : endDate;

    if (!targetListingId || !targetStart || !targetEnd) {
      return res.status(400).json({ error: "Listing and booking dates are required" });
    }

    const listing = (db.items || []).find(i => String(i.id) === String(targetListingId));
    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }
    if (listing.status && listing.status !== 'active') {
      return res.status(409).json({ error: "Listing is not active" });
    }

    const start = new Date(targetStart);
    const end = new Date(targetEnd);
    const diffMs = end.getTime() - start.getTime();
    const daysCount = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const dailyRate = Number(Number(listing.pricePerDay || 0).toFixed(4));
    const depositAmount = Number(Number(listing.deposit || 0).toFixed(4));
    const baseRentalAmount = Number((daysCount * dailyRate).toFixed(4));
    const platformFee = Math.max(0.0001, Number((baseRentalAmount * 0.05).toFixed(4)));
    const totalAmount = Number((baseRentalAmount + depositAmount + platformFee).toFixed(4));

    const rentalId = `rnt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const rental = {
      id: rentalId,
      quoteId: quote?.quoteId || null,
      itemId: listing.id,
      itemTitle: listing.title,
      ownerUid: listing.ownerUid,
      ownerUsername: listing.ownerUsername,
      renterUid: user.uid,
      renterUsername: user.username,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      daysCount,
      pricePerDay: dailyRate,
      rentalTotal: baseRentalAmount,
      baseAmount: baseRentalAmount,
      deposit: depositAmount,
      securityDeposit: depositAmount,
      rentoraFee: platformFee,
      totalPlatformFee: platformFee,
      totalAmount,
      status: "pending_payment",
      paymentStatus: "unpaid",
      createdAt: new Date().toISOString()
    };

    if (!db.rentals) db.rentals = [];
    db.rentals = [rental, ...db.rentals.filter(r => r.id !== rentalId)];
    writeDb(db);

    return res.status(201).json({ success: true, rental });
  } catch (err) {
    console.error('[Rental Create Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Rentora Pi Network dApp Server (Strict Mainnet)',
    version: '2.2.0',
    piApiKeyConfigured: !!PI_API_KEY,
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Rentora Backend] Production server listening on http://0.0.0.0:${PORT}`);
  console.log(`[Rentora Backend] Health endpoint: http://0.0.0.0:${PORT}/api/health`);
});

export default app;
