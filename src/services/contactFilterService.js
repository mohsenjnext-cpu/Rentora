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
  
  // Strip all whitespace, dots, dashes, commas, colons, slashes to reveal hidden numbers
  const strippedSeparators = lowerCase.replace(/[\s\-_.,،;:\\/()[\]{}|@+*#]/g, '');

  // 1. SEQUENCE OF 7 OR MORE DIGITS (Covers all phone and landline numbers)
  if (/\d{7,}/.test(strippedSeparators)) {
    return {
      isViolating: true,
      matchedType: 'phone_digits',
      message: 'جهت امنیت شما و پیشگیری از کلاهبرداری، ارسال شماره تماس قبل از نهایی‌شدن رزرو در چت مسدود است. شماره تماس پس از تایید رزرو خودکار نمایش داده می‌شود.'
    };
  }

  // 2. IRANIAN & INTERNATIONAL PHONE PATTERNS
  const phonePatterns = [
    /(?:(?:\+98|0098|98|0)?9\d{9})/,
    /(?:(?:\+98|0098|98|0)?[1-8]\d{8,9})/,
    /(?:09[0-9]{2}[ -.]?[0-9]{3}[ -.]?[0-9]{4})/,
    /09\d{2}\s*\d{3}\s*\d{4}/,
    /9\d{2}\s*\d{3}\s*\d{4}/
  ];

  for (const regex of phonePatterns) {
    if (regex.test(strippedSeparators) || regex.test(normalized)) {
      return {
        isViolating: true,
        matchedType: 'phone',
        message: 'ارسال شماره تماس مستقیم مجاز نیست. هماهنگی و دریافت شماره تماس پس از ثبت رزرو انجام می‌شود.'
      };
    }
  }

  // 3. SPELLED-OUT PERSIAN NUMBER WORDS & CONTACT INTENT
  const persianNumberWordsRegex = /(صفر|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده|سیزده|چهارده|پانزده|شانزده|هفده|هجده|نوزده|بیست|سی|چهل|پنجاه|شصت|هفتاد|هشتاد|نود|نهصد|دویست|سیصد|چهارصد|پانصد)/i;
  const contactKeywords = ['شماره', 'تماس', 'زنگ', 'خط', 'تلفن', 'واتس', 'تلگرام', 'روبیکا', 'ایتا', 'بله', 'پیامک', 'اس ام اس', 'آیدی', 'ایدی', 'phone', 'call', 'whatsapp', 'telegram', 'contact'];

  const hasContactKeyword = contactKeywords.some(kw => lowerCase.includes(kw));

  if (hasContactKeyword) {
    // If text contains contact intent and either digits or spelled out numbers
    if (/\d{4,}/.test(strippedSeparators) || persianNumberWordsRegex.test(normalized)) {
      return {
        isViolating: true,
        matchedType: 'contact_intent',
        message: 'تبادل اطلاعات تماس یا پیام‌رسان‌های خارجی قبل از رزرو در پلتفرم رنتورا مسدود است.'
      };
    }
  }

  // 4. MESSAGING APPS & SOCIAL MEDIA HANDLES
  const socialPatterns = [
    /(?:تلگرام|telegram|t\.me|tg)[\s:؛=@_-]*[a-zA-Z0-9_]{3,}/i,
    /(?:واتساپ|واتس‌اپ|whatsapp|wa\.me)[\s:؛=@_-]*[0-9a-zA-Z_]{3,}/i,
    /(?:اینستاگرام|اینستا|instagram|insta|ig)[\s:؛=@_-]*[a-zA-Z0-9_.]{3,}/i,
    /(?:روبیکا|rubika)[\s:؛=@_-]*[a-zA-Z0-9_.]{3,}/i,
    /(?:ایتا|eitaa)[\s:؛=@_-]*[a-zA-Z0-9_.]{3,}/i,
    /(?:بله|bale)[\s:؛=@_-]*[a-zA-Z0-9_.]{3,}/i,
    /@(?:[a-zA-Z0-9_]{4,})/i
  ];

  for (const regex of socialPatterns) {
    if (regex.test(normalized) || regex.test(lowerCase)) {
      return {
        isViolating: true,
        matchedType: 'social',
        message: 'ارسال آیدی یا لینک شبکه‌های اجتماعی مجاز نیست. لطفاً تمام هماهنگی‌ها را از طریق چت امن رنتورا انجام دهید.'
      };
    }
  }

  // 5. EMAIL ADDRESSES
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
  if (emailPattern.test(normalized)) {
    return {
      isViolating: true,
      matchedType: 'email',
      message: 'ارسال آدرس ایمیل در گفتگوی قبل از رزرو مجاز نیست.'
    };
  }

  // 6. EXTERNAL URLS
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/i;
  if (urlPattern.test(normalized)) {
    return {
      isViolating: true,
      matchedType: 'url',
      message: 'ارسال لینک‌های خارجی در چت مجاز نمی‌باشد.'
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
