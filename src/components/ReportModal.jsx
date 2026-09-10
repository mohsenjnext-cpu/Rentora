import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRentora } from '../context/RentoraContext';
import { 
  X, 
  Flag, 
  CheckCircle2, 
  AlertTriangle,
  Send
} from 'lucide-react';

export default function ReportModal({ target, type, isOpen, onClose }) {
  const { lang, dir, t, l } = useLanguage();
  const { submitReport } = useRentora();

  const [reason, setReason] = useState('fake_listing');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const reasons = [
    { id: 'fake_listing', label: l('آگهی غیرواقعی یا تقلبی', 'Fake or misleading listing', 'إعلان غير حقيقي أو احتيالي', '虚假或误导性信息') },
    { id: 'offline_bypass', label: l('تلاش برای دور زدن قوانین پلتفرم', 'Bypassing platform policies', 'محاولة تجاوز سياسات المنصة', '试图违规脱离平台交易') },
    { id: 'inappropriate', label: l('محتوا یا رفتار نامناسب', 'Inappropriate content or behavior', 'محتوى أو سلوك غير لائق', '不当言论或行为') },
    { id: 'other', label: l('سایر موارد تخلف', 'Other issue', 'سبب آخر', '其他违规问题') }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    submitReport({
      type,
      targetUsername: target?.username,
      targetTitle: target?.title,
      reason,
      details
    });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 2000);
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn select-none"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#151426] rounded-2xl w-full max-w-md flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl animate-scaleIn overflow-hidden"
      >
        
        {/* Header */}
        <div className="p-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <Flag className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {t('itemReportBtn')}
              </h3>
              <p className="text-[10px] text-slate-400">
                {target?.title || `@${target?.username}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {submitted ? (
          <div className="p-8 text-center space-y-3 animate-fadeIn">
            <div className="w-12 h-12 mx-auto rounded-full badge-trust text-[#0F6E56] flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-6 h-6 stroke-[2]" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              {l('گزارش تخلف ثبت شد', 'Report Submitted', 'تم تسجيل البلاغ', '举报已提交受理')}
            </h4>
            <p className="text-xs text-slate-500">
              {l('تیم داوری رنتورا مورد گزارش‌شده را بررسی خواهد نمود.', 'Rentora moderation team will review this issue.', 'سيقوم فريق المشرفين بمراجعة البلاغ واتخاذ الإجراءات اللازمة.', 'Rentora 审核团队将尽快核实并处理此项违规。')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                {l('علت گزارش', 'Reason for report', 'سبب البلاغ', '举报原因')}
              </label>
              <div className="space-y-1.5">
                {reasons.map((r) => (
                  <label
                    key={r.id}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                      reason === r.id
                        ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={r.id}
                      checked={reason === r.id}
                      onChange={(e) => setReason(e.target.value)}
                      className="accent-rose-600"
                    />
                    <span>{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {l('توضیحات تکمیلی (اختیاری)', 'Additional details (optional)', 'تفاصيل إضافية (اختياري)', '补充说明（可选）')}
              </label>
              <textarea
                rows="3"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={l('جزئیات بیشتر را بنویسید...', 'Provide more details...', 'اكتب المزيد من التفاصيل...', '请描述详细情况...')}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Send className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
              <span>{l('ارسال گزارش تخلف', 'Submit Report', 'إرسال البلاغ', '提交违规报告')}</span>
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
