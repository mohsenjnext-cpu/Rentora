import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  X, 
  HelpCircle, 
  ShieldCheck, 
  Coins, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Clock
} from 'lucide-react';

export default function HelpCenterModal({ isOpen, onClose }) {
  const { lang, dir, t, l } = useLanguage();

  if (!isOpen) return null;

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn select-none"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#151426] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl animate-scaleIn overflow-hidden"
      >
        
        {/* Header */}
        <div className="p-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#26215C] text-white flex items-center justify-center">
              <HelpCircle className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {t('helpRulesTitle')}
              </h3>
              <p className="text-[10px] text-slate-400">
                {l('راهنما، قوانین و حریم خصوصی رنتورا', 'Guide, terms and security policies', 'دليل الاستخدام وقوانين منصة رنتورا', 'Rentora 使用指南、租赁规则与安全条例')}
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
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* 1. Payment Split Explanation */}
          <div className="p-3.5 rounded-xl banner-purple space-y-1.5">
            <div className="font-bold text-[#26215C] dark:text-[#EEEDFE] flex items-center gap-1.5 text-xs sm:text-sm">
              <Coins className="w-4 h-4 text-[#534AB7] stroke-[2]" />
              <span>{l('ساختار تسویه و تفکیک پرداخت', 'Payment Split Structure', 'هيكلية تقسيم الدفع', '结算与费用拆分结构')}</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
              {l(
                'در رنتورا، کارمزد پلتفرم بصورت آنلاین از طریق کیف پول پای (Pi Wallet) در لحظه رزرو پرداخت می‌گردد. اصل مبلغ اجاره و ودیعه ضمانت، مستقیماً بصورت حضوری و نقدی هنگام تحویل کالا بین موجر و مستأجر مبادله می‌شود.',
                'On Rentora, platform fee is paid online via Pi Wallet upon booking. Daily rental fee and security deposit are exchanged directly in cash in-person at item pickup.',
                'في رنتورا، يتم دفع عمولة المنصة إلكترونياً عبر محفظة باي عند الحجز. ويتم دفع الإيجار والتأمين نقداً ويداً بيد عند استلام الغرض.',
                '在 Rentora，平台技术服务费在预订时通过 Pi 钱包在线支付；租金和押金则在当面交接验机时线下直接结算。'
              )}
            </p>
          </div>

          {/* 2. Direct Handover & Receipt */}
          <div className="p-3.5 rounded-xl badge-trust space-y-1.5">
            <div className="font-bold text-[#0F6E56] flex items-center gap-1.5 text-xs sm:text-sm">
              <ShieldCheck className="w-4 h-4 text-[#0F6E56] stroke-[2]" />
              <span>{l('فرایند تحویل حضوری و رسید دیجیتال', 'Handover Process & Digital Receipt', 'عملية الاستلام والتسليم والوصل الرقمي', '当面交接与电子回执流程')}</span>
            </div>
            <p className="text-[#0F6E56]/90 dark:text-slate-300 leading-relaxed text-[11px]">
              {l(
                'هنگام تحویل کالا، مستأجر با کلیک روی دکمه «تایید دریافت کالا در محل تحویل» تحویل سالم کالا را تایید می‌کند. پس از اتمام دوره اجاره، موجر با کلیک روی «تایید بازگشت کالا و عودت ودیعه» پایان موفق اجاره و بازگرداندن ودیعه نقدی را ثبت می‌نماید.',
                'At pickup, renter taps "Confirm Item Handover at Pickup". After rental period, owner taps "Confirm Return & Refund Deposit" to close the rental and return cash deposit.',
                'عند الاستلام، يضغط المستأجر على زر "تأكيد استلام الغرض". وبعد انتهاء الإيجار، يؤكد المؤجر استلام الغرض وإرجاع التأمين بضغطة زر واحدة.',
                '取件时租客一键点击“现场确认已收到物品”；归还时房东一键点击“确认安全归还并结清押金”，生成完整数字回执。'
              )}
            </p>
          </div>

          {/* 3. KYC Pioneer Network */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#534AB7]" />
              <span>{l('اعتبارسنجی پیشگامان (KYC Verified)', 'KYC Verified Pioneers', 'توثيق الهوية لرواد باي', 'Pi Network 先锋 KYC 认证体系')}</span>
            </h4>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
              {l(
                'تنها کاربران احرازهویت‌شده با حساب رسمی شبکه پای امکان ثبت آگهی و رزرو وسایل را دارند. نشان سبز KYC نمایانگر کاربر معتبر در اکوسیستم بلاکچین پای است.',
                'Only authenticated users with official Pi accounts can post listings and book rentals. The green KYC badge denotes a verified network participant.',
                'يحق فقط للمستخدمين الموثقين بحساب باي الرسمي نشر الإعلانات واستئجار الأجهزة، وتدل العلامة الخضراء على الحسابات الموثقة.',
                '仅持有官方 Pi 账户的实名认证先锋可发布及租赁物品，绿色认证勋章确保交易双方真实可信。'
              )}
            </p>
          </div>

          {/* 4. Pro VIP Membership */}
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-500" />
              <span>{l('اشتراک موجر طلایی (Rentora Pro VIP)', 'Rentora Pro VIP Subscription', 'اشتراك المؤجر الذهبي Pro', '黄金 Pro VIP 房东会员权益')}</span>
            </h4>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
              {l(
                'موجران می‌توانند تا ۳ آگهی را بصورت کاملاً رایگان ثبت کنند. برای ثبت نامحدود وسایل و بهره‌مندی از کارمزد صفر درصد، اشتراک ویژه ۳۰ روزه Pro VIP با پرداخت پای قابل فعال‌سازی است.',
                'Owners can list up to 3 items completely free. For unlimited listings and 0% commission, the 30-day Pro VIP plan can be activated with Pi.',
                'يمكن للمؤجرين نشر حتى 3 إعلانات مجاناً. ولنشر غير محدود والاستفادة من 0% عمولة، يمكن تفعيل باقة Pro VIP لمدة 30 يوماً بعملة باي.',
                '房东可免费发布最多 3 件闲置物品；升级 30 天黄金 Pro VIP 即可解锁无限发布特权与 0% 平台服务费。'
              )}
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-[#1A1930]/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-primary px-5 py-2 text-xs font-bold cursor-pointer"
          >
            {l('متوجه شدم', 'Got it', 'فهمت ذلك', '我知道了')}
          </button>
        </div>

      </div>
    </div>
  );
}
