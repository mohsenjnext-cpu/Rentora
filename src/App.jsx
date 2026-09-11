import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { PiAuthProvider, usePiAuth } from './context/PiAuthContext';
import { RentoraProvider, useRentora } from './context/RentoraContext';

// Components
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

// Pages
import HomePage from './pages/HomePage';
import DiscoverPage from './pages/DiscoverPage';
import ItemDetailPage from './pages/ItemDetailPage';
import ListItemPage from './pages/ListItemPage';
import OwnerHubPage from './pages/OwnerHubPage';
import ActivityPage from './pages/ActivityPage';
import ProfilePage from './pages/ProfilePage';
import PublicProfilePage from './pages/PublicProfilePage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import SettingsPage from './pages/SettingsPage';

function MainApp() {
  const { dir } = useLanguage();
  const { isAdmin, currentUser } = usePiAuth();
  const [currentTab, setCurrentTab] = useState('home');
  const [previousTab, setPreviousTab] = useState('discover');
  const [selectedItem, setSelectedItem] = useState(null);
  const [publicProfileUsername, setPublicProfileUsername] = useState(null);
  const [discoverInitialCategory, setDiscoverInitialCategory] = useState('all');
  const [discoverInitialQuery, setDiscoverInitialQuery] = useState('');
  const [directBookingItem, setDirectBookingItem] = useState(null);
  const [isDirectBookingOpen, setIsDirectBookingOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Modals States
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [helpInitialTab, setHelpInitialTab] = useState('guide');
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  // In-App Chat Modal State
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [chatTargetItem, setChatTargetItem] = useState(null);

  // Smooth scroll to top only on tab transition
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  }, [currentTab]);

  const handleNavigate = (tab, params = {}) => {
    if (params.category) setDiscoverInitialCategory(params.category);
    if (params.query !== undefined) setDiscoverInitialQuery(params.query);
    setCurrentTab(tab);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setPreviousTab(currentTab);
    setCurrentTab('item-detail');
  };

  const handleRentItem = (item) => {
    setDirectBookingItem(item);
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

  const handleOpenSecurity = () => {
    setIsSecurityModalOpen(true);
  };

  const handleOpenSupport = () => {
    setIsSupportModalOpen(true);
  };

  const handleOpenChat = (item = null) => {
    setChatTargetItem(item);
    setIsChatModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFC] dark:bg-[#0B0E17] text-[#111827] dark:text-[#F3F4F6] flex flex-col">
      
      {/* Top Header */}
      <Header
        onNavigate={handleNavigate}
        currentPage={currentTab}
        onOpenSidebar={() => setMobileSidebarOpen(true)}
        onOpenChat={() => handleOpenChat(null)}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-28 md:pb-12">
        {currentTab === 'home' && (
          <HomePage
            onNavigate={handleNavigate}
            onSelectItem={handleSelectItem}
            onRentItem={handleRentItem}
          />
        )}

        {currentTab === 'discover' && (
          <DiscoverPage
            initialCategory={discoverInitialCategory}
            initialQuery={discoverInitialQuery}
            onSelectItem={handleSelectItem}
            onRentItem={handleRentItem}
          />
        )}

        {currentTab === 'item-detail' && selectedItem && (
          <ItemDetailPage
            item={selectedItem}
            onBack={() => setCurrentTab(previousTab || 'discover')}
            onNavigateToActivity={() => setCurrentTab('activity')}
            onNavigateToOwnerHub={() => setCurrentTab('owner-hub')}
            onOpenChat={(item) => handleOpenChat(item)}
            onOpenPublicProfile={handleOpenPublicProfile}
          />
        )}

        {currentTab === 'public-profile' && publicProfileUsername && (
          <PublicProfilePage
            username={publicProfileUsername}
            onBack={() => setCurrentTab(previousTab || 'discover')}
            onSelectItem={handleSelectItem}
            onRentItem={handleRentItem}
            onOpenChat={(item) => handleOpenChat(item)}
          />
        )}

        {currentTab === 'list-item' && (
          <ListItemPage
            onCreated={(newItem) => {
              setSelectedItem(newItem);
              setCurrentTab('item-detail');
            }}
            onNavigate={handleNavigate}
          />
        )}

        {currentTab === 'owner-hub' && (
          <OwnerHubPage
            onNavigate={handleNavigate}
            onSelectItem={handleSelectItem}
          />
        )}

        {currentTab === 'activity' && (
          <ActivityPage
            onNavigate={handleNavigate}
            onSelectItem={handleSelectItem}
            onOpenPublicProfile={handleOpenPublicProfile}
          />
        )}

        {currentTab === 'profile' && (
          <ProfilePage
            onNavigate={handleNavigate}
            onSelectItem={handleSelectItem}
            onRentItem={handleRentItem}
          />
        )}

        {currentTab === 'admin' && (
          <AdminDashboardPage
            onNavigate={handleNavigate}
            onOpenPublicProfile={handleOpenPublicProfile}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsPage 
            onNavigate={handleNavigate}
            onOpenHelp={handleOpenHelp} 
            onOpenSecurity={handleOpenSecurity}
            onOpenSupport={handleOpenSupport}
          />
        )}
      </main>

      {/* Footer */}
      <Footer onNavigate={handleNavigate} onOpenHelp={handleOpenHelp} />

      {/* Mobile Drawer */}
      <Sidebar
        currentTab={currentTab}
        onNavigate={handleNavigate}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        onOpenChat={() => handleOpenChat(null)}
        onOpenHelp={handleOpenHelp}
        onOpenSecurity={handleOpenSecurity}
        onOpenSupport={handleOpenSupport}
      />

      {/* Global Modals */}
      <PiAuthModal />
      <WalletModal />

      <HelpCenterModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        initialTab={helpInitialTab}
      />

      <SecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />

      <SupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        onOpenDispute={() => handleOpenHelp('rules')}
      />

      <ChatModal
        isOpen={isChatModalOpen}
        onClose={() => {
          setIsChatModalOpen(false);
          setChatTargetItem(null);
        }}
        initialItem={chatTargetItem}
        onDirectRent={(item) => {
          setIsChatModalOpen(false);
          handleRentItem(item);
        }}
        onOpenPublicProfile={handleOpenPublicProfile}
      />

      {directBookingItem && (
        <BookingModal
          item={directBookingItem}
          isOpen={isDirectBookingOpen}
          onClose={() => {
            setIsDirectBookingOpen(false);
            setDirectBookingItem(null);
          }}
          onBookingComplete={() => {
            setIsDirectBookingOpen(false);
            setDirectBookingItem(null);
            setCurrentTab('activity');
          }}
        />
      )}

      {/* Mobile Floating Bottom Bar */}
      <BottomNav currentTab={currentTab} onNavigate={handleNavigate} />

    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <PiAuthProvider>
          <RentoraProvider>
            <MainApp />
          </RentoraProvider>
        </PiAuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
