import fs from 'fs';
import assert from 'assert';

const source = fs.readFileSync('src/pages/ActivityPage.jsx', 'utf8');

assert.match(source, /isRefreshing = false,\s*refreshApp/, 'activity must use the real app refresh path');
assert.match(source, /role="status" aria-live="polite"/, 'activity must expose a loading status');
assert.match(source, /aria-busy="true"/, 'activity loading state must expose busy semantics');
assert.match(source, /role="alert" aria-live="assertive"/, 'activity must expose recoverable page errors');
assert.match(source, /onClick=\{refreshActivity\}/, 'activity retry must refresh authoritative account data');
assert.match(source, /const result = await refreshApp\?\.\(\)/, 'activity refresh must use the real app sync path');
assert.match(source, /fetchRentalContact/, 'activity must retain real secure contact loading');
assert.match(source, /onClick=\{\(\) => selectedContactRental && handleOpenContactModal\(selectedContactRental\)\}/, 'contact recovery must remain available');

console.log('Activity state and authority checks passed.');


assert.match(source, /const isRentalDateExpired = \(rental\) =>/, 'activity must detect rentals whose end date has passed');
assert.ok(source.includes('if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(endDate)) return false;'), 'activity expiry must validate ISO end dates correctly');
assert.match(source, /const expiredRentals = useMemo/, 'expired rentals must have a separate view model');
assert.match(source, /activeTab === 'expired'/, 'activity must expose an expired-rentals workspace');
assert.match(source, /تاریخ اجاره گذشته/, 'expired rentals must be visibly labeled as expired');
assert.match(source, /به‌صورت خودکار «تکمیل‌شده» نمی‌شود/, 'expiry must not falsely mark a rental as completed');
assert.match(source, /const clearedActivityKey = currentUser \? `rentora_cleared_activity_/, 'activity cleanup must be scoped to the current user');
assert.match(source, /const handleClearAllActivity = \(\) =>/, 'activity must expose one global cleanup action');
assert.match(source, /setClearedActivityTime\(nowTime\)/, 'global cleanup must clear the activity feed from the local view');
assert.match(source, /setClearedHistoryTime\(nowTime\)/, 'global cleanup must clear rental history from the local view');
assert.match(source, /پاکسازی تمام بخش‌های فعالیت/, 'global cleanup confirmation must be explicit');

const bottomNav = fs.readFileSync('src/components/BottomNav.jsx', 'utf8');
assert.match(bottomNav, /const ACTIONABLE_RENTAL_STATUSES = new Set/, 'activity badge must be scoped to actionable states');
assert.doesNotMatch(bottomNav, /ACTIONABLE_RENTAL_STATUSES[^\n]*active/, 'ordinary active rentals must not keep the activity badge alive');

const notifications = fs.readFileSync('src/pages/NotificationsPage.jsx', 'utf8');
assert.match(notifications, /rentora_notification_reads_/, 'notification read state must be user scoped');
assert.match(notifications, /localStorage\.setItem\(notificationReadKey/, 'notification read state must persist');
assert.match(notifications, /persistReadIds/, 'notification read actions must use the persistent read state');

console.log('Activity expiry, badge, and notification persistence checks passed.');
