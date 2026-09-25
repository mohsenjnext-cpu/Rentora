import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { cloudSyncService } from '../services/cloudSyncService';
import { 
  X, 
  Send, 
  CheckCircle2, 
  MessageSquare, 
  Mail, 
  HelpCircle,
  Clock,
  Sparkles
} from 'lucide-react';

export default function SupportModal({ isOpen, onClose }) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser } = usePiAuth();
  
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    setIsSubmitted(false);
    setError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || isSubmitting || !message.trim()) return;
    setError('');
    setIsSubmitting(true);
    try {
      await cloudSyncService.submitSupportTicket({ subject, message });
      setIsSubmitted(true);
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err?.message || l('ارسال درخواست پشتیبانی ناموفق بود.', 'Unable to submit support request.', 'تعذر إرسال طلب الدعم.', '提交客服请求失败'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn select-none"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#151426] rounded-2xl w-full max-w-md flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl animate-scaleIn overflow-hidden"
      >
        
        {/* Header */}
        <div className="p-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#26215C] text-white flex items-center justify-center">
              <MessageSquare className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {t('supportTitle')}
              </h3>
              <p className="text-[10px] text-slate-400">
                {t('supportSubtitle')}
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

        {/* Form Body */}
        {!currentUser ? (
          <div className="p-8 text-center space-y-3">
            <HelpCircle className="w-10 h-10 mx-auto text-slate-400" />
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">{l('ورود لازم است', 'Sign in required', 'يلزم تسجيل الدخول', '请先登录')}</h4>
            <p className="text-xs text-slate-500">{l('برای ثبت درخواست پشتیبانی باید وارد حساب Pi خود شوید.', 'Sign in with your Pi account to submit a support request.', 'سجل الدخول بحساب Pi لإرسال طلب دعم.', '请使用您的 Pi 账户登录后提交客服请求。')}</p>
          </div>
        ) : isSubmitted ? (
          <div className="p-8 text-center space-y-3 animate-fadeIn">
            <div className="w-12 h-12 mx-auto rounded-full badge-trust text-[#0F6E56] flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-6 h-6 stroke-[2]" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              {l('پیام شما دریافت شد', 'Message Received', 'تم استلام رسالتك بنجاح', '已收到您的反馈留言')}
            </h4>
            <p className="text-xs text-slate-500">
              {l('تیم پشتیبانی رنتورا در اسرع وقت پاسخگوی شما خواهد بود.', 'Our support team will review your inquiry shortly.', 'سيقوم فريق الدعم بمراجعة رسالتك في أقرب وقت.', 'Rentora 客服团队将尽快为您处理。')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {l('موضوع پیام', 'Subject', 'الموضوع', '主题')}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={l('مثال: سوال درباره تسویه حساب یا گزارش خطا', 'e.g. Payment inquiry or issue report', 'مثال: استفسار عن الدفع أو بلاغ', '例如：关于支付或功能故障咨询')}
                className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {l('متن پیام', 'Message', 'نص الرسالة', '反馈详情')} *
              </label>
              <textarea
                rows="4"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={l('توضیحات کامل خود را اینجا بنویسید...', 'Write your message details here...', 'اكتب تفاصيل استفسارك هنا...', '请在此详细描述您遇到的问题或建议...')}
                className="w-full mt-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7]"
              />
            </div>

            {error && <div role="alert" className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-2.5 text-xs text-red-700 dark:text-red-300">{error}</div>}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed w-full py-2.5 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Send className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                <span>{isSubmitting ? l('در حال ارسال...', 'Sending...', 'جارٍ الإرسال...', '正在提交...') : l('ارسال پیام به پشتیبانی', 'Send Message to Support', 'إرسال الرسالة إلى الدعم', '提交给技术客服')}</span>
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
