import React from 'react';

/**
 * Chat notifications are intentionally represented by the unread badge
 * on the Chat tab/header instead of an intrusive fixed toast.
 *
 * Keep this component as a no-op so existing imports/render paths remain
 * compatible without changing the chat state, polling, or message flow.
 */
export default function NotificationToast() {
  return null;
}
