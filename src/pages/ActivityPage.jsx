import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
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
  Package
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

  // Filter rentals where current user is the renter
  const myRentals = (rentals || []).filter(r => 
    r.renterUsername?.toLowerCase() === currentUser?.username?.toLowerCase()
  );

  const activeRentals = myRentals.filter(r => 
    r.status === 'confirmed' || r.status === 'active' || r.status === 'awaiting_payment'
  );

  const historyRentals = myRentals.filter(r => 
    r.status === 'completed' || r.status === 'cancelled'
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
            {t('activitySubtitle')}
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
            activeRentals.map(rental => (
              <div key={rental.id} className="p-4 rounded-xl rentora-card space-y-3 border border-slate-150 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{rental.itemTitle}</h3>
                    <span className="text-[11px] text-slate-400 block font-mono">
                      {l('موجر:', 'Owner:', 'المؤجر:', '物主：')} @{rental.ownerUsername}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold badge-trust">
                    {rental.status === 'confirmed' ? l('در انتظار تحویل حضوری', 'Awaiting Handover', 'بانتظار التسليم', '待当面交付') : l('در دست شما (فعال)', 'In Use (Active)', 'قيد الاستخدام', '使用中')}
                  </span>
                </div>

                <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-150 dark:border-slate-800 font-mono">
                  <span>{rental.startDate} ➔ {rental.endDate}</span>
                  <span className="font-black text-[#0F6E56]">{rental.baseAmount} π</span>
                </div>

                {rental.status === 'confirmed' && (
                  <button
                    type="button"
                    disabled={processingId === rental.id}
                    onClick={() => handleConfirmHandover(rental.id)}
                    className="btn-primary w-full py-2 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{processingId === rental.id ? '...' : l('تایید دریافت کالا در محل تحویل', 'Confirm Item Handover at Pickup', 'تأكيد استلام الغرض في الموقع', '现场确认已收到物品')}</span>
                  </button>
                )}
              </div>
            ))
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
            historyRentals.map(rental => (
              <div key={rental.id} className="p-4 rounded-xl rentora-card space-y-3 border border-slate-150 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{rental.itemTitle}</h3>
                    <span className="text-[11px] text-slate-400 font-mono block">@{rental.ownerUsername}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold badge-trust">
                    {l('تکمیل شده ✓', 'Completed ✓', 'مكتمل ✓', '已完成 ✓')}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-150 dark:border-slate-800">
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
            ))
          )}
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
