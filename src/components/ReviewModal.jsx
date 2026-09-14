import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRentora } from '../context/RentoraContext';
import { 
  X, 
  Star, 
  CheckCircle2, 
  Send,
  Loader2,
  AlertCircle,
  Clock,
  ShieldCheck
} from 'lucide-react';

export default function ReviewModal({ rental, isOpen, onClose, onReviewSubmitted }) {
  const { lang, dir, t, l } = useLanguage();
  const { fetchRentalReviewStatus, submitRentalReview } = useRentora();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewStatus, setReviewStatus] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen || !rental?.id) {
      setReviewStatus(null);
      setErrorMsg(null);
      setSubmitted(false);
      setComment('');
      setRating(5);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    fetchRentalReviewStatus(rental.id)
      .then((data) => {
        if (isMounted) {
          setReviewStatus(data);
          if (data.myReview) {
            setRating(data.myReview.rating);
            setComment(data.myReview.reviewText || '');
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMsg(err?.message || l('خطا در دریافت وضعیت نظرسنجی', 'Failed to load review status', 'فشل في تحميل حالة التقييم', '加载评价状态失败'));
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [isOpen, rental?.id]);

  if (!isOpen || !rental) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setErrorMsg(l('امتیاز باید بین ۱ تا ۵ ستاره باشد', 'Rating must be between 1 and 5 stars', 'يجب أن يكون التقييم بين 1 و 5 نجوم', '评分必须在1到5星之间'));
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await submitRentalReview(rental.id, {
        rating: Number(rating),
        reviewText: comment.trim()
      });
      setSubmitted(true);
      if (typeof onReviewSubmitted === 'function') {
        onReviewSubmitted();
      }
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch (err) {
      setErrorMsg(err?.message || l('خطا در ثبت نظر', 'Failed to submit review', 'فشل في إرسال التقييم', '提交评价失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const isEligible = reviewStatus?.isEligible;
  const hasUserReviewed = reviewStatus?.hasUserReviewed;
  const otherParty = reviewStatus?.otherParty;

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
                {rental.itemTitle || reviewStatus?.listingTitle || rental.title || ''}
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
        {loading ? (
          <div className="p-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto text-[#534AB7] animate-spin" />
            <p className="text-xs text-slate-500">
              {l('در حال بررسی وضعیت رزرو...', 'Checking rental status...', 'جارٍ التحقق من حالة الحجز...', '正在检查租赁状态...')}
            </p>
          </div>
        ) : submitted ? (
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
        ) : !isEligible ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              {l('امکان ثبت نظر پس از اتمام اجاره', 'Review Available After Rental Completion', 'التقييم متاح بعد اكتمال الإيجار', '租赁完成后方可评价')}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              {l(
                'تنها پس از تحویل نهایی کالا و تایید پایان سفر اجاره، طرفین می‌توانند به یکدیگر امتیاز و نظر دهند.',
                'Ratings and reviews are unlocked exclusively after the rental is fully completed and verified.',
                'يتاح التقييم حصراً بعد تأكيد إرجاع الغرض واكتمال عملية الإيجار بنجاح.',
                '仅在物品确认归还且租赁订单完全结束后才可互相评价。'
              )}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary w-full py-2 text-xs font-bold"
              >
                {l('متوجه شدم', 'Got it', 'فهمت ذلك', '知道了')}
              </button>
            </div>
          </div>
        ) : hasUserReviewed ? (
          <div className="p-6 space-y-4 text-xs">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{l('شما قبلاً نظر خود را برای این رزرو ثبت کرده‌اید.', 'You have already submitted a review for this rental.', 'لقد قمت بتقييم هذا الحجز مسبقاً.', '您已为此租赁订单提交过评价。')}</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-150 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {l('امتیاز ثبت‌شده شما:', 'Your Submitted Rating:', 'تقييمك المسجل:', '您的评分：')}
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= (reviewStatus?.myReview?.rating || 0)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {reviewStatus?.myReview?.reviewText && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 text-[11px] block mb-1">
                    {l('متن نظر شما:', 'Your Comment:', 'تعليقك:', '您的评语：')}
                  </span>
                  <p className="text-slate-800 dark:text-slate-200 bg-white dark:bg-[#151426] p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    {reviewStatus.myReview.reviewText}
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-secondary w-full py-2 text-xs font-bold"
            >
              {l('بستن', 'Close', 'إغلاق', '关闭')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Star Rating Picker */}
            <div className="text-center space-y-2">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                {otherParty?.displayName || otherParty?.username
                  ? l(`امتیاز شما به تجربه همکاری با ${otherParty.displayName || otherParty.username}:`, `Your rating for cooperation with ${otherParty.displayName || otherParty.username}:`, `تقييمك لتجربة التعامل مع ${otherParty.displayName || otherParty.username}:`, `您对与 ${otherParty.displayName || otherParty.username} 合作的评分：`)
                  : l('امتیاز شما به کیفیت کالا و همکاری طرف مقابل:', 'Your rating for item and cooperation:', 'تقييمك لجودة الغرض وتعامل الطرف الآخر:', '您对物品质量及配合度的评分：')}
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
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                {rating} {l('از ۵ ستاره', 'of 5 stars', 'من 5 نجوم', '星（共5星）')}
              </span>
            </div>

            {/* Comment */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  {l('نظر و تجربه شما (اختیاری)', 'Your experience and review (optional)', 'تجربتك وملاحظاتك (اختياري)', '分享您的使用体验（可选）')}
                </label>
                <span className="text-[10px] text-slate-400">
                  {comment.length}/1000
                </span>
              </div>
              <textarea
                rows="3"
                maxLength={1000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={l('مثال: کالا کاملاً سالم و نو بود و تحویل به‌موقع انجام شد.', 'e.g. Item was in great condition and pickup was smooth.', 'مثال: الجهاز بحالة ممتازة والتسليم كان سلساً وبالموعد.', '例如：物品成色很好，当面交接顺畅。')}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#534AB7]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-2.5 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                  <span>{l('ثبت امتیاز و نظر', 'Submit Review', 'إرسال التقييم', '提交评价')}</span>
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
