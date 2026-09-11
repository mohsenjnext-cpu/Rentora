-- Rentora authoritative Cloudflare D1 schema
-- Pi Testnet marketplace. Prices, bookings and payment intents are server-owned.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  pi_uid TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  location TEXT,
  price_per_day REAL NOT NULL CHECK (price_per_day >= 0),
  deposit_amount REAL NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  platform_fee_rate REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','paused','deleted')),
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rentals (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  renter_user_id TEXT NOT NULL REFERENCES users(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  rental_amount REAL NOT NULL CHECK (rental_amount >= 0),
  deposit_amount REAL NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  platform_fee REAL NOT NULL CHECK (platform_fee > 0),
  total_amount REAL NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('draft','pending_payment','paid','confirmed','active','completed','cancelled','disputed')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','pending','approved','completed','failed','cancelled')),
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  rental_id TEXT NOT NULL UNIQUE REFERENCES rentals(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  amount REAL NOT NULL CHECK (amount > 0),
  memo TEXT NOT NULL,
  pi_payment_id TEXT UNIQUE,
  pi_txid TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','approved','completed','cancelled','failed')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  payment_intent_id TEXT NOT NULL REFERENCES payment_intents(id),
  pi_payment_id TEXT NOT NULL UNIQUE,
  pi_txid TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount REAL NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL DEFAULT 'platform_fee',
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','reversed')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  rental_id TEXT NOT NULL REFERENCES rentals(id),
  author_user_id TEXT NOT NULL REFERENCES users(id),
  target_user_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(rental_id, author_user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  renter_user_id TEXT NOT NULL REFERENCES users(id),
  rental_id TEXT REFERENCES rentals(id),
  metadata TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_rentals_renter ON rentals(renter_user_id);
CREATE INDEX IF NOT EXISTS idx_rentals_listing ON rentals(listing_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON payment_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_chats_owner_renter ON chats(owner_user_id, renter_user_id);
