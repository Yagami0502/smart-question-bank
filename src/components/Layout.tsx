import { ReactNode } from 'react';
import { getStoredUser } from '../lib/auth';
import Sidebar, { type PageView } from './Sidebar';
import { LiquidGlassFilter } from './ui/LiquidGlass';
import Button from './ui/Button';
import { Settings, LogOut, Search, Sliders } from 'lucide-react';

const defaultAvatar = '/default-avatar.png';

interface LayoutProps {
  currentView: PageView;
  onNavigate: (view: string, data?: any) => void;
  activeModal: string | null;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onToggleDebugger: () => void;
  isDebuggerOpen: boolean;
  onLogout: () => void;
  children: ReactNode;
}

export default function Layout({
  currentView,
  onNavigate,
  activeModal,
  onOpenSearch,
  onOpenSettings,
  onToggleDebugger,
  isDebuggerOpen,
  onLogout,
  children,
}: LayoutProps) {
  const currentUser = getStoredUser();
  const hideToolbar = currentView === 'vocabulary-details' || currentView === 'deckdetails';

  return (
    <div className="min-h-screen flex bg-transparent">
      <LiquidGlassFilter />

      <Sidebar
        currentView={currentView}
        onNavigate={onNavigate}
        activeModal={activeModal}
      />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden relative">
        {!hideToolbar && (
          <div className="absolute top-4 right-6 z-30 flex items-center gap-3">
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/70 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/50">
              <button
                onClick={onOpenSearch}
                className="p-2 rounded-full transition-colors hover:bg-white/60 text-gray-600"
                title="搜索题目"
              >
                <Search size={18} />
              </button>
              <button
                onClick={onOpenSettings}
                className="p-2 rounded-full transition-colors hover:bg-white/60 text-gray-600"
                title="设置"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={onToggleDebugger}
                className={`p-2 rounded-full transition-colors text-gray-600 ${isDebuggerOpen ? 'bg-primary-100 text-primary-600' : 'hover:bg-white/60'}`}
                title="玻璃效果调试"
              >
                <Sliders size={18} />
              </button>
            </div>

            <div className="relative group">
              <button className="w-10 h-10 rounded-full overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.1)] border-2 border-white/80 transition-transform hover:scale-105">
                <img
                  src={currentUser?.avatar || defaultAvatar}
                  alt="用户头像"
                  className="w-full h-full object-cover scale-150"
                  style={{ objectPosition: 'center 20%' }}
                />
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 bg-white/90 backdrop-blur-md border border-white/50">
                <div className="p-2">
                  <div className="px-3 py-2 text-sm font-medium text-gray-800">
                    {currentUser?.nickname || currentUser?.username}
                  </div>
                  <div className="px-3 py-1 text-xs text-gray-500">
                    {currentUser?.email}
                  </div>
                  <div className="border-t my-2 border-gray-200/50" />
                  <div className="px-1">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={onLogout}
                      leftIcon={<LogOut size={14} />}
                      className="w-full"
                    >
                      退出登录
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
