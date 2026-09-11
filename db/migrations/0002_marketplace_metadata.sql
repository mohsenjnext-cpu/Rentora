-- Run after db/schema.sql on an existing D1 database created from the original schema.
-- Fresh databases can use db/schema.sql directly.
ALTER TABLE users ADD COLUMN metadata TEXT;
ALTER TABLE listings ADD COLUMN metadata TEXT;
ALTER TABLE rentals ADD COLUMN metadata TEXT;
ALTER TABLE reviews ADD COLUMN metadata TEXT;
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
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_chats_owner_renter ON chats(owner_user_id, renter_user_id);
