import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { piService } from '../services/piService';
import { cloudSyncService } from '../services/cloudSyncService';

// Official Master Admin Pi Usernames list
export const ADMIN_USERNAMES = [
  'avina60',
  'mohsenjnext',
  'mohsenjnext-cpu',
  'admin_rentora',
  'admin'
];

export const isUsernameAdmin = (username) => {
  if (!username) return false;
  const clean = String(username).toLowerCase().replace('@', '').trim();
  return ADMIN_USERNAMES.some(adm => clean === adm.toLowerCase());
};

const PiAuthContext = createContext();

const STORAGE_KEY_USER = 'rentora_live_v1_session';
const STORAGE_KEY_USERS = 'rentora_live_v1_users_dir';

export function PiAuthProvider({ children }) {
  // Real Users Directory State
  const [users, setUsers] = useState(() => {
    return cloudSyncService.getCachedUsers();
  });

  // Current Logged-in User Session
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.username) {
          parsed.role = isUsernameAdmin(parsed.username) ? 'admin' : 'user';
          return parsed;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  });

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Save currentUser to localStorage
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
      }
    } catch (e) {}
  }, [currentUser]);

  // Subscribe to Multi-Device Cloud Sync
  useEffect(() => {
    const unsubscribe = cloudSyncService.subscribe((event, data) => {
      if (data && Array.isArray(data.users)) {
        setUsers(prev => {
          if (JSON.stringify(prev) === JSON.stringify(data.users)) return prev;
          return data.users;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const createNewUserObject = (cleanUser, customUid = null, isOfficialSdk = false) => {
    const isAdminRole = isUsernameAdmin(cleanUser);
    return {
      uid: customUid || ("pi_usr_" + cleanUser.replace('@', '')),
      username: cleanUser.replace('@', ''),
      displayName: cleanUser.replace('@', ''),
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUser}`,
      bio: isAdminRole ? "مدیر کل پلتفرم رنتورا در شبکه پای" : (isOfficialSdk ? "پیشگام تاییدشده شبکه پای در رنتورا" : "کاربر آزمایشی رنتورا"),
      location: "ایران",
      role: isAdminRole ? 'admin' : 'user',
      kycStatus: isOfficialSdk ? 'verified' : 'unverified',
      isOfficialSdk: !!isOfficialSdk,
      reputation: null,
      totalRentals: 0,
      piWalletConnected: !!isOfficialSdk,
      joinedDate: new Date().toISOString().split('T')[0],
      phoneMasked: "+98 9•• ••• ••••",
      status: "active"
    };
  };

  const loginWithPi = async (customUsername = null) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      let cleanUser = '';
      let uid = null;
      let isOfficialSdk = false;

      if (customUsername) {
        cleanUser = customUsername.toLowerCase().replace('@', '').trim();
        isOfficialSdk = false; // Custom manual entry is unverified demo
      } else {
        const authData = await piService.authenticate();
        cleanUser = authData.username?.toLowerCase() || 'pioneer';
        uid = authData.uid;
        isOfficialSdk = !!authData.isOfficialSdk;
      }

      const existingUser = users.find(u => u.username?.toLowerCase() === cleanUser);
      let userObj;

      if (existingUser) {
        userObj = {
          ...existingUser,
          role: isUsernameAdmin(cleanUser) ? 'admin' : (existingUser.role || 'user'),
          kycStatus: isOfficialSdk ? 'verified' : (existingUser.kycStatus || 'unverified'),
          isOfficialSdk: isOfficialSdk || existingUser.isOfficialSdk || false,
          status: existingUser.status || 'active'
        };
      } else {
        userObj = createNewUserObject(cleanUser, uid, isOfficialSdk);
      }

      setCurrentUser(userObj);
      setUsers(prev => {
        const filtered = prev.filter(u => u.username?.toLowerCase() !== userObj.username?.toLowerCase());
        const updated = [userObj, ...filtered];
        cloudSyncService.saveCachedUsers(updated);
        return updated;
      });

      cloudSyncService.broadcastUserProfile(userObj);
      setAuthModalOpen(false);
      return userObj;
    } catch (err) {
      console.warn('[PiAuth] Login note:', err.message);
      if (err.message === 'NOT_IN_PI_BROWSER') {
        setAuthError('ورود رسمی فقط درون برنامه Pi Browser امکان‌پذیر است.');
      } else {
        setAuthError(err.message || 'اتصال به شبکه پای با خطا مواجه شد.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    try { localStorage.removeItem(STORAGE_KEY_USER); } catch (e) {}
  };

  const updateUserProfile = (updatedFields) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...updatedFields };
    
    setCurrentUser(updated);
    setUsers(prev => {
      const filtered = prev.filter(u => u.username?.toLowerCase() !== updated.username?.toLowerCase());
      const newUsers = [updated, ...filtered];
      cloudSyncService.saveCachedUsers(newUsers);
      return newUsers;
    });

    cloudSyncService.broadcastUserProfile(updated);
  };

  const toggleUserStatus = (uid) => {
    setUsers(prev => {
      const updated = prev.map(u => u.uid === uid ? { ...u, status: u.status === 'active' ? 'banned' : 'active' } : u);
      cloudSyncService.saveCachedUsers(updated);
      return updated;
    });
  };

  const isAdmin = !!currentUser && (currentUser.role === 'admin' || isUsernameAdmin(currentUser.username));

  return (
    <PiAuthContext.Provider
      value={{
        users,
        currentUser,
        isAuthenticated: !!currentUser,
        isAdmin,
        isLoading,
        authError,
        authModalOpen,
        setAuthModalOpen,
        isWalletModalOpen,
        setIsWalletModalOpen,
        loginWithPi,
        logout,
        updateUserProfile,
        toggleUserStatus
      }}
    >
      {children}
    </PiAuthContext.Provider>
  );
}

export function usePiAuth() {
  const context = useContext(PiAuthContext);
  if (!context) {
    throw new Error('usePiAuth must be used within a PiAuthProvider');
  }
  return context;
}
