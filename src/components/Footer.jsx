import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Footer() {
  const { dir } = useLanguage();

  return (
    <footer className="w-full bg-slate-50 dark:bg-[#0B0A17] border-t border-slate-200/80 dark:border-slate-800/80 pt-4 pb-20 md:pb-6 text-xs text-slate-400 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-center text-[10px]">
        <div>
          © {new Date().getFullYear()} Rentora (رنتورا) — {dir === 'rtl' ? 'بازارچه اجاره همتا به همتا با پرداخت پای' : 'P2P Rental Marketplace with Pi'}
        </div>
        <div className="text-slate-400 font-mono">
          Powered by Pi Network Blockchain
        </div>
      </div>
    </footer>
  );
}
