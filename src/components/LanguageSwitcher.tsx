/**
 * 语言切换组件
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { supportedLanguages, changeLanguage } from '../i18n';

interface LanguageSwitcherProps {
  variant?: 'button' | 'dropdown';
  className?: string;
}

export function LanguageSwitcher({ variant = 'button', className = '' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (langCode: string) => {
    changeLanguage(langCode);
    setIsOpen(false);
  };

  const currentLang = supportedLanguages.find(lang => lang.code === i18n.language) || supportedLanguages[0];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-colors bg-white/40 text-gray-700 hover:bg-white/60 hover:text-gray-900"
      >
        <Globe className="w-4 h-4 text-primary-500" />
        <span>{variant === 'button' ? currentLang.nativeName : t('common.language')}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
          {supportedLanguages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-gray-50 ${
                i18n.language === lang.code ? 'text-primary-600 bg-primary-50' : 'text-gray-700'
              }`}
            >
              <span>{lang.nativeName}</span>
              {i18n.language === lang.code && (
                <Check className="w-4 h-4 text-primary-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
