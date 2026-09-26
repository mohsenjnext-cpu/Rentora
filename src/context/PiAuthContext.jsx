import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { piService } from '../services/piService';
import { cloudSyncService } from '../services/cloudSyncService';
import { getApiBaseUrl } from '../services/apiConfig';

const PiAuthContext = createContext();
function installSessionFetchBridge(onSessionInvalid) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return () => {};
  if (window.__rentoraSessionFetchBridge) return () => {};
  const originalFetch = window.fetch.bind(window);
  const apiBase = getApiBaseUrl();
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const isApiRequest = (apiBase && url.startsWith(apiBase)) || url.startsWith('/api/');
    const isPiLogin = url.includes('/api/auth/pi-login');
    try {
      if (isApiRequest) {
        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
        headers.delete('Authorization');
        headers.delete('x-pi-uid');
        headers.delete('x-pi-username');
        headers.set('X-Rentora-Client', 'web');
        const res = await originalFetch(input, { ...init, headers, credentials: init.credentials || 'include' });
        if (res.status === 401 && !isPiLogin && typeof onSessionInvalid === 'function') onSessionInvalid();
        return res;
      }
    } catch (error) {
      // Never retry an API Request object after fetch may have consumed its body.
      // Fetch bodies are one-shot streams; retrying the same Request can throw
      // "Body has already been used" in Cloudflare/Pi Browser runtimes.
      if (isApiRequest) throw error;
    }
    return originalFetch(input, init);
  };
  window.__rentoraSessionFetchBridge = true;
  return () => {};
}

export function PiAuthProvider({ children }) {
  const [users, setUsers] = useState(() => cloudSyncService.getCachedUsers());
  const [currentUser, setCurrentUser] = useState(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isServerVerifiedAdmin, setIsServerVerifiedAdmin] = useState(false);

  const handleSessionInvalid = useCallback(() => {
    try { cloudSyncService.clearUserSessionCache(); } catch (_) {}
    setCurrentUser(null);
    setIsServerVerifiedAdmin(false);
  }, []);

  useEffect(() => {
    try { localStorage.removeItem('rentora_live_v1_session'); } catch (_) {}
    const restoreFetch = installSessionFetchBridge(handleSessionInvalid);
    return restoreFetch;
  }, [handleSessionInvalid]);

  // Authoritatively verify session with server on initial mount & whenever currentUser changes
  useEffect(() => {
    let isMounted = true;
    const apiBase = getApiBaseUrl();
    if (!apiBase) return () => {};
    fetch(`${apiBase}/api/auth/me`, { method: 'GET', headers: { 'Cache-Control': 'no-cache' }, credentials: 'include' })
      .then(res => {
        if (res.status === 401) {
          if (isMounted) handleSessionInvalid();
          return null;
        }
        return res.json().catch(() => null);
      })
      .then(data => {
        if (!isMounted || !data?.authenticated || !data.user) return;
        const verifiedAdmin = Boolean(data.isAdmin || data.user.isAdmin || data.user.role === 'admin');
        setIsServerVerifiedAdmin(verifiedAdmin);
        setCurrentUser({ ...data.user, uid: data.user.uid, role: data.user.role || 'user', kycStatus: data.user.kycStatus || 'unknown', isOfficialSdk: true, piWalletConnected: true });
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [handleSessionInvalid]);

  useEffect(() => {
    const unsubscribe = cloudSyncService.subscribe((event, data) => {
      if (data && Array.isArray(data.users)) setUsers(data.users);
    });
    return () => unsubscribe();
  }, []);

  const loginWithPi = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const authData = await piService.authenticate();
      if (!authData?.uid) throw new Error('سرور رنتورا یک نشست معتبر صادر نکرد.');
      const isAdminRole = authData.user?.role === 'admin';
      setIsServerVerifiedAdmin(isAdminRole);
      const userObj = {
        ...authData.user,
        uid: authData.uid,
        username: authData.username,
        displayName: authData.user?.displayName || authData.username,
        role: authData.user?.role || 'user',
        kycStatus: authData.user?.kycStatus || 'unknown',
        isOfficialSdk: true,
        piWalletConnected: true,
        status: authData.user?.status || 'active'
      };
      setCurrentUser(userObj);
      setUsers(prev => {
        const updated = [userObj, ...prev.filter(u => u.uid !== userObj.uid)];
        cloudSyncService.saveCachedUsers(updated);
        return updated;
      });
      setAuthModalOpen(false);
      return userObj;
    } catch (err) {
      const message = err?.message || 'احراز هویت در Pi Browser با خطا مواجه شد.';
      setAuthError(message === 'NOT_IN_PI_BROWSER' ? 'ورود رسمی فقط در Pi Browser امکان‌پذیر است.' : message);
      throw err;
    } finally { setIsLoading(false); }
  };

  const logout = async () => {
    try {
      const apiBase = getApiBaseUrl();
      if (apiBase) await fetch(`${apiBase}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (_) {
      // Local logout still happens even if the network is unavailable.
    } finally {
      handleSessionInvalid();
    }
  };

  const updateUserProfile = async (updatedFields) => {
    if (!currentUser) throw new Error('ابتدا وارد حساب پای خود شوید.');
    const allowed = {};
    for (const key of ['displayName', 'bio', 'location', 'avatar', 'phoneMasked']) {
      if (Object.prototype.hasOwnProperty.call(updatedFields || {}, key)) allowed[key] = updatedFields[key];
    }
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('آدرس سرور رنتورا تنظیم نشده است.');
    const response = await fetch(`${apiBase}/api/sync/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(allowed)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.user) throw new Error(data?.error || 'ذخیره پروفایل ناموفق بود.');
    const updated = { ...currentUser, ...data.user, isOfficialSdk: true, piWalletConnected: true };
    setCurrentUser(updated);
    setUsers(prev => [updated, ...prev.filter(u => u.uid !== updated.uid)]);
    cloudSyncService.saveCachedUsers([updated, ...users.filter(u => u.uid !== updated.uid)]);
    return updated;
  };

  const toggleUserStatus = async (targetUserId, newStatus) => {
    const updated = await cloudSyncService.setAdminUserStatus(targetUserId, newStatus);
    if (updated) {
      setUsers(prev => prev.map(u => (u.id === targetUserId || u.uid === targetUserId || u.username === targetUserId) ? { ...u, status: updated.status } : u));
    }
    return updated;
  };

  const moderateListingStatus = async (listingId, newStatus) => {
    return cloudSyncService.setAdminListingStatus(listingId, newStatus);
  };

  // Admin UI state is only a reflection of a server-verified authorization result.
  // Never elevate based solely on a client-controlled/stale role field.
  const isActuallyAdmin = Boolean(currentUser?.uid && isServerVerifiedAdmin);

  return (
    <PiAuthContext.Provider value={{
      users,
      currentUser,
      isAuthenticated: !!currentUser?.uid,
      isAdmin: isActuallyAdmin,
      isLoading,
      authError,
      authModalOpen,
      setAuthModalOpen,
      isWalletModalOpen,
      setIsWalletModalOpen,
      loginWithPi,
      logout,
      updateUserProfile,
      updateProfile: updateUserProfile,
      toggleUserStatus,
      moderateListingStatus
    }}>
      {children}
    </PiAuthContext.Provider>
  );
}

export function usePiAuth() {
  const context = useContext(PiAuthContext);
  if (!context) throw new Error('usePiAuth must be used within a PiAuthProvider');
  return context;
}
