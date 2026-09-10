import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { 
  X, 
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ShieldCheck, 
  CheckCircle2, 
  Crown,
  History,
  Receipt
} from 'lucide-react';

export default function WalletModal({ isOpen, onClose, onOpenSubscription }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isWalletModalOpen, setIsWalletModalOpen } = usePiAuth();
  const { transactions = [], isUserPro } = useRentora();

  const show = isOpen !== undefined ? isOpen : isWalletModalOpen;
  const handleClose = onClose || (() => setIsWalletModalOpen(false));

  if (!show) return null;

  const isPro = isUserPro(currentUser?.username);
  const myTransactions = (transactions || []).filter(tx => 
    tx.userUsername?.toLowerCase() === currentUser?.username?.toLowerCase() ||
    tx.renterUsername?.toLowerCase() === currentUser?.username?.toLowerCase()
  );

  return (
    <div 
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn select-none"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#151426] rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl animate-scaleIn overflow-hidden"
      >
        
        {/* Header */}
        <div className="p-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#26215C] text-white flex items-center justify-center">
              <Coins className="w-4 h-4 text-amber-400 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {t('walletTitle')}
              </h3>
              <p className="text-[10px] text-slate-400">
                {t('walletSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Account Status Card */}
          <div className="p-4 rounded-xl banner-purple space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#534AB7] dark:text-[#AFA9EC]">{l('حساب متصل شبکه پای', 'Connected Pi Account', 'حساب باي المتصل', '已连接的 Pi 账户')}</span>
              <span className="badge-trust px-1.5 py-0.5 rounded text-[9px] font-bold">KYC Verified</span>
            </div>
            <div className="text-sm font-bold text-[#26215C] dark:text-white font-mono" dir="ltr">
              @{currentUser?.username || 'pioneer'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {l('تسویه و پرداخت‌ها مستقیم از کیف پول اصلی شبکه پای انجام می‌شود.', 'Transactions are settled directly via official Pi Network wallet.', 'تتم المعاملات والمدفوعات مباشرة عبر محفظة شبكة باي الرسمية.', '结算与交易均通过官方 Pi 钱包完成。')}
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <History className="w-4 h-4 text-[#534AB7]" />
              <span>{l('تاریخچه تراکنش‌های پای', 'Pi Transactions History', 'سجل معاملات باي', 'Pi 交易记录')}</span>
            </h4>

            {myTransactions.length === 0 ? (
              <div className="p-6 text-center rounded-xl rentora-card text-slate-400">
                {l('هنوز تراکنش آنلاینی ثبت نشده است.', 'No online transactions recorded yet.', 'لا توجد معاملات مسجلة بعد.', '暂无在线交易记录。')}
              </div>
            ) : (
              <div className="space-y-2">
                {myTransactions.map((tx, idx) => (
                  <div key={tx.id || idx} className="p-3 rounded-xl rentora-card flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{tx.title || tx.memo || 'پرداخت کارمزد پای'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tx.date || 'امروز'}</div>
                    </div>
                    <div className="font-black text-[#0F6E56] font-mono">
                      -{tx.amount} π
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-[#1A1930]/40 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="btn-primary px-5 py-2 text-xs font-bold cursor-pointer"
          >
            {l('بستن', 'Close', 'إغلاق', '关闭')}
          </button>
        </div>

      </div>
    </div>
  );
}
