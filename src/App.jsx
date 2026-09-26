import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { PiAuthProvider, usePiAuth } from './context/PiAuthContext';
import { RentoraProvider, useRentora } from './context/RentoraContext';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Footer from './components/Footer';
import PiAuthModal from './components/PiAuthModal';
import WalletModal from './components/WalletModal';
import BookingModal from './components/BookingModal';
import HelpCenterModal from './components/HelpCenterModal';
import SecurityModal from './components/SecurityModal';
import SupportModal from './components/SupportModal';
import ChatModal from './components/ChatModal';
import { requestNotificationPermission } from './services/notificationService';
import { cloudSyncService } from './services/cloudSyncService';

import HomePage from './pages/HomePage';
import HomeRedesign from './pages/HomeRedesign';
import DiscoverPage from './pages/DiscoverPage';
import DiscoverRedesign from './pages/DiscoverRedesign';
import ItemDetailPage from './pages/ItemDetailPage';
import ItemDetailRedesign from './pages/ItemDetailRedesign';
import ListItemPage from './pages/ListItemPage';
import ListItemRedesign from './pages/ListItemRedesign';
import OwnerHubPage from './pages/OwnerHubPage';
import OwnerHubRedesign from './pages/OwnerHubRedesign';
import ActivityPage from './pages/ActivityPage';
import ActivityRedesign from './pages/ActivityRedesign';
import ProfilePage from './pages/ProfilePage';
import ProfileRedesign from './pages/ProfileRedesign';
import PublicProfilePage from './pages/PublicProfilePage';
import PublicProfileRedesign from './pages/PublicProfileRedesign';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminDashboardRedesign from './pages/AdminDashboardRedesign';
import SettingsPage from './pages/SettingsPage';
import SettingsRedesign from './pages/SettingsRedesign';

