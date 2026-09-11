import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { 
  X, 
  Coins, 
  ShieldCheck, 
  CheckCircle2, 
  History, 
  ExternalLink,
  Info,
  Check,
  Receipt
} from 'lucide-react';

export default function WalletModal({ isOpen, onClose }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isWalletModalOpen, setIsWalletModalOpen } = usePiAuth();
  const { transactions = [], rentals = [] } = useRentora();

  const show = isOpen !== undefined ? isOpen : isWalletModalOpen;
  const handleClose = onClose || (() => setIsWalletModalOpen(false));

  if (!show) return null;

  const myUsername = (currentUser?.username || '').toLowerCase().replace('@', '');

  // Filter verified Pi payments associated with current user
  const myVerifiedPiPayments = (transactions || []).filter(tx => 
    tx.userUsername?.toLowerCase() === myUsername ||
    tx.renterUsername?.toLowerCase() === myUsername ||
    tx.ownerUsername?.toLowerCase() === myUsername
  );

  // Filter direct P2P rental settlements
  const myP2PRentals = (rentals || []).filter(r => 
    r.renterUsername?.toLowerCase() === myUsername ||
    r.ownerUsername?.toLowerCase() === myUsername
  );

  return (
    <div 
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn select-none"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#151426] rounded-2xl w-full max-w-lg max-h-[88vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl animate-scaleIn overflow-hidden"
      >
        
        {/* Header */}
        <div className="p-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-[#18172E]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#26215C] text-white flex items-center justify-center shadow-xs">
              <Coins className="w-4 h-4 text-amber-400 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>{l('فعالیت‌ها و تراکنش‌های پای', 'Pi Activity & Ledger', 'نشاطات ومعاملات باي', 'Pi 链上活动与账本')}</span>
              </h3>
              <p className="text-[10px] text-slate-400">
                {l('سوابق پرداخت کارمزد پلتفرم و وضعیت تسویه‌های مستقیم', 'Verified Pi fee payments & direct P2P records', 'سجل مدفوعات العمولة الموثقة والتسويات المباشرة', '经链上验证的平台费支付与点对点记录')}
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
          
          {/* Transparent Model Disclaimer (No Internal Wallet / No Escrow) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#19182E] border border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0F6E56]" />
                <span>{l('معماری غیرامانی رنتورا (Non-Escrow P2P)', 'Non-Escrow P2P Architecture', 'هيكلية رنتورا اللامركزية المباشرة', 'Rentora 无托管 P2P 架构')}</span>
              </span>
              <span className="badge-trust px-1.5 py-0.2 rounded text-[9px] font-bold">Official Pi SDK</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {l(
                'رنتورا کیف پول داخلی یا حساب امانی (Escrow) ندارد. تنها کارمزد رزرو از طریق درگاه رسمی شبکه پای دریافت می‌شود؛ مبلغ اجاره و ودیعه مستقیماً در زمان تحویل کالا بین موجر و مستأجر تسویه می‌گردد.',
                'Rentora does not hold internal wallet funds or escrow. Only booking platform fees are collected via official Pi payments; rental and deposit are settled directly between users at handover.',
                'لا تحتفظ رنتورا بمحفظة داخلية أو أموال معلقة. يتم تحصيل عمولة الحجز فقط عبر باي الرسمية، بينما يُسوى الإيجار والتأمين مباشرة بين المستخدمين.',
                'Rentora 不设内部虚拟钱包或托管资金。仅通过官方 Pi 支付收取预订服务费；租金与押金均由双方当面直接结清。'
              )}
            </p>
          </div>

          {/* Section 1: Verified Pi Network Platform Payments */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#0F6E56]" />
              <span>{l('پرداخت‌های تاییدشده کارمزد در شبکه پای', 'Verified Pi Platform Payments', 'مدفوعات العمولة المؤكدة في باي', '已确认的 Pi 链上平台费')}</span>
            </h4>

            {myVerifiedPiPayments.length === 0 ? (
              <div className="p-4 text-center rounded-xl rentora-card text-slate-400 text-[11px]">
                {l('هنوز پرداخت کارمزدی در شبکه پای ثبت نشده است.', 'No Pi platform payments recorded yet.', 'لا توجد مدفوعات مسجلة بعد.', '暂无平台费支付记录。')}
              </div>
            ) : (
              <div className="space-y-2">
                {myVerifiedPiPayments.map((tx, idx) => (
                  <div key={tx.id || idx} className="p-3 rounded-xl rentora-card space-y-1.5 border border-slate-150 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 dark:text-white text-xs">
                        {tx.itemTitle || 'کارمزد رزرو رنتورا (Rentora Booking Fee)'}
                      </div>
                      <span className="font-mono font-black text-[#0F6E56] dark:text-[#48D2A8] text-xs">
                        {tx.amount} π
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono" dir="ltr">
                      <span>{tx.bookingNumber ? `#${tx.bookingNumber}` : `#${tx.id?.substring(0, 10)}`}</span>
                      <span className="text-[#0F6E56] font-bold">✓ Pi Payment Confirmed</span>
                    </div>

                    {tx.piTxRef && (
                      <div className="text-[9px] text-slate-400 font-mono truncate pt-1 border-t border-slate-100 dark:border-slate-800" dir="ltr">
                        TxID: {tx.piTxRef}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Direct P2P Rental Status */}
          {myP2PRentals.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-150 dark:border-slate-800">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <History className="w-4 h-4 text-[#534AB7]" />
                <span>{l('تسویه‌های مستقیم بین طرفین (Direct P2P)', 'Direct P2P Rental Settlements', 'التسويات المباشرة بين الطرفين', '当面点对点直接结清')}</span>
              </h4>

              <div className="space-y-2">
                {myP2PRentals.slice(0, 5).map((rental, idx) => (
                  <div key={rental.id || idx} className="p-3 rounded-xl bg-slate-50/70 dark:bg-[#16152B]/70 border border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{rental.itemTitle}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{rental.rentalTotal || rental.baseAmount} π</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{rental.daysCount} {l('روز', 'days', 'أيام', '天')}</span>
                      <span className="italic text-slate-500 dark:text-slate-400">
                        {l('تسویه مستقیم در محل تحویل (غیر امانی)', 'Direct P2P settlement — not held by Rentora', 'تسوية مباشرة يداً بيد (غير معلقة)', '线下当面直接结清（非托管）')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
