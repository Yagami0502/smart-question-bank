/**
 * i18n 国际化配置
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zh from './locales/zh.json';
import en from './locales/en.json';

// 语言资源
const resources = {
  zh: { translation: zh },
  en: { translation: en },
};

// 支持的语言列表
export const supportedLanguages = [
  { code: 'zh', name: '中文', nativeName: '中文' },
  { code: 'en', name: 'English', nativeName: 'English' },
];

// 初始化 i18n
i18n
  .use(LanguageDetector) // 自动检测用户语言
  .use(initReactI18next) // 绑定 react-i18next
  .init({
    resources,
    fallbackLng: 'zh', // 默认语言
    debug: false,
    
    interpolation: {
      escapeValue: false, // React 已经处理了 XSS
    },
    
    detection: {
      // 语言检测顺序
      order: ['localStorage', 'navigator', 'htmlTag'],
      // 缓存用户选择的语言
      caches: ['localStorage'],
      // localStorage key
      lookupLocalStorage: 'mindforge_language',
    },
  });

// 切换语言
export const changeLanguage = (lng: string) => {
  i18n.changeLanguage(lng);
  // 更新 HTML lang 属性
  document.documentElement.lang = lng;
};

// 获取当前语言
export const getCurrentLanguage = () => i18n.language;

export default i18n;