const getListingIdFromPath = () => {
  const match = window.location.pathname.match(/^\/item\/([^/]+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch (_) {
    return match[1];
  }
};

function MainApp() {
  const { dir } = useLanguage();
  const { isAdmin, currentUser } = usePiAuth();
  const { items, isInitialLoadDone } = useRentora();
  const initialListingId = getListingIdFromPath();
  const [currentTab, setCurrentTab] = useState(initialListingId ? 'item-detail' : 'home');
  const [previousTab, setPreviousTab] = useState('discover');
  const [previousPath, setPreviousPath] = useState('/');
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [publicProfileUsername, setPublicProfileUsername] = useState(null);
  const [discoverInitialCategory, setDiscoverInitialCategory] = useState('all');
  const [discoverInitialQuery, setDiscoverInitialQuery] = useState('');
  const [directBookingItem, setDirectBookingItem] = useState(null);
  const [isDirectBookingOpen, setIsDirectBookingOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const useItemDetailRedesign = new URLSearchParams(window.location.search).get('ui') === 'redesign';

  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [helpInitialTab, setHelpInitialTab] = useState('guide');
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [chatTargetItem, setChatTargetItem] = useState(null);
  const [chatTargetRental, setChatTargetRental] = useState(null);

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }, [currentTab]);

  useEffect(() => {
    const listingId = getListingIdFromPath();
    if (!listingId) return;
    let active = true;
    const match = (Array.isArray(items) ? items : []).find((candidate) => String(candidate.id) === String(listingId));
    if (match) {
      setSelectedItem(match);
      setCurrentTab('item-detail');
      return () => { active = false; };
    }
    if (isInitialLoadDone) {
      cloudSyncService.fetchListingById(listingId)
        .then((item) => {
          if (!active || !item) return;
          setSelectedItem(item);
          setCurrentTab('item-detail');
        })
        .catch(() => {
          if (!active) return;
          setSelectedItem(null);
        });
    }
    return () => { active = false; };
  }, [items, isInitialLoadDone]);

  useEffect(() => {
    const handlePopState = () => {
      const listingId = getListingIdFromPath();
      if (listingId) {
        const match = (items || []).find((candidate) => String(candidate.id) === String(listingId));
        if (match) {
          setSelectedItem(match);
          setCurrentTab('item-detail');
          return;
        }
      }
      setSelectedItem(null);
      setCurrentTab('home');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [items]);

  const handleNavigate = (tab, params = {}) => {
    if (tab === 'admin' && !isAdmin) {
      setCurrentTab('home');
      return;
    }
    if (params.category) setDiscoverInitialCategory(params.category);
    if (params.query !== undefined) setDiscoverInitialQuery(params.query);
    if (tab !== 'list-item') setEditingItem(null);
    setCurrentTab(tab);
  };

  useEffect(() => {
    if (currentTab === 'admin' && !isAdmin) {
      setCurrentTab('home');
    }
  }, [currentTab, isAdmin]);

  const handleSelectItem = (item) => {
    if (!item?.id) return;
    setSelectedItem(item);
    setPreviousTab(currentTab);
    setPreviousPath(window.location.pathname + window.location.search);
    const url = new URL(window.location.href);
    url.pathname = `/item/${encodeURIComponent(item.id)}`;
    window.history.pushState({ listingId: item.id }, '', url);
    setCurrentTab('item-detail');
  };

  const handleBackFromItem = () => {
    const target = previousPath || '/';
    window.history.replaceState({}, '', target);
    setSelectedItem(null);
    setCurrentTab(previousTab || 'discover');
  };

  const handleEditItem = (item) => {
    if (!item) return;
    setEditingItem(item);
    setPreviousTab(currentTab);
    setCurrentTab('list-item');
  };

  const handleRentItem = (item) => {
    if (!item) return;
    const fullItem = (items || []).find(i => i.id === item.id) || item;
    const myName = (currentUser?.username || '').toLowerCase().replace('@', '').trim();
    const ownerName = (fullItem.ownerUsername || fullItem.owner_username || '').toLowerCase().replace('@', '').trim();
    if ((myName && ownerName && myName === ownerName) || (fullItem.ownerUid && currentUser?.uid && fullItem.ownerUid === currentUser.uid)) {
      handleSelectItem(fullItem);
      return;
    }
    setDirectBookingItem(fullItem);
    setIsDirectBookingOpen(true);
  };

  const handleOpenPublicProfile = (username) => {
    if (currentUser && currentUser.username?.toLowerCase() === String(username).toLowerCase().replace('@', '')) {
      setCurrentTab('profile');
      return;
    }
    setPublicProfileUsername(username);
    setPreviousTab(currentTab);
    setCurrentTab('public-profile');
  };

  const handleOpenHelp = (tab = 'guide') => {
    setHelpInitialTab(tab);
    setIsHelpModalOpen(true);
  };

  const handleOpenSecurity = () => setIsSecurityModalOpen(true);
  const handleOpenSupport = () => setIsSupportModalOpen(true);

  const handleOpenChat = (target = null, type = 'item') => {
    if (type === 'rental' || (target && target.bookingNumber)) {
      setChatTargetRental(target);
      setChatTargetItem(null);
    } else {
      setChatTargetItem(target);
      setChatTargetRental(null);
    }
    setIsChatModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFC] dark:bg-[#0B0E17] text-[#111827] dark:text-[#F3F4F6] flex flex-col">
      <Header onNavigate={handleNavigate} currentPage={currentTab} onOpenSidebar={() => setMobileSidebarOpen(true)} onOpenChat={() => handleOpenChat(null)} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-28 md:pb-12">
        {currentTab === 'home' && (useItemDetailRedesign ? <HomeRedesign onNavigate={handleNavigate} onSelectItem={handleSelectItem} onRentItem={handleRentItem} /> : <HomePage onNavigate={handleNavigate} onSelectItem={handleSelectItem} onRentItem={handleRentItem} />)}
        {currentTab === 'discover' && (useItemDetailRedesign ? <DiscoverRedesign initialCategory={discoverInitialCategory} initialQuery={discoverInitialQuery} onSelectItem={handleSelectItem} onRentItem={handleRentItem} /> : <DiscoverPage initialCategory={discoverInitialCategory} initialQuery={discoverInitialQuery} onSelectItem={handleSelectItem} onRentItem={handleRentItem} />)}
        {currentTab === 'item-detail' && selectedItem && (useItemDetailRedesign ? <ItemDetailRedesign item={selectedItem} onBack={handleBackFromItem} onBookingSuccess={() => setCurrentTab('activity')} onNavigateToOwnerHub={() => setCurrentTab('owner-hub')} onEditItem={handleEditItem} onOpenChat={(item) => handleOpenChat(item)} onOpenPublicProfile={handleOpenPublicProfile} /> : <ItemDetailPage item={selectedItem} onBack={handleBackFromItem} onNavigateToActivity={() => setCurrentTab('activity')} onNavigateToOwnerHub={() => setCurrentTab('owner-hub')} onEditItem={handleEditItem} onOpenChat={(item) => handleOpenChat(item)} onOpenPublicProfile={handleOpenPublicProfile} />)}
        {currentTab === 'item-detail' && !selectedItem && isInitialLoadDone && <div className="py-20 text-center max-w-md mx-auto space-y-3"><h2 className="text-lg font-bold text-slate-900 dark:text-white">آگهی پیدا نشد</h2><p className="text-sm text-slate-500 dark:text-slate-400">این آگهی دیگر در دسترس نیست یا شناسه آن معتبر نیست.</p><button type="button" onClick={() => handleNavigate('home')} className="btn-primary px-4 py-2 text-xs font-bold cursor-pointer">بازگشت به خانه</button></div>}
        {currentTab === 'public-profile' && publicProfileUsername && (useItemDetailRedesign ? <PublicProfileRedesign username={publicProfileUsername} onBack={() => setCurrentTab(previousTab || 'discover')} onSelectItem={handleSelectItem} onRentItem={handleRentItem} onOpenChat={(item) => handleOpenChat(item)} /> : <PublicProfilePage username={publicProfileUsername} onBack={() => setCurrentTab(previousTab || 'discover')} onSelectItem={handleSelectItem} onRentItem={handleRentItem} onOpenChat={(item) => handleOpenChat(item)} />)}
        {currentTab === 'list-item' && (useItemDetailRedesign ? <ListItemRedesign itemToEdit={editingItem} onCancelEdit={() => { setEditingItem(null); setCurrentTab(previousTab || 'owner-hub'); }} onItemCreated={(newItem) => { setSelectedItem(newItem); setEditingItem(null); setCurrentTab('item-detail'); }} onItemUpdated={(updatedItem) => { setSelectedItem(updatedItem); setEditingItem(null); setCurrentTab('item-detail'); }} onNavigate={(page) => { setEditingItem(null); setCurrentTab(page); }} /> : <ListItemPage itemToEdit={editingItem} onCancelEdit={() => { setEditingItem(null); setCurrentTab(previousTab || 'owner-hub'); }} onItemCreated={(newItem) => { setSelectedItem(newItem); setEditingItem(null); setCurrentTab('item-detail'); }} onItemUpdated={(updatedItem) => { setSelectedItem(updatedItem); setEditingItem(null); setCurrentTab('item-detail'); }} onNavigate={(page) => { setEditingItem(null); setCurrentTab(page); }} />)}
        {currentTab === 'owner-hub' && (useItemDetailRedesign ? <OwnerHubRedesign onNavigate={handleNavigate} onSelectItem={handleSelectItem} onEditItem={handleEditItem} /> : <OwnerHubPage onNavigate={handleNavigate} onSelectItem={handleSelectItem} onEditItem={handleEditItem} />)}
        {currentTab === 'activity' && (useItemDetailRedesign ? <ActivityRedesign onNavigate={handleNavigate} onSelectItem={handleSelectItem} onOpenChat={handleOpenChat} /> : <ActivityPage onNavigate={handleNavigate} onSelectItem={handleSelectItem} onOpenPublicProfile={handleOpenPublicProfile} onOpenChat={handleOpenChat} />)}
        {currentTab === 'profile' && (useItemDetailRedesign ? <ProfileRedesign onNavigate={handleNavigate} onSelectItem={handleSelectItem} /> : <ProfilePage onNavigate={handleNavigate} onSelectItem={handleSelectItem} onRentItem={handleRentItem} onOpenPublicProfile={handleOpenPublicProfile} />)}
        {currentTab === 'admin' && (isAdmin ? (useItemDetailRedesign ? <AdminDashboardRedesign onNavigate={handleNavigate} /> : <AdminDashboardPage onNavigate={handleNavigate} onOpenPublicProfile={handleOpenPublicProfile} onEditItem={handleEditItem} />) : <div className="py-20 text-center max-w-md mx-auto space-y-4 animate-fadeIn select-none"><div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center border border-rose-200 dark:border-rose-900 shadow-sm"><Lock className="w-7 h-7 stroke-[1.8]" /></div><div className="space-y-1"><h2 className="text-lg font-bold text-slate-900 dark:text-white">دسترسی غیرمجاز (۴۰۳)</h2><p className="text-xs text-slate-500 max-w-xs mx-auto">دسترسی به این بخش اختصاصی مدیران تاییدشده رنتورا است.</p></div><button type="button" onClick={() => handleNavigate('home')} className="btn-primary px-4 py-2 text-xs font-bold cursor-pointer">بازگشت به خانه</button></div>)}
        {currentTab === 'settings' && (useItemDetailRedesign ? <SettingsRedesign onNavigate={handleNavigate} onOpenHelp={handleOpenHelp} onOpenSecurity={handleOpenSecurity} onOpenSupport={handleOpenSupport} /> : <SettingsPage onNavigate={handleNavigate} onOpenHelp={handleOpenHelp} onOpenSecurity={handleOpenSecurity} onOpenSupport={handleOpenSupport} />)}
      </main>
      <Footer onNavigate={handleNavigate} onOpenHelp={handleOpenHelp} />
      <Sidebar currentTab={currentTab} onNavigate={handleNavigate} mobileOpen={mobileSidebarOpen} setMobileOpen={setMobileSidebarOpen} onOpenChat={() => handleOpenChat(null)} onOpenHelp={handleOpenHelp} onOpenSecurity={handleOpenSecurity} onOpenSupport={handleOpenSupport} />
      <PiAuthModal />
      <WalletModal />
      <HelpCenterModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} initialTab={helpInitialTab} />
      <SecurityModal isOpen={isSecurityModalOpen} onClose={() => setIsSecurityModalOpen(false)} initialTab={helpInitialTab} />
      <SupportModal isOpen={isSupportModalOpen} onClose={() => setIsSupportModalOpen(false)} onOpenDispute={() => handleOpenHelp('rules')} />
      <ChatModal isOpen={isChatModalOpen} onClose={() => { setIsChatModalOpen(false); setChatTargetItem(null); setChatTargetRental(null); }} initialItem={chatTargetItem} initialRental={chatTargetRental} onDirectRent={(item) => { setIsChatModalOpen(false); handleRentItem(item); }} onOpenPublicProfile={handleOpenPublicProfile} />
      {directBookingItem && <BookingModal item={directBookingItem} isOpen={isDirectBookingOpen} onClose={() => { setIsDirectBookingOpen(false); setDirectBookingItem(null); }} onBookingSuccess={() => { setIsDirectBookingOpen(false); setDirectBookingItem(null); setCurrentTab('activity'); }} />}
      <BottomNav currentTab={currentTab} onNavigate={handleNavigate} />
    </div>
  );
}

export default function App() {
  return <ThemeProvider><LanguageProvider><PiAuthProvider><RentoraProvider><MainApp /></RentoraProvider></PiAuthProvider></LanguageProvider></ThemeProvider>;
}
