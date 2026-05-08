/**
 * 登录/注册页面 - 液态玻璃风格
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react';
import Button from '../components/ui/Button';
import { login, register } from '../lib/auth';
import type { User as UserType } from '../lib/auth';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

interface LoginPageProps {
  onLoginSuccess: (user: UserType) => void;
}

type AuthMode = 'login' | 'register';

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError(t('auth.usernameRequired'));
      return;
    }
    if (!password) {
      setError(t('auth.passwordRequired'));
      return;
    }

    if (mode === 'register') {
      if (!email.trim()) {
        setError(t('auth.emailRequired'));
        return;
      }
      if (password !== confirmPassword) {
        setError(t('auth.passwordMismatch'));
        return;
      }
      if (password.length < 6) {
        setError(t('auth.passwordTooShort'));
        return;
      }
    }

    setIsLoading(true);
    try {
      let user: UserType;
      if (mode === 'login') {
        user = await login(username, password);
      } else {
        user = await register(username, email, password, nickname || undefined);
      }
      onLoginSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* 语言切换按钮 */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      
      {/* 液态玻璃登录卡片 */}
      <div
        className="liquid-glass-wrapper liquid-glass-modal w-full max-w-md fade-in"
        style={{ '--border-radius': '24px' } as React.CSSProperties}
      >
        <div className="liquid-glass-outer" />
        <div className="liquid-glass-cover" />
        <div className="liquid-glass-sharp" />
        <div className="liquid-glass-reflect" />
        <div className="liquid-glass-content p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden">
              <img src="/favicon.ico" alt="MindForge" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">MindForge</h1>
            <p className="text-sm mt-1 text-gray-600">
              {mode === 'login' ? t('auth.loginToAccount') : t('auth.createAccount')}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">{t('auth.username')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={mode === 'login' ? t('auth.usernameOrEmail') : t('auth.usernamePlaceholder')}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white/50 backdrop-blur-sm border-white/40 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-all"
                />
              </div>
            </div>

            {/* Email (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700">{t('auth.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white/50 backdrop-blur-sm border-white/40 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* Nickname (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700">
                  {t('auth.nickname')} <span className="text-gray-400 font-normal">({t('common.optional')})</span>
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t('auth.nicknamePlaceholder')}
                  className="w-full px-4 py-2.5 rounded-xl border bg-white/50 backdrop-blur-sm border-white/40 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-all"
                />
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? t('auth.passwordPlaceholder') : t('auth.enterPassword')}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border bg-white/50 backdrop-blur-sm border-white/40 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium mb-1.5 text-gray-700">{t('auth.confirmPassword')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white/50 backdrop-blur-sm border-white/40 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {mode === 'login' ? t('auth.loggingIn') : t('auth.registering')}
                </>
              ) : (
                mode === 'login' ? t('auth.login') : t('auth.register')
              )}
            </Button>
          </form>

          {/* Switch Mode */}
          <div className="mt-6 text-center">
            <span className="text-sm text-gray-600">
              {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
            </span>
            <button
              onClick={switchMode}
              className="text-sm text-primary-600 font-medium ml-1 hover:text-primary-700 transition-colors"
            >
              {mode === 'login' ? t('auth.goRegister') : t('auth.goLogin')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
