/**
 * Rentora Anti-Bypass & Security Filter Service (Strict Mode)
 * 
 * Unconditionally blocks off-platform contact leaks:
 * Phone numbers, Telegram, WhatsApp, Instagram, Rubika, Eitaa, Bale,
 * ID / Handles, Usernames with @, Emails, External Links, and Direct Contact Requests.
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
  // Remove zero-width spaces, joiners, and control characters
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ');
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
  
  // Clean text without separator characters for hidden pattern inspection
  const strippedSeparators = lowerCase.replace(/[\s\-_.,،;:\\/()[\]{}|+*#~`!?"'<>]/g, '');

  // 1. BLOCKED MESSENGERS & SOCIAL NETWORKS (Unconditional strict block)
  const messengerKeywords = [
    'تلگرام', 'تلگ', 'واتساپ', 'واتس‌اپ', 'واتس اپ', 'واتساپم', 'واتس',
    'اینستاگرام', 'اینستا', 'اینستام', 'اینستامو', 'توییتر', 'تویتر',
    'روبیکا', 'ایتا', 'ایتاء', 'بله', 'سروش', 'شاد', 'گپ', 'آی‌گپ', 'ایگپ',
    'telegram', 'tg', 't.me', 'whatsapp', 'wa.me', 'instagram', 'insta',
    'twitter', 'rubika', 'eitaa', 'bale', 'soroush', 'gap'
  ];

  for (const keyword of messengerKeywords) {
    if (lowerCase.includes(keyword) || strippedSeparators.includes(keyword.replace(/\s+/g, ''))) {
      return {
        isViolating: true,
        matchedType: 'messenger',
        message: `ارسال پیام‌رسان یا شبکه اجتماعی (${keyword}) در گفتگوی قبل از رزرو مسدود است. لطفاً تمام هماهنگی‌ها را از طریق چت امن رنتورا انجام دهید.`
      };
    }
  }

  // 2. BLOCKED ID / USERNAME / HANDLE KEYWORDS
  const handleKeywords = [
    'آیدی', 'ایدی', 'ای دی', 'آی دی', 'ایدیم', 'آیدیم', 'آیدیمو', 'ایدیمو',
    'اکانت', 'اکانتم', 'پیج', 'پیجم', 'کانال', 'چنل', 'دایرکت', 'دایرکتم',
    'username', 'user id', 'userid', 'handle', 'dm me', 'direct me'
  ];

  for (const keyword of handleKeywords) {
    if (lowerCase.includes(keyword)) {
      return {
        isViolating: true,
        matchedType: 'handle',
        message: 'ارسال آیدی، پیج یا اکانت در گفتگوی قبل از رزرو مجاز نیست. گفتگو فقط در پلتفرم رنتورا مجاز است.'
      };
    }
  }

  // 3. ANY '@' USERNAME OR HANDLE MENTION
  if (/@[\w\u0600-\u06FF]{2,}/.test(normalized) || lowerCase.includes('@')) {
    return {
      isViolating: true,
      matchedType: 'at_handle',
      message: 'ارسال آیدی با علامت @ قبل از ثبت رزرو کالا مسدود است.'
    };
  }

  // 4. CALL / CONTACT INTENT KEYWORDS
  const contactIntentKeywords = [
    'شماره', 'شمارم', 'شمارمو', 'شمارمو بدم', 'شماره تماس', 'شماره بده',
    'تلفن', 'تلفنم', 'موبایل', 'موبایلم', 'تماس بگیرید', 'تماس بگیر', 'تماس بگیرین',
    'زنگ بزن', 'زنگ بزنید', 'پیامک بده', 'اس ام اس بده', 'اس‌ام‌اس',
    'call me', 'phone number', 'contact me', 'text me'
  ];

  for (const keyword of contactIntentKeywords) {
    if (lowerCase.includes(keyword)) {
      return {
        isViolating: true,
        matchedType: 'contact_intent',
        message: 'تبادل اطلاعات تماس در چت مسدود است. شماره تلفن طرفین پس از رزرو به‌صورت خودکار در اختیارتان قرار می‌گیرد.'
      };
    }
  }

  // 5. DIGIT SEQUENCES (Any sequence of 6 or more digits anywhere in message)
  if (/\d{6,}/.test(strippedSeparators)) {
    return {
      isViolating: true,
      matchedType: 'phone_digits',
      message: 'ارسال شماره تماس و ارقام طولانی در چت مجاز نیست. شماره هماهنگی پس از تایید رزرو فعال خواهد شد.'
    };
  }

  // 6. IRANIAN PHONE PATTERNS (09..., +989..., 989...)
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
        message: 'ارسال شماره همراه در چت مسدود است.'
      };
    }
  }

  // 7. SPELLED-OUT PERSIAN DIGITS (نهصد و دوازده، صفر نه...)
  const persianNumberWordsRegex = /(صفر|نه|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نهصد|دویست|سیصد|چهارصد|پانصد|شصت|هفتاد|هشتاد|نود)[\s‌]+(نه|یک|دو|سه|چهار|پنج|شش|هفت|هشت|نود|دوازده|سیزده|چهارده|پانزده|شانزده|هفده|هجده|نوزده)/i;
  if (persianNumberWordsRegex.test(normalized)) {
    return {
      isViolating: true,
      matchedType: 'phone_words',
      message: 'نوشتن شماره تماس به صورت حروفی در چت مجاز نمی‌باشد.'
    };
  }

  // 8. EMAIL ADDRESSES
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
  if (emailPattern.test(normalized)) {
    return {
      isViolating: true,
      matchedType: 'email',
      message: 'ارسال آدرس ایمیل در گفتگوی قبل از رزرو مجاز نیست.'
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
