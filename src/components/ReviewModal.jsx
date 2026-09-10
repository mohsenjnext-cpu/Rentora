import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRentora } from '../context/RentoraContext';
import { 
  X, 
  Star, 
  CheckCircle2, 
  Send 
} from 'lucide-react';

export default function ReviewModal({ rental, isOpen, onClose }) {
  const { lang, dir, t, l } = useLanguage();
  const { addReview } = useRentora();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen || !rental) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    addReview({
      rentalId: rental.id,
      itemId: rental.itemId,
      targetUsername: rental.ownerUsername,
      rating,
      comment
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
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-600 flex items-center justify-center">
              <Star className="w-4 h-4 fill-amber-400 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {t('btnLeaveReview')}
              </h3>
              <p className="text-[10px] text-slate-400 truncate max-w-[220px]">
                {rental.itemTitle}
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

        {/* Body */}
        {submitted ? (
          <div className="p-8 text-center space-y-3 animate-fadeIn">
            <div className="w-12 h-12 mx-auto rounded-full badge-trust text-[#0F6E56] flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-6 h-6 stroke-[2]" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              {l('امتیاز و نظر شما با موفقیت ثبت شد', 'Review Submitted Successfully', 'تم تسجيل تقييمك بنجاح', '评价已成功提交')}
            </h4>
            <p className="text-xs text-slate-500">
              {l('از همراهی شما در ارتقای اعتماد جامعه رنتورا سپاسگزاریم.', 'Thank you for building trust in Rentora community.', 'شكراً لمساهمتك في بناء الثقة داخل مجتمع رنتورا.', '感谢您为 Rentora 社区信用建设做出的贡献。')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
            
            {/* Star Rating Picker */}
            <div className="text-center space-y-2">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                {l('امتیاز شما به کیفیت کالا و همکاری موجر', 'Your rating for item and owner cooperation', 'تقييمك لجودة الغرض وتعامل المؤجر', '请为物品质量及物主配合度评分')}
              </label>

              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1.5 transition transform hover:scale-110 cursor-pointer"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {l('نظر و تجربه شما (اختیاری)', 'Your experience and review (optional)', 'تجربتك وملاحظاتك (اختياري)', '分享您的使用体验（可选）')}
              </label>
              <textarea
                rows="3"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={l('مثال: کالا کاملاً سالم و نو بود و تحویل به‌موقع انجام شد.', 'e.g. Item was in great condition and pickup was smooth.', 'مثال: الجهاز بحالة ممتازة والتسليم كان سلساً وبالموعد.', '例如：物品成色很好，当面交接顺畅。')}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7]"
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-2.5 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Send className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
              <span>{l('ثبت امتیاز و نظر', 'Submit Review', 'إرسال التقييم', '提交评价')}</span>
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
