import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { cloudSyncService } from '../services/cloudSyncService';
import { 
  X, 
  Coins, 
  ShieldCheck, 
  CheckCircle2, 
  History, 
  ExternalLink,
  Info,
  Check,
  Receipt,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  Wallet
} from 'lucide-react';

export default function WalletModal({ isOpen, onClose }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isWalletModalOpen, setIsWalletModalOpen, isAuthenticated } = usePiAuth();
  const { transactions = [], rentals = [] } = useRentora();

  const show = isOpen !== undefined ? isOpen : isWalletModalOpen;
  const handleClose = onClose || (() => setIsWalletModalOpen(false));

  const [balanceData, setBalanceData] = useState({
    withdrawable: 0,
    pending: 0,
    totalEarned: 0,
    totalPaidOut: 0
  });
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState('');
  const [withdrawErrorMsg, setWithdrawErrorMsg] = useState('');
  const [withdrawTxid, setWithdrawTxid] = useState('');

  // Persistent Idempotency-Key across retries for the active withdrawal operation
  const activeWithdrawalKeyRef = useRef(null);
  const getOrCreateWithdrawalKey = useCallback(() => {
    if (!activeWithdrawalKeyRef.current) {
      activeWithdrawalKeyRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `user_withdraw_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
    return activeWithdrawalKeyRef.current;
  }, []);

  const loadBalance = async () => {
    if (!isAuthenticated || !currentUser) return;
    setIsLoadingBalance(true);
    try {
      const data = await cloudSyncService.fetchWalletBalance();
      if (data) {
        setBalanceData(data);
        if (data.withdrawable > 0) {
          setWithdrawAmount(String(data.withdrawable));
        }
      }
    } catch (_) {}
    finally {
      setIsLoadingBalance(false);
    }
  };

  useEffect(() => {
    if (show) {
      setWithdrawSuccessMsg('');
      setWithdrawErrorMsg('');
      setWithdrawTxid('');
      loadBalance();
    }
  }, [show, isAuthenticated, currentUser?.uid]);

  if (!show) return null;

  const myUsername = (currentUser?.username || '').toLowerCase().replace('@', '');
  const myUid = currentUser?.uid || currentUser?.piUid;

  const handleWithdrawalSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setWithdrawErrorMsg('');
    setWithdrawSuccessMsg('');
    setWithdrawTxid('');

    const amount = Number(withdrawAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      setWithdrawErrorMsg(l('لطفاً مبلغ معتبری برای انتقال وارد کنید.', 'Please enter a valid amount.', 'يرجى إدخال مبلغ صحيح.', '请输入有效的金额。'));
      return;
    }

    if (amount > balanceData.withdrawable) {
      setWithdrawErrorMsg(l('مبلغ درخواستی بیشتر از موجودی قابل برداشت شماست.', 'Requested amount exceeds withdrawable balance.', 'المبلغ المطلوب يتجاوز رصيدك المتاح.', '提取金额超出可用余额。'));
      return;
    }

    const currentKey = getOrCreateWithdrawalKey();
    setIsSubmittingWithdrawal(true);
    try {
      const res = await cloudSyncService.requestUserWithdrawal(amount, undefined, currentKey);
      if (res?.success) {
        setWithdrawSuccessMsg(res.message || l(`مبلغ ${amount} π با موفقیت به کیف پول پای شما واریز شد.`, `Successfully transferred ${amount} π to your Pi wallet.`, `تم التحويل بنجاح.`, `已成功转账至您的 Pi 钱包。`));
        if (res.txid) {
          setWithdrawTxid(res.txid);
        }
        activeWithdrawalKeyRef.current = null;
        await loadBalance();
      }
    } catch (err) {
      // Retain activeWithdrawalKeyRef.current on failure so retrying sends the same Idempotency-Key
      setWithdrawErrorMsg(err?.message || l('خطا در انتقال وجه به کیف پول پای.', 'Withdrawal failed.', 'فشل التحويل.', '提现失败。'));
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  // Filter verified Pi payments associated with current user
  const myVerifiedPiPayments = (transactions || []).filter(tx => 
    (tx.userUsername && tx.userUsername.toLowerCase() === myUsername) ||
    (tx.userUid && myUid && tx.userUid === myUid) ||
    (tx.user_pi_uid && myUid && tx.user_pi_uid === myUid) ||
    (tx.renterUsername && tx.renterUsername.toLowerCase() === myUsername) ||
    (tx.ownerUsername && tx.ownerUsername.toLowerCase() === myUsername)
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
                <span>{l('کیف پول و درآمدها (Pi A2U Payout)', 'Pi Wallet & Earnings (A2U)', 'محفظة وأرباح باي (A2U)', 'Pi 钱包与收益（A2U）')}</span>
              </h3>
              <p className="text-[10px] text-slate-400">
                {l('موجودی قابل برداشت، انتقال رسمی به کیف پول پای و سوابق تراکنش‌ها', 'Withdrawable balance, official Pi A2U payout & records', 'الرصيد القابل للسحب، التحويل لمحفظة باي وسجل المعاملات', '可提现收益、Pi 链上自动到账与账本明细')}
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
          
          {/* Section 0: Authoritative Withdrawable Balance & A2U Withdrawal Form */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-[#EEEDFE]/40 to-white dark:from-[#26215C]/20 dark:to-[#151426] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
                <Wallet className="w-4 h-4 text-[#534AB7]" />
                <span>{l('موجودی قابل برداشت شما', 'Your Withdrawable Balance', 'رصيدك القابل للسحب', '您的可提现收益')}</span>
              </div>
              <span className="badge-trust px-1.5 py-0.2 rounded text-[9px] font-bold">
                {l('تسویه لحظه‌ای A2U', 'Instant A2U', 'تحويل فوري A2U', 'A2U 链上即时结算')}
              </span>
            </div>

            <div className="flex items-baseline justify-between p-3 rounded-xl bg-white dark:bg-[#18172E] border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-[10px] text-slate-400 block">{l('موجودی خالص تاییدشده:', 'Net Confirmed Balance:', 'الرصيد المؤكد:', '已确认净余额：')}</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-[#0F6E56] dark:text-[#48D2A8]">
                  {isLoadingBalance ? '...' : `${balanceData.withdrawable} π`}
                </span>
              </div>
              <div className="text-left rtl:text-left ltr:text-right text-[10px] text-slate-400 font-mono">
                <div>{l('کل دریافتی:', 'Total Earned:', 'إجمالي الإيرادات:', '总收益：')} {balanceData.totalEarned} π</div>
                <div>{l('کل برداشت‌شده:', 'Total Paid Out:', 'إجمالي المسحوبات:', '已提现：')} {balanceData.totalPaidOut} π</div>
              </div>
            </div>

            {withdrawSuccessMsg && (
              <div className="p-3 rounded-xl badge-trust text-xs font-semibold space-y-1 animate-fadeIn border border-[#0F6E56]/30">
                <div className="flex items-center gap-1.5 text-[#0F6E56] dark:text-[#48D2A8]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{withdrawSuccessMsg}</span>
                </div>
                {withdrawTxid && (
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-300 truncate" dir="ltr">
                    Blockchain TxID: {withdrawTxid}
                  </div>
                )}
              </div>
            )}

            {withdrawErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{withdrawErrorMsg}</span>
              </div>
            )}

            {/* Withdrawal Action Form */}
            <form onSubmit={handleWithdrawalSubmit} className="space-y-2 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {l('مبلغ جهت انتقال به کیف پول پای (π):', 'Amount to transfer to Pi Wallet (π):', 'المبلغ للتحويل لمحفظة باي (π):', '提现至 Pi 钱包金额（π）：')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    max={balanceData.withdrawable}
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    disabled={isSubmittingWithdrawal || balanceData.withdrawable <= 0}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#18172E] text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#534AB7] disabled:opacity-50"
                  />
                  {balanceData.withdrawable > 0 && (
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount(String(balanceData.withdrawable))}
                      className="absolute left-2 rtl:left-2 rtl:right-auto top-2 px-2 py-0.5 rounded bg-[#EEEDFE] dark:bg-[#26215C] text-[#26215C] dark:text-[#EEEDFE] text-[10px] font-bold cursor-pointer"
                    >
                      {l('حداکثر', 'Max', 'الكل', '全部')}
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingWithdrawal || balanceData.withdrawable <= 0}
                className="w-full py-2.5 rounded-xl btn-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {isSubmittingWithdrawal ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{l('در حال صدور تراکنش واریز در شبکه پای (A2U)...', 'Processing Pi A2U Payout...', 'جارٍ التحويل إلى محفظة باي...', '正在向 Pi 钱包转账...')}</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4" />
                    <span>{l(`انتقال به کیف پول Pi (@${currentUser?.username || 'pioneer'})`, `Transfer to Pi Wallet (@${currentUser?.username || 'pioneer'})`, `تحويل إلى محفظة باي (@${currentUser?.username || 'pioneer'})`, `转入 Pi 个人钱包 (@${currentUser?.username || 'pioneer'})`)}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Transparent Model Disclaimer (No Escrow for Direct P2P Rentals) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#19182E] border border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0F6E56]" />
                <span>{l('معماری شفاف رنتورا (Non-Escrow P2P)', 'Non-Escrow P2P Architecture', 'هيكلية رنتورا اللامركزية المباشرة', 'Rentora 无托管 P2P 架构')}</span>
              </span>
              <span className="badge-trust px-1.5 py-0.2 rounded text-[9px] font-bold">Official Pi SDK</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {l(
                'رنتورا کیف پول داخلی یا حساب امانی (Escrow) ندارد. تنها کارمزد رزرو از طریق درگاه رسمی شبکه پای دریافت می‌شود؛ مبلغ اجاره و ودیعه مستقیماً در زمان تحویل کالا بین موجر و مستأجر تسویه می‌گردد.',
                'Rentora does not hold internal wallet funds or escrow. Only booking platform fees are collected via official Pi payments; rental and deposit are settled directly between users at handover.',
                'لا تحتفظ رنتورا بمحفظة داخلية أو أموال معلقة. يتم تحصيل عمولة الحجز فقط عبر باي الرسمية، بينما يُسوى الإيجار والتأمين مباشرة بین المستخدمين.',
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