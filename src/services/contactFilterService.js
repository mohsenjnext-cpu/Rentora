/**
 * Rentora Anti-Bypass & Security Filter Service
 * 
 * Protects users against disintermediation, fraud, off-platform scams,
 * and premature exchange of contact information (Phone, Telegram, Instagram, 
 * WhatsApp, Rubika, Eitaa, Bale, Email, External URLs).
 */

const PERSIAN_ARABIC_DIGITS = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';

  let normalized = text;
  normalized = normalized.replace(/[۰-۹٠-٩]/g, (digit) => PERSIAN_ARABIC_DIGITS[digit] || digit);
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  return normalized;
}

export function containsPhoneNumber(rawText) {
  if (!rawText || !rawText.trim()) return false;
  const result = inspectMessageSafety(rawText);
  return result.isViolating;
}

export function inspectMessageSafety(rawText) {
  if (!rawText || !rawText.trim()) {
    return { isViolating: false };
  }

  const normalized = normalizeText(rawText);
  const lowerCase = normalized.toLowerCase();
  
  const strippedSeparators = lowerCase.replace(/[\s\-_.,،;:\\/()[\]{}|]/g, '');

  // 1. PHONE NUMBER DETECTION
  const phonePatterns = [
    /(?:(?:\+98|0098|98|0)?9\d{9})/,
    /(?:(?:\+98|0098|98|0)?[1-8]\d{9})/,
    /(?:09[0-9]{2}[ -.]?[0-9]{3}[ -.]?[0-9]{4})/
  ];

  for (const regex of phonePatterns) {
    if (regex.test(strippedSeparators) || regex.test(normalized)) {
      return {
        isViolating: true,
        matchedType: 'phone',
        message: 'جهت حفظ امنیت و هماهنگی دقیق تحویل حضوری، شماره تماس پس از تایید رزرو به‌صورت خودکار در اختیارتان قرار می‌گیرد.'
      };
    }
  }

  // Detect Spelled-Out Persian Digits
  const persianNumberWordsRegex = /(صفر|نه|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نهصد|دویست|سیصد|چهارصد|پانصد|شصت|هفتاد|هشتاد|نود)[\s‌]+(نه|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نود|دوازده|سیزده|چهارده|پانزده|شانزده|هفده|هجده|نوزده)/i;
  if (persianNumberWordsRegex.test(normalized) && (normalized.includes('تماس') || normalized.includes('شماره') || normalized.includes('زنگ') || normalized.includes('خط'))) {
    return {
      isViolating: true,
      matchedType: 'phone_words',
      message: 'تبادل شماره تماس خارج از سیستم رنتورا مجاز نیست.'
    };
  }

  // 2. EMAIL ADDRESSES
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
  if (emailPattern.test(normalized)) {
    return {
      isViolating: true,
      matchedType: 'email',
      message: 'ارسال ایمیل مجاز نیست. جهت حفظ امنیت از گفتگوی درون برنامه استفاده نمایید.'
    };
  }

  // 3. TELEGRAM DETECTION
  const telegramPatterns = [
    /t\.me\/[a-zA-Z0-9_+]{3,}/i,
    /telegram\.me\/[a-zA-Z0-9_+]{3,}/i,
    /(?:تلگرام[مهت]?|telegram|tg)[\s:؛=@_-]*[a-zA-Z0-9_]{3,}/i
  ];

  for (const regex of telegramPatterns) {
    if (regex.test(normalized)) {
      return {
        isViolating: true,
        matchedType: 'telegram',
        message: 'ارسال آیدی تلگرام قبل از رزرو مسدود است.'
      };
    }
  }

  // 4. INSTAGRAM DETECTION
  const instagramPatterns = [
    /instagram\.com\/[a-zA-Z0-9_.]+/i,
    /(?:اینستاگرام[مهت]?|اینستا[مهت]?|instagram|insta|ig)[\s:؛=@_-]*[a-zA-Z0-9_.]{3,}/i
  ];

  for (const regex of instagramPatterns) {
    if (regex.test(normalized)) {
      return {
        isViolating: true,
        matchedType: 'instagram',
        message: 'ارسال پیج اینستاگرام در چت مجاز نیست.'
      };
    }
  }

  // 5. EXTERNAL LINKS
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/i;
  if (urlPattern.test(normalized)) {
    return {
      isViolating: true,
      matchedType: 'url',
      message: 'ارسال پیوندها و لینک‌های خارجی در چت مجاز نمی‌باشد.'
    };
  }

  return { isViolating: false };
}

export const QUICK_QUESTIONS = [
  {
    id: 'available',
    fa: 'سلام، آیا کالا هم‌اکنون موجود است؟',
    en: 'Hi, is this item currently available?',
    ar: 'مرحباً، هل هذا الغرض متاح الآن؟',
    zh: '您好，请问该物品目前可租吗？'
  },
  {
    id: 'handover_today',
    fa: 'امکان تحویل حضوری در امروز هست؟',
    en: 'Can we arrange in-person pickup today?',
    ar: 'هل يمكن التسليم والاستلام اليوم؟',
    zh: '今天方便安排当面交接吗？'
  },
  {
    id: 'condition',
    fa: 'آیا کالا کاملاً سالم و تست‌شده است؟',
    en: 'Is the item in working condition and tested?',
    ar: 'هل الجهاز سليم ومفحوص بالكامل؟',
    zh: '物品功能完好且经过测试了吗？'
  },
  {
    id: 'deposit',
    fa: 'ودیعه ضمانت چقدر است و چگونه دریافت می‌شود؟',
    en: 'What is the deposit and how is it settled?',
    ar: 'كم مبلغ التأمين وكيف يتم دفعه؟',
    zh: '押金金额是多少，如何当面结算？'
  },
  {
    id: 'extend',
    fa: 'شرایط تمدید مدت اجاره چگونه است؟',
    en: 'What are the terms for extending rental duration?',
    ar: 'ما هي شروط تمديد فترة الإيجار؟',
    zh: '如需续租有什么要求和流程吗？'
  }
];
