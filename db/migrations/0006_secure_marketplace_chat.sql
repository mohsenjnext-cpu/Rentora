-- Migration 0006: Secure Marketplace Communication System
-- Replaces deprecated chats table with normalized, reservation-aware conversations and messages.

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

CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(owner_user_id, renter_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_listing ON conversations(listing_id);
CREATE INDEX IF NOT EXISTS idx_conversations_rental ON conversations(rental_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

-- Drop deprecated legacy chats table
DROP TABLE IF EXISTS chats;
