import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRentora } from '../context/RentoraContext';
import RentoraModal from './ui/RentoraModal';
import RentoraButton from './ui/RentoraButton';
import RentoraAlert from './ui/RentoraAlert';
import RentoraEmptyState from './ui/RentoraEmptyState';
import { 
  X, 
  Flag, 
  CheckCircle2, 
  AlertCircle,
  Send,
} from 'lucide-react';

export default function ReportModal({ target, type = 'listing', isOpen, onClose }) {
  const { lang, dir, t, l } = useLanguage();
  const { submitReport } = useRentora();

  const [reason, setReason] = useState('fake_listing');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const reasons = [
    { id: 'fake_listing', label: l('آگهی غیرواقعی یا تقلبی', 'Fake or misleading listing', 'إعلان غير حقيقي أو احتيالي', '虚假或误导性信息') },
    { id: 'offline_bypass', label: l('تلاش برای دور زدن قوانین پلتفرم', 'Bypassing platform policies', 'محاولة تجاوز سياسات المنصة', '试图违规脱离平台交易') },
    { id: 'inappropriate', label: l('محتوا یا رفتار نامناسب', 'Inappropriate content or behavior', 'محتوى أو سلوك غير لائق', '不当言论或行为') },
    { id: 'other', label: l('سایر موارد تخلف', 'Other issue', 'سبب آخر', '其他违规问题') }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      await submitReport({
        type,
        targetId: target?.id || target?.username || target?.title || 'unknown',
        targetUsername: target?.username,
        targetTitle: target?.title,
        reason,
        details: details.trim()
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setDetails('');
        onClose();
      }, 2000);
    } catch (err) {
      setErrorMsg(err?.message || l('خطا در ارسال گزارش تخلف', 'Failed to submit report', 'فشل في إرسال البلاغ', '提交举报失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RentoraModal
      open={isOpen}
      onClose={onClose}
      title={t('itemReportBtn')}
      description={target?.title || (target?.username ? `@${target.username}` : undefined)}
      size="sm"
      closeOnBackdrop={!submitting}
      closeOnEscape={!submitting}
    >
      {submitted ? (
        <RentoraEmptyState
          icon={<CheckCircle2 className="h-7 w-7" />}
          title={l('گزارش تخلف ثبت شد', 'Report Submitted', 'تم تسجيل البلاغ', '举报已提交受理')}
          description={l('تیم داوری رنتورا مورد گزارش‌شده را بررسی خواهد نمود.', 'Rentora moderation team will review this issue.', 'سيقوم فريق المشرفين بمراجعة البلاغ واتخاذ الإجراءات اللازمة.', 'Rentora 审核团队将尽快核实并处理此项违规。')}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {errorMsg && <RentoraAlert tone="error">{errorMsg}</RentoraAlert>}
          <fieldset>
            <legend className="mb-1.5 font-bold text-slate-700 dark:text-slate-300">
              {l('علت گزارش', 'Reason for report', 'سبب البلاغ', '举报原因')}
            </legend>
            <div className="space-y-1.5">
              {reasons.map((r) => (
                <label key={r.id} className={`min-h-11 p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition focus-within:ring-2 focus-within:ring-rose-500 ${reason === r.id ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}>
                  <input type="radio" name="reportReason" value={r.id} checked={reason === r.id} onChange={(e) => setReason(e.target.value)} className="accent-rose-600" />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="report-details" className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              {l('توضیحات تکمیلی (اختیاری)', 'Additional details (optional)', 'تفاصيل إضافية (اختياري)', '补充说明（可选）')}
            </label>
            <textarea id="report-details" rows="3" maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={l('جزئیات بیشتر را بنویسید...', 'Provide more details...', 'اكتب المزيد من التفاصيل...', '请描述详细情况...')} className="min-h-24 w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 focus-visible:shadow-[var(--shadow-focus)]" />
          </div>
          <RentoraButton type="submit" variant="danger" loading={submitting} disabled={submitting} className="w-full">
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{l('ارسال گزارش تخلف', 'Submit Report', 'إرسال البلاغ', '提交违规报告')}</span>
          </RentoraButton>
        </form>
      )}
    </RentoraModal>
  );
}
