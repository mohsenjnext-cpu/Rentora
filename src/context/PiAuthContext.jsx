import React, { createContext, useContext, useState, useEffect } from 'react';
import { piService } from '../services/piService';
import { cloudSyncService } from '../services/cloudSyncService';

const PiAuthContext = createContext();
const STORAGE_KEY_USER = 'rentora_live_v1_session';

export function PiAuthProvider({ children }) {
  const [users, setUsers] = useState(() => cloudSyncService.getCachedUsers());
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USER);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.sessionToken && parsed?.uid ? parsed : null;
    } catch (_) {
      return null;
    }
  });
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

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
      if (!authData?.sessionToken || !authData?.uid) {
        throw new Error('سرور رنتورا یک نشست معتبر صادر نکرد.');
      }

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
      setAuthError(message === 'NOT_IN_PI_BROWSER'
        ? 'ورود رسمی فقط در Pi Browser امکان‌پذیر است.'
        : message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const sessionToken = currentUser?.sessionToken;
    try {
      await cloudSyncService.logout(sessionToken);
    } catch (_) {}
    setCurrentUser(null);
  };

  const updateUserProfile = (updatedFields) => {
    if (!currentUser) return null;
    const allowed = {};
    for (const key of ['displayName', 'bio', 'location']) {
      if (Object.prototype.hasOwnProperty.call(updatedFields || {}, key)) allowed[key] = updatedFields[key];
    }
    const updated = { ...currentUser, ...allowed };
    setCurrentUser(updated);
    return updated;
  };

  const toggleUserStatus = () => {
    throw new Error('تغییر وضعیت کاربران فقط از طریق API مدیریتی سرور مجاز است.');
  };

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
