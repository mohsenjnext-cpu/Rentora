import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { RENTAL_STATES, RentalStateMachine } from '../services/rentalStateMachine';
import ReviewModal from '../components/ReviewModal';
import ReportModal from '../components/ReportModal';
import { 
  Clock, 
  CheckCircle2, 
  Star, 
  Flag, 
  Coins, 
  MapPin, 
  AlertTriangle,
  Receipt,
  RotateCw,
  Package,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Info
} from 'lucide-react';

export default function ActivityPage({ onNavigate, onSelectItem }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen } = usePiAuth();
  const { 
    rentals = [], 
    confirmHandoverOneTap, 
    confirmReturnOneTap 
  } = useRentora();

  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history'
  const [selectedRentalForReview, setSelectedRentalForReview] = useState(null);
  const [selectedRentalForReport, setSelectedRentalForReport] = useState(null);
  const [selectedAgreementRental, setSelectedAgreementRental] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  if (!isAuthenticated) {
    return (
      <div className="py-16 text-center max-w-md mx-auto space-y-4 animate-fadeIn select-none">
        <div className="w-12 h-12 mx-auto rounded-xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#26215C] dark:text-[#EEEDFE] flex items-center justify-center">
          <Clock className="w-6 h-6 stroke-[1.8]" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('activityTitle')}
        </h2>
        <p className="text-xs text-slate-500">
          {t('activitySubtitle')}
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="btn-primary px-5 py-2.5 text-xs font-bold cursor-pointer"
        >
          {t('navLogin')}
        </button>
      </div>
    );
  }

  const myUsername = (currentUser?.username || '').toLowerCase().replace('@', '');

  // Filter rentals where current user is the renter
  const myRentals = (rentals || []).filter(r => 
    r.renterUsername?.toLowerCase() === myUsername
  );

  const activeRentals = myRentals.filter(r => 
    r.status === RENTAL_STATES.CONFIRMED || 
    r.status === RENTAL_STATES.ACTIVE || 
    r.status === RENTAL_STATES.PAYMENT_PENDING ||
    r.status === RENTAL_STATES.REQUESTED ||
    r.status === RENTAL_STATES.ACCEPTED
  );

  const historyRentals = myRentals.filter(r => 
    r.status === RENTAL_STATES.COMPLETED || 
    r.status === RENTAL_STATES.CANCELLED || 
    r.status === RENTAL_STATES.REJECTED ||
    r.status === RENTAL_STATES.DISPUTED
  );

  const handleConfirmHandover = async (rentalId) => {
    setProcessingId(rentalId);
    try {
      await confirmHandoverOneTap(rentalId);
    } catch (e) {
      console.warn(e);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-16 select-none animate-fadeIn">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {t('activityTitle')}
          </h1>
          <p className="text-[11px] text-slate-400">
            {l('مدیریت سفارش‌ها، قراردادهای اجاره و تاییدیه‌های تحویل', 'Manage bookings, rental agreements, and handovers', 'إدارة الحجوزات وعقود الإيجار والتسليم', '管理预订、租赁协议及交接确认')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#1A1930] rounded-xl text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'active' 
              ? 'bg-white dark:bg-[#26215C] text-[#26215C] dark:text-white shadow-xs' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{t('tabActiveRentals')} ({activeRentals.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'history' 
              ? 'bg-white dark:bg-[#26215C] text-[#26215C] dark:text-white shadow-xs' 
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{t('tabRentalHistory')} ({historyRentals.length})</span>
        </button>
      </div>

      {/* Active Tab */}
      {activeTab === 'active' && (
        <div className="space-y-3">
          {activeRentals.length === 0 ? (
            <div className="p-8 text-center rounded-xl rentora-card space-y-2">
              <Package className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-xs text-slate-400">{t('noActiveRentals')}</p>
            </div>
          ) : (
            activeRentals.map(rental => {
              const statusMeta = RentalStateMachine.getStatusMeta(rental.status, l);
              const bookingNumber = rental.bookingNumber || rental.rentalAgreement?.agreementId || rental.id.substring(0, 10);
              const rentalFee = rental.rentalTotal !== undefined ? rental.rentalTotal : rental.baseAmount;
              const feeAmount = rental.rentoraFee !== undefined ? rental.rentoraFee : (rental.totalPlatformFee || 0);

              return (
                <div key={rental.id} className="p-4 rounded-xl rentora-card space-y-3 border border-slate-150 dark:border-slate-800 shadow-2xs">
                  
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-mono text-[10px] font-bold text-[#534AB7] dark:text-[#AFA9EC] bg-[#EEEDFE] dark:bg-[#26215C] px-1.5 py-0.2 rounded">
                          #{bookingNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {rental.startDate} ➔ {rental.endDate} ({rental.daysCount} {l('روز', 'days', 'أيام', '天')})
                        </span>
                      </div>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {rental.itemTitle}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-mono block">
                        {l('موجر:', 'Owner:', 'المؤجر:', '物主：')} @{rental.ownerUsername}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${statusMeta.bg}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  {/* Pricing Breakdown & Direct Settlement Details */}
                  <div className="p-3 rounded-lg bg-slate-50/70 dark:bg-[#16152B]/70 space-y-1.5 text-[11px] border border-slate-200/70 dark:border-slate-800">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>{l('کرایه (تسویه مستقیم با موجر):', 'Rental (Direct P2P):', 'الإيجار (مباشر يداً بيد):', '租金（线下直接结清）：')}</span>
                      <strong className="font-mono text-slate-900 dark:text-white">{rentalFee} π</strong>
                    </div>

                    {rental.deposit > 0 && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>{l('ودیعه امانی (تسویه مستقیم):', 'Deposit (Direct P2P):', 'التأمين (مباشر يداً بيد):', '押金（线下直接交付）：')}</span>
                        <strong className="font-mono text-slate-900 dark:text-white">{rental.deposit} π</strong>
                      </div>
                    )}

                    <div className="flex justify-between text-[#0F6E56] dark:text-[#48D2A8] font-bold pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span>{l('کارمزد رنتورا (پرداخت آنلاین با پای):', 'Rentora Fee (Pi Payment):', 'عمولة رنتورا (مدفوعة):', 'Rentora 平台费（Pi 链上已付）：')}</span>
                      <span className="font-mono">✓ {feeAmount} π ({l('تاییدشده', 'Confirmed', 'مؤكدة', '已确认')})</span>
                    </div>
                  </div>

                  {/* Actions & Agreement Button */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedAgreementRental(rental)}
                      className="btn-secondary px-3 py-1.5 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#534AB7]" />
                      <span>{l('قرارداد اجاره', 'Rental Agreement', 'عقد الإيجار', '租赁协议')}</span>
                    </button>

                    {rental.status === RENTAL_STATES.CONFIRMED && (
                      <button
                        type="button"
                        disabled={processingId === rental.id}
                        onClick={() => handleConfirmHandover(rental.id)}
                        className="btn-primary flex-1 py-1.5 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{processingId === rental.id ? '...' : l('تایید دریافت کالا در محل تحویل', 'Confirm Handover at Pickup', 'تأكيد استلام الغرض', '现场确认已交接')}</span>
                      </button>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {historyRentals.length === 0 ? (
            <div className="p-8 text-center rounded-xl rentora-card space-y-2">
              <Package className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-xs text-slate-400">{t('noRentalHistory')}</p>
            </div>
          ) : (
            historyRentals.map(rental => {
              const statusMeta = RentalStateMachine.getStatusMeta(rental.status, l);
              const bookingNumber = rental.bookingNumber || rental.rentalAgreement?.agreementId || rental.id.substring(0, 10);
              const rentalFee = rental.rentalTotal !== undefined ? rental.rentalTotal : rental.baseAmount;

              return (
                <div key={rental.id} className="p-4 rounded-xl rentora-card space-y-3 border border-slate-150 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-mono text-[10px] font-bold text-[#534AB7] dark:text-[#AFA9EC] bg-[#EEEDFE] dark:bg-[#26215C] px-1.5 py-0.2 rounded">
                          #{bookingNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">@{rental.ownerUsername}</span>
                      </div>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{rental.itemTitle}</h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusMeta.bg}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-150 dark:border-slate-800">
                    <span>{rental.daysCount} {l('روز', 'days', 'أيام', '天')}</span>
                    <span className="font-mono font-bold text-[#0F6E56]">{rentalFee} π (P2P)</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-150 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSelectedAgreementRental(rental)}
                      className="btn-secondary px-3 py-1.5 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#534AB7]" />
                      <span>{l('قرارداد', 'Agreement', 'العقد', '协议')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRentalForReview(rental)}
                      className="btn-secondary flex-1 py-1.5 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span>{t('btnLeaveReview')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRentalForReport(rental)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 cursor-pointer"
                      title={t('btnReportDispute')}
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Rental Agreement Full Modal */}
      {selectedAgreementRental && (
        <div 
          onClick={() => setSelectedAgreementRental(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn select-none"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#151426] rounded-2xl w-full max-w-md max-h-[88vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl animate-scaleIn overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-[#18172E]/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#26215C] text-white flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[#EEEDFE]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {l('قرارداد رسمی رزرو رنتورا', 'Rentora Rental Agreement', 'عقد إيجار رنتورا الرسمي', 'Rentora 官方租赁协议')}
                  </h3>
                  <span className="font-mono text-[10px] text-slate-400">
                    #{selectedAgreementRental.bookingNumber || selectedAgreementRental.rentalAgreement?.agreementId || selectedAgreementRental.id.substring(0, 10)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAgreementRental(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Agreement Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
              
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#19182E] border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 block">{l('موجر (مالک کالا):', 'Owner:', 'المؤجر:', '物主：')}</span>
                  <strong className="font-mono text-slate-900 dark:text-white" dir="ltr">@{selectedAgreementRental.ownerUsername}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">{l('مستاجر:', 'Renter:', 'المستأجر:', '租客：')}</span>
                  <strong className="font-mono text-slate-900 dark:text-white" dir="ltr">@{selectedAgreementRental.renterUsername}</strong>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{l('نام کالا:', 'Item:', 'الغرض:', '物品名称：')}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedAgreementRental.itemTitle}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">{l('مدت اجاره:', 'Rental Period:', 'مدة الإيجار:', '租赁期限：')}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {selectedAgreementRental.startDate} ➔ {selectedAgreementRental.endDate} ({selectedAgreementRental.daysCount} {l('روز', 'days', 'أيام', '天')})
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">{l('مبلغ کرایه (تسویه مستقیم):', 'Rental (Direct P2P):', 'الإيجار (مباشر يداً بيد):', '租金（线下当面结清）：')}</span>
                  <strong className="font-mono text-slate-900 dark:text-white">{selectedAgreementRental.rentalTotal || selectedAgreementRental.baseAmount} π</strong>
                </div>

                {selectedAgreementRental.deposit > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">{l('ودیعه امانی (تسویه مستقیم):', 'Deposit (Direct P2P):', 'التأمين (مباشر يداً بيد):', '押金（线下当面交接）：')}</span>
                    <strong className="font-mono text-slate-900 dark:text-white">{selectedAgreementRental.deposit} π</strong>
                  </div>
                )}

                <div className="flex justify-between text-[#0F6E56] dark:text-[#48D2A8] font-bold pt-2 border-t border-slate-150 dark:border-slate-800">
                  <span>{l('کارمزد رنتورا (پرداخت آنلاین):', 'Rentora Platform Fee:', 'عمولة المنصة:', '平台服务费：')}</span>
                  <span className="font-mono">
                    ✓ {selectedAgreementRental.rentoraFee !== undefined ? selectedAgreementRental.rentoraFee : selectedAgreementRental.totalPlatformFee} π
                  </span>
                </div>

                {selectedAgreementRental.piTxRef && (
                  <div className="text-[9px] text-slate-400 font-mono truncate pt-1" dir="ltr">
                    Pi TxID: {selectedAgreementRental.piTxRef}
                  </div>
                )}
              </div>

              {/* Legal Notice */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-900 dark:text-amber-300 leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{l('بند حقوقی تسویه مستقیم:', 'Direct P2P Settlement Clause:', 'بند التسوية المباشرة:', '点对点直接结算条款：')}</span>
                </div>
                <p className="opacity-95">
                  {l(
                    'رنتورا یک پلتفرم همتا‌به‌همتا (P2P) است و مبالغ اجاره و ودیعه مستقیماً در زمان تحویل بین طرفین مبادله شده و توسط رنتورا نگهداری یا امانت گرفته نمی‌شود.',
                    'Rentora is a P2P marketplace. Rental fee and security deposit are settled directly between users upon handover and are not held or processed by Rentora.',
                    'رنتورا منصة تأجير مباشرة. يُسوى الإيجار والتأمين مباشرة بين الطرفين عند الاستلام ولا تحتفظ بها المنصة.',
                    'Rentora 仅为点对点租赁中介平台。租金与押金均由双方当面直接结清，平台不代管或托管资金。'
                  )}
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-[#1A1930]/40 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAgreementRental(null)}
                className="btn-primary px-5 py-2 text-xs font-bold cursor-pointer"
              >
                {l('تایید و بستن', 'OK', 'حسناً', '确定')}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedRentalForReview && (
        <ReviewModal
          rental={selectedRentalForReview}
          isOpen={!!selectedRentalForReview}
          onClose={() => setSelectedRentalForReview(null)}
        />
      )}

      {/* Report Modal */}
      {selectedRentalForReport && (
        <ReportModal
          target={{ username: selectedRentalForReport.ownerUsername, title: selectedRentalForReport.itemTitle }}
          type="order"
          isOpen={!!selectedRentalForReport}
          onClose={() => setSelectedRentalForReport(null)}
        />
      )}

    </div>
  );
}
