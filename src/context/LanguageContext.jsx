import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../locales/translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return (typeof localStorage !== 'undefined' ? localStorage.getItem('rentora_lang') : null) || 'fa';
    } catch (e) {
      return 'fa';
    }
  });

  const dir = (lang === 'fa' || lang === 'ar') ? 'rtl' : 'ltr';

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('rentora_lang', lang);
      }
    } catch (e) {}

    try {
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.setAttribute('dir', dir);
        document.documentElement.setAttribute('lang', lang);
      }
    } catch (e) {}
  }, [lang, dir]);

  const t = (key, params = {}) => {
    let text = translations[lang]?.[key] || translations['en']?.[key] || translations['fa']?.[key] || key;
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), paramVal);
      });
    }
    return text;
  };

  /**
   * Universal Localized String Helper
   * Allows passing 4 language strings or an object { fa, en, ar, zh }
   */
  const l = (faStr, enStr, arStr, zhStr) => {
    if (typeof faStr === 'object' && faStr !== null) {
      return faStr[lang] || faStr['en'] || faStr['fa'] || '';
    }
    if (lang === 'fa') return faStr;
    if (lang === 'ar') return arStr || faStr;
    if (lang === 'zh') return zhStr || enStr || faStr;
    return enStr || faStr;
  };

  const changeLanguage = (newLang) => {
    if (['fa', 'en', 'ar', 'zh'].includes(newLang)) {
      setLang(newLang);
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, dir, t, l, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
