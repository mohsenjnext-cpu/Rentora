import React, { createContext, useContext, useState, useEffect } from 'react';
import { piService } from '../services/piService';
import { cloudSyncService } from '../services/cloudSyncService';
import { getApiBaseUrl } from '../services/apiConfig';

const PiAuthContext = createContext();
const STORAGE_KEY_USER = 'rentora_live_v1_session';

function installSessionFetchBridge() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return () => {};
  if (window.__rentoraSessionFetchBridge) return () => {};

  const originalFetch = window.fetch.bind(window);
  const apiBase = getApiBaseUrl();

  window.fetch = async (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      const isApiRequest = (apiBase && url.startsWith(apiBase)) || url.startsWith('/api/');
      const isPiLogin = url.includes('/api/auth/pi-login');
      if (isApiRequest && !isPiLogin) {
        const raw = localStorage.getItem(STORAGE_KEY_USER);
        const session = raw ? JSON.parse(raw) : null;
        if (session?.sessionToken) {
          const headers = new Headers(input instanceof Request ? input.headers : undefined);
          new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
          headers.delete('x-pi-uid');
          headers.delete('x-pi-username');
          if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${session.sessionToken}`);
          return originalFetch(input, { ...init, headers });
        }
      }
    } catch (_) {}
    return originalFetch(input, init);
  };

  window.__rentoraSessionFetchBridge = true;
  return () => {
    if (window.fetch === originalFetch) return;
    window.fetch = originalFetch;
    delete window.__rentoraSessionFetchBridge;
  };
}

export function PiAuthProvider({ children }) {
  const [users, setUsers] = useState(() => cloudSyncService.getCachedUsers());
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USER);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.sessionToken && parsed?.uid ? parsed : null;
    } catch (_) { return null; }
  });
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    const restoreFetch = installSessionFetchBridge();
    return restoreFetch;
  }, []);

  useEffect(() => {
    try {
      if (currentUser) localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
      else localStorage.removeItem(STORAGE_KEY_USER);
    } catch (_) {}
  }, [currentUser]);

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
      if (!authData?.sessionToken || !authData?.uid) throw new Error('سرور رنتورا یک نشست معتبر صادر نکرد.');
      const userObj = {
        ...authData.user,
        uid: authData.uid,
        username: authData.username,
        displayName: authData.user?.displayName || authData.username,
        sessionToken: authData.sessionToken,
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
    const sessionToken = currentUser?.sessionToken;
    try {
      const apiBase = getApiBaseUrl();
      if (apiBase && sessionToken) {
        await fetch(`${apiBase}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` }
        });
      }
    } catch (_) {
      // Local logout still happens even if the network is unavailable.
    } finally {
      setCurrentUser(null);
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentUser.sessionToken}`
      },
      body: JSON.stringify(allowed)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.user) throw new Error(data?.error || 'ذخیره پروفایل ناموفق بود.');
    const updated = { ...currentUser, ...data.user, sessionToken: currentUser.sessionToken, isOfficialSdk: true, piWalletConnected: true };
    setCurrentUser(updated);
    setUsers(prev => [updated, ...prev.filter(u => u.uid !== updated.uid)]);
    cloudSyncService.saveCachedUsers([updated, ...users.filter(u => u.uid !== updated.uid)]);
    return updated;
  };

  const toggleUserStatus = () => { throw new Error('تغییر وضعیت کاربران فقط از طریق API مدیریتی سرور مجاز است.'); };

  return (
    <PiAuthContext.Provider value={{
      users,
      currentUser,
      isAuthenticated: !!currentUser?.sessionToken,
      isAdmin: currentUser?.role === 'admin',
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
      toggleUserStatus
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
