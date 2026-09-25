import React from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';

/**
 * UI-01 App Shell
 *
 * Keeps global chrome separate from page/business state while preserving the
 * existing navigation handlers during the incremental redesign.
 *
 * Mobile/Pi Browser:
 * - Bottom navigation is the persistent primary navigation surface.
 * - Header is reserved for orientation and global actions.
 *
 * Desktop:
 * - Header + sidebar remain available without changing legacy page behavior.
 */
export default function AppShell({
  children,
  currentTab,
  onNavigate,
  onOpenSidebar,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  onOpenChat,
  onOpenHelp,
  onOpenSecurity,
  onOpenSupport,
}) {
  return (
    <div className="min-h-screen bg-[#FAFAFC] dark:bg-[#0B0E17] text-[#111827] dark:text-[#F3F4F6] flex flex-col">
      <Header
        onNavigate={onNavigate}
        currentPage={currentTab}
        onOpenSidebar={onOpenSidebar}
        onOpenChat={() => onOpenChat?.(null)}
      />

      <main
        id="main-content"
        className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-28 md:pb-12"
      >
        {children}
      </main>

      <Footer onNavigate={onNavigate} onOpenHelp={onOpenHelp} />

      <Sidebar
        currentTab={currentTab}
        onNavigate={onNavigate}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        onOpenChat={() => onOpenChat?.(null)}
        onOpenHelp={onOpenHelp}
        onOpenSecurity={onOpenSecurity}
        onOpenSupport={onOpenSupport}
      />

      <BottomNav currentTab={currentTab} onNavigate={onNavigate} />
    </div>
  );
}
