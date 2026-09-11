/**
 * Rentora Anti-Bypass & Security Filter Service (Strict Ultra Mode)
 * 
 * Unconditionally blocks ANY off-platform contact information:
 * - Phone numbers (English, Persian, Arabic, spaced, dotted, spelled out)
 * - Messengers (Telegram, WhatsApp, Instagram, Rubika, Eitaa, Bale, Soroush, Gap, Twitter/X)
 * - Handles, IDs, Usernames with or without @
 * - Contact intent (شماره, تماس, زنگ, تلفن, موبایل, پیامک, دایرکت, اکانت, پیج)
 * - Emails and External URLs
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
  // Convert Persian & Arabic numbers to English
  normalized = normalized.replace(/[۰-۹٠-٩]/g, (digit) => PERSIAN_ARABIC_DIGITS[digit] || digit);
  // Remove zero-width spaces and non-standard whitespace
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF\u00A0\u180E\u2000-\u200A]/g, ' ');
  // Replace multiple whitespace with single space
  normalized = normalized.replace(/\s+/g, ' ');
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
  
  // Stripped version without any separators for concatenated checks
  const strippedSeparators = lowerCase.replace(/[\s\-_.,،;:\\/()[\]{}|+*#~`!?"'<>@$^&=]/g, '');

  // 1. MESSENGERS & SOCIAL NETWORKS (Strict list)
  const messengerKeywords = [
    'تلگرام', 'تلگ', 'تگرام', 'تله‌گرام', 'تله گرام',
    'واتساپ', 'واتس‌اپ', 'واتس اپ', 'واتسپ', 'واتس‌آپ', 'واتس آپ', 'واتس',
    'اینستاگرام', 'اینستا', 'اینستام', 'اینستات', 'اینستامو', 'اینستاتو',
    'توییتر', 'تویتر', 'روبیکا', 'روبیکام', 'روبیکات',
    'ایتا', 'ایتاء', 'ایتام', 'ایتات', 'بله', 'سروش', 'شاد', 'گپ', 'آی‌گپ', 'ایگپ',
    'telegram', 'tg', 't.me', 'whatsapp', 'wa.me', 'instagram', 'insta',
    'twitter', 'rubika', 'eitaa', 'bale', 'soroush', 'gap'
  ];

  for (const keyword of messengerKeywords) {
    if (lowerCase.includes(keyword) || strippedSeparators.includes(keyword.replace(/\s+/g, ''))) {
      return {
        isViolating: true,
        matchedType: 'messenger',
        message: `ارسال پیام‌رسان یا شبکه اجتماعی (${keyword}) قبل از ثبت رزرو مسدود است. لطفاً گفتگو را درون رنتورا ادامه دهید.`
      };
    }
  }

  // 2. ID / USERNAME / HANDLE / ACCOUNT KEYWORDS
  const handleKeywords = [
    'آیدی', 'ایدی', 'ای دی', 'آی دی', 'ایدیم', 'آیدیم', 'آیدیت', 'ایدیت', 'آیدیمو', 'ایدیمو',
    'اکانت', 'اکانتم', 'اکانتت', 'پیج', 'پیجم', 'پیجت', 'پیجمو', 'پیجتو',
    'کانال', 'چنل', 'چنلم', 'دایرکت', 'دایرکتم', 'دایرکتت',
    'username', 'user id', 'userid', 'handle', 'dm me', 'direct me'
  ];

  for (const keyword of handleKeywords) {
    if (lowerCase.includes(keyword) || strippedSeparators.includes(keyword.replace(/\s+/g, ''))) {
      return {
        isViolating: true,
        matchedType: 'handle',
        message: `ارسال (${keyword}) قبل از نهایی‌شدن رزرو مجاز نمی‌باشد.`
      };
    }
  }

  // 3. ANY '@' CHARACTER (Handle / Mentions)
  if (lowerCase.includes('@')) {
    return {
      isViolating: true,
      matchedType: 'at_handle',
      message: 'ارسال آیدی یا کاراکتر @ قبل از تایید رزرو کالا مسدود است.'
    };
  }

  // 4. PHONE & CALL INTENT KEYWORDS
  const contactIntentKeywords = [
    'شماره', 'شمارم', 'شمارمو', 'شمارت', 'شمارتو', 'شماره تماس', 'شماره تلفن', 'شماره بدم', 'شماره بده',
    'تلفن', 'تلفنم', 'تلفنت', 'موبایل', 'موبایلم', 'موبایلت',
    'تماس بگیرید', 'تماس بگیر', 'تماس بگیرین', 'تماس بگیریم',
    'زنگ بزن', 'زنگ بزنید', 'زنگ بزنین', 'پیامک بده', 'اس ام اس بده', 'اس‌ام‌اس', 'اس ام اس',
    'call me', 'phone number', 'contact me', 'text me'
  ];

  for (const keyword of contactIntentKeywords) {
    if (lowerCase.includes(keyword) || strippedSeparators.includes(keyword.replace(/\s+/g, ''))) {
      return {
        isViolating: true,
        matchedType: 'contact_intent',
        message: 'تبادل اطلاعات تماس در چت مسدود است. شماره تلفن موجر پس از پرداخت کارمزد به‌صورت خودکار نمایش می‌یابد.'
      };
    }
  }

  // 5. DIGIT SEQUENCES (Any sequence of 5 or more digits)
  if (/\d{5,}/.test(strippedSeparators)) {
    return {
      isViolating: true,
      matchedType: 'phone_digits',
      message: 'ارسال شماره تماس و ارقام در چت مجاز نیست.'
    };
  }

  // 6. IRANIAN PHONE NUMBER PREFIXES (09..., 9...)
  if (/09\d{2}/.test(strippedSeparators) || /989\d{2}/.test(strippedSeparators)) {
    return {
      isViolating: true,
      matchedType: 'phone_prefix',
      message: 'ارسال شماره موبایل در چت مسدود است.'
    };
  }

  // 7. SPELLED-OUT PERSIAN DIGITS
  const persianNumberWordsRegex = /(صفر|نه|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نهصد|دویست|سیصد|چهارصد|پانصد|شصت|هفتاد|هشتاد|نود)/i;
  if (persianNumberWordsRegex.test(normalized) && (normalized.includes('نه') || normalized.includes('یک') || normalized.includes('دو') || normalized.includes('سه') || normalized.includes('چهار') || normalized.includes('پنج') || normalized.includes('شش') || normalized.includes('هفت') || normalized.includes('هشت') || normalized.includes('صفر'))) {
    // Check if at least 2 number words appear
    const matches = normalized.match(/(صفر|نه|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نهصد|دویست|سیصد|چهارصد|پانصد|شصت|هفتاد|هشتاد|نود)/g);
    if (matches && matches.length >= 2) {
      return {
        isViolating: true,
        matchedType: 'phone_words',
        message: 'نوشتن شماره تماس به صورت حروفی در چت مجاز نیست.'
      };
    }
  }

  // 8. EMAIL ADDRESSES
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
  if (emailPattern.test(normalized)) {
    return {
      isViolating: true,
      matchedType: 'email',
      message: 'ارسال آدرس ایمیل مجاز نمی‌باشد.'
    };
  }

  // 9. EXTERNAL URLS & DOMAINS
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|ir|org|net|me|io|info|app|link|site|xyz|online))/i;
  if (urlPattern.test(normalized)) {
    return {
      isViolating: true,
      matchedType: 'url',
      message: 'ارسال لینک‌های خارجی و آدرس وب‌سایت در چت مجاز نمی‌باشد.'
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
