import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  X, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  KeyRound,
  FileCheck
} from 'lucide-react';

export default function SecurityModal({ isOpen, onClose }) {
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
            <div className="w-8 h-8 rounded-lg badge-trust text-[#0F6E56] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {t('securityTitle')}
              </h3>
              <p className="text-[10px] text-slate-400">
                {l('استانداردهای امنیتی و حفاظت از اطلاعات پیشگامان', 'Security standards and Pioneer data protection', 'معايير الأمان وحماية بيانات رواد باي', '安全规范与 Pi 先锋隐私保护')}
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
          
          <div className="p-3.5 rounded-xl badge-trust space-y-1.5">
            <div className="font-bold text-[#0F6E56] flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-[#0F6E56] stroke-[2]" />
              <span>{l('احراز هویت غیرمتمرکز با Pi SDK', 'Decentralized Pi SDK Authentication', 'توثيق غير مركزي عبر Pi SDK', '基于 Pi SDK 的去中心化原生鉴权')}</span>
            </div>
            <p className="text-[#0F6E56]/90 dark:text-slate-300 leading-relaxed text-[11px]">
              {l(
                'رنتورا هرگز رمز عبور یا کلمات بازیابی کیف پول شما را ذخیره نمی‌کند. ورود و پرداخت‌ها مستقیماً با SDK رسمی شبکه پای و با امضای دیجیتال خود شما انجام می‌پذیرد.',
                'Rentora never stores passwords or wallet passphrases. Logins and payments are securely verified directly via official Pi Network SDK.',
                'لا تخزن رنتورا أي كلمات مرور أو عبارات استرداد. تتم عمليات تسجيل الدخول والدفع مباشرة وموثقة عبر Pi SDK الرسمي.',
                'Rentora 绝不保存密码或钱包助记词，所有登录和支付均由 Pi Network 官方 SDK 原生签名完成。'
              )}
            </p>
          </div>

          <div className="p-3.5 rounded-xl banner-purple space-y-1.5">
            <div className="font-bold text-[#26215C] dark:text-[#EEEDFE] flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-[#534AB7] stroke-[2]" />
              <span>{l('رسید و تایید دوطرفه تحویل', 'Two-Way Handover Confirmation', 'التأكيد المتبادل والوصل الرقمي', '双向确认与无争议交接')}</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
              {l(
                'تمامی مراحل تحویل و بازگشت کالا همراه با تاریخچه دقیق وضعیت و امضای الکترونیکی مستأجر و موجر ثبت می‌گردد.',
                'Every handover and return step is logged transparently with status history and user confirmations.',
                'يتم تسجيل كل خطوة من خطوات التسليم والإرجاع بشفافية وسجل إلكتروني واضح يضمن حقوق الطرفين.',
                '物品交付与归还的每个步骤均拥有完整且透明的状态流转与电子确认记录。'
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
            {l('بستن', 'Close', 'إغلاق', '关闭')}
          </button>
        </div>

      </div>
    </div>
  );
}
