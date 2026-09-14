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
  rental_id TEXT NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reviewer_user_id TEXT NOT NULL REFERENCES users(id),
  reviewee_user_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'hidden', 'flagged')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(rental_id, reviewer_user_id, reviewee_user_id)
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

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  rental_id TEXT REFERENCES rentals(id) ON DELETE SET NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  renter_user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'pre_booking' CHECK (type IN ('pre_booking', 'post_booking')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
  last_message_text TEXT,
  last_message_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(listing_id, renter_user_id, type)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL REFERENCES users(id),
  message_text TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'handover_notice', 'status_update')),
  moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('approved', 'flagged', 'blocked')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS listing_contacts (
  listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  contact_name TEXT,
  contact_phone TEXT,
  whatsapp TEXT,
  preferred_contact_method TEXT DEFAULT 'phone',
  contact_hours TEXT,
  coordination_notes TEXT,
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
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(owner_user_id, renter_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_listing ON conversations(listing_id);
CREATE INDEX IF NOT EXISTS idx_conversations_rental ON conversations(rental_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_listing_contacts_listing ON listing_contacts(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rental ON reviews(rental_id);
CREATE INDEX IF NOT EXISTS idx_reviews_listing ON reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_user_id);
