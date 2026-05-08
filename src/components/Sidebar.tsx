import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Home,
  BookOpen,
  GraduationCap,
  BarChart3,
  User,
  ChevronRight,
  Globe,
  Brain,
  Timer,
  FileText,
  Target,
  Bell,
  Calendar,
  Clock,
  AlertTriangle,
  Star,
  BookX,
  Share2,
  Download,
  Menu,
  X,
  Settings,
  Library,
  BookMarked,
  Bookmark,
  ScrollText,
  Flame,
  PieChart,
  Network,
  Award,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getStoredUser } from '../lib/auth';
import { LanguageSwitcher } from './LanguageSwitcher';

export type PageView = 
  | 'home' 
  | 'decks' 
  | 'my-decks'
  | 'public-vocabulary'
  | 'my-vocabulary'
  | 'vocabulary-practice'
  | 'vocabulary-wrong-words'
  | 'vocabulary-favorites'
  | 'vocabulary-settings'
  | 'vocabulary-details'
  | 'articles'
  | 'article-practice'
  | 'flashcard'
  | 'pomodoro'
  | 'study-plan'
  | 'daily-goals'
  | 'reminder'
  | 'stats'
  | 'calendar'
  | 'timeline'
  | 'knowledge-graph'
  | 'error-analysis'
  | 'my-favorites'
  | 'wrongbook'
  | 'achievements'
  | 'share'
  | 'export'
  | 'profile'
  | 'settings'
  | 'practice'
  | 'import'
  | 'dashboard'
  | 'deckdetails'
  | 'vocabulary-import'
  | 'vocabulary-stats'
  | 'admin';

interface NavItem {
  id: string;
  labelKey: string;
  icon: React.ReactNode;
  view?: PageView;
  children?: { id: string; labelKey: string; view: PageView }[];
}

interface SidebarProps {
  currentView: PageView;
  onNavigate: (view: PageView) => void;
  activeModal?: string | null;
}

const navItems: NavItem[] = [
  {
    id: 'home',
    labelKey: 'sidebar.home',
    icon: <Home size={18} />,
    view: 'home',
  },
  {
    id: 'question-bank',
    labelKey: 'sidebar.questionBank',
    icon: <BookOpen size={18} />,
    children: [
      { id: 'public-decks', labelKey: 'sidebar.publicDecks', view: 'decks' },
      { id: 'my-decks', labelKey: 'sidebar.myDecks', view: 'my-decks' },
      { id: 'my-favorites', labelKey: 'sidebar.favoriteQuestions', view: 'my-favorites' },
      { id: 'wrongbook', labelKey: 'sidebar.wrongBook', view: 'wrongbook' },
    ],
  },
  {
    id: 'vocabulary',
    labelKey: 'sidebar.vocabulary',
    icon: <Globe size={18} />,
    children: [
      { id: 'public-vocabulary', labelKey: 'sidebar.publicVocabulary', view: 'public-vocabulary' },
      { id: 'my-vocabulary', labelKey: 'sidebar.myVocabulary', view: 'my-vocabulary' },
      { id: 'articles', labelKey: 'sidebar.articles', view: 'articles' },
      { id: 'vocabulary-wrong-words', labelKey: 'sidebar.wrongWords', view: 'vocabulary-wrong-words' },
      { id: 'vocabulary-favorites', labelKey: 'sidebar.favoriteWords', view: 'vocabulary-favorites' },
    ],
  },
  {
    id: 'study',
    labelKey: 'sidebar.study',
    icon: <GraduationCap size={18} />,
    children: [
      { id: 'flashcard', labelKey: 'sidebar.flashcard', view: 'flashcard' },
      { id: 'pomodoro', labelKey: 'sidebar.pomodoro', view: 'pomodoro' },
      { id: 'study-plan', labelKey: 'sidebar.studyPlan', view: 'study-plan' },
      { id: 'daily-goals', labelKey: 'sidebar.dailyGoals', view: 'daily-goals' },
      { id: 'reminder', labelKey: 'sidebar.reminder', view: 'reminder' },
    ],
  },
  {
    id: 'data',
    labelKey: 'sidebar.data',
    icon: <BarChart3 size={18} />,
    children: [
      { id: 'stats', labelKey: 'sidebar.stats', view: 'stats' },
      { id: 'calendar', labelKey: 'sidebar.calendar', view: 'calendar' },
      { id: 'timeline', labelKey: 'sidebar.timeline', view: 'timeline' },
      { id: 'knowledge-graph', labelKey: 'sidebar.knowledgeGraph', view: 'knowledge-graph' },
      { id: 'error-analysis', labelKey: 'sidebar.errorAnalysis', view: 'error-analysis' },
    ],
  },
  {
    id: 'profile',
    labelKey: 'sidebar.profile',
    icon: <User size={18} />,
    children: [
      { id: 'achievements', labelKey: 'sidebar.achievements', view: 'achievements' },
      { id: 'share', labelKey: 'sidebar.share', view: 'share' },
      { id: 'export', labelKey: 'sidebar.export', view: 'export' },
      { id: 'profile-settings', labelKey: 'sidebar.settings', view: 'settings' },
    ],
  },
];

const getIconForChild = (id: string) => {
  const icons: Record<string, React.ReactNode> = {
    // 题库
    'public-decks': <Library size={14} />,
    'my-decks': <BookMarked size={14} />,
    'my-favorites': <Bookmark size={14} />,
    'wrongbook': <BookX size={14} />,
    // 词库
    'public-vocabulary': <Globe size={14} />,
    'my-vocabulary': <ScrollText size={14} />,
    'articles': <FileText size={14} />,
    'vocabulary-wrong-words': <AlertTriangle size={14} />,
    'vocabulary-favorites': <Star size={14} />,
    // 学习
    'flashcard': <Brain size={14} />,
    'pomodoro': <Timer size={14} />,
    'study-plan': <Target size={14} />,
    'daily-goals': <Flame size={14} />,
    'reminder': <Bell size={14} />,
    // 数据
    'stats': <BarChart3 size={14} />,
    'calendar': <Calendar size={14} />,
    'timeline': <Clock size={14} />,
    'knowledge-graph': <Network size={14} />,
    'error-analysis': <PieChart size={14} />,
    // 我的
    'achievements': <Award size={14} />,
    'share': <Share2 size={14} />,
    'export': <Download size={14} />,
    'profile-settings': <Settings size={14} />,
  };
  return icons[id] || null;
};

export default function Sidebar({ currentView, onNavigate, activeModal }: SidebarProps) {
  const { t } = useTranslation();
  
  // 根据当前视图或活动模态框计算应该展开的菜单
  const getOpenMenusForView = (view: PageView, modal?: string | null): string[] => {
    const menus: string[] = [];
    const targetView = modal || view;
    navItems.forEach(item => {
      if (item.children?.some(child => child.view === targetView)) {
        menus.push(item.id);
      }
    });
    return menus;
  };

  const [openMenus, setOpenMenus] = useState<string[]>(() => {
    const menus = getOpenMenusForView(currentView, activeModal);
    // 默认展开题库和词库
    const defaultMenus = ['question-bank', 'vocabulary'];
    return menus.length > 0 ? [...new Set([...menus, ...defaultMenus])] : defaultMenus;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // 当 currentView 或 activeModal 变化时，确保对应的父菜单展开
  useEffect(() => {
    const targetView = activeModal || currentView;
    const parentMenu = navItems.find(item => 
      item.children?.some(child => child.view === targetView)
    );
    if (parentMenu && !openMenus.includes(parentMenu.id)) {
      setOpenMenus(prev => [...prev, parentMenu.id]);
    }
  }, [currentView, activeModal]);

  const toggleMenu = (menuId: string) => {
    setOpenMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const handleNavigate = (view: PageView) => {
    onNavigate(view);
    setIsMobileOpen(false);
  };

  // 判断是否激活（考虑模态框）
  const isActiveView = (item: NavItem): boolean => {
    const targetView = activeModal || currentView;
    if (item.view === targetView) return true;
    if (item.children) {
      return item.children.some(child => child.view === targetView);
    }
    return false;
  };

  // 判断子项是否激活
  const isChildActive = (childView: PageView): boolean => {
    return activeModal === childView || (!activeModal && currentView === childView);
  };

  return (
    <>
      {/* 移动端菜单按钮 */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className={cn(
          "fixed top-4 left-4 z-50 p-2 rounded-lg md:hidden",
          "glass-effect text-gray-800"
        )}
      >
        {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* 移动端遮罩 */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside className={cn(
        "fixed md:sticky top-0 inset-y-0 left-0 z-40 w-64 h-screen flex flex-col transition-transform duration-300 ease-in-out",
        "frosted-glass-sidebar",
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex flex-col h-full min-h-0">
        {/* Logo */}
        <div className="p-6 pt-4">
          <div className="flex flex-col justify-center">
            <div 
              className="text-[26px] leading-tight tracking-tight mb-1.5 flex items-baseline"
              style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em' }}
            >
              <span className="font-light text-gray-700">Mind</span>
              <span className="font-bold text-black">Forge</span>
            </div>
            <div 
              className="text-[10px] font-semibold uppercase text-gray-400"
              style={{ fontFamily: "'Outfit', sans-serif", letterSpacing: '0.12em' }}
            >
              Think. Learn. Conquer.
            </div>
          </div>
        </div>

        {/* 导航菜单 - 知识树效果 */}
        <nav className="flex-1 px-4 overflow-y-auto scrollbar-hide">
          <div className="relative">
            {/* 主干线 */}
            <div className="absolute left-[26px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-300 via-primary-400 to-primary-300 opacity-40" />
            
            <div className="space-y-1 relative">
              {navItems.map((item) => (
                <div key={item.id} className="relative">
                  {/* 节点连接点 */}
                  <div className={cn(
                    "absolute left-[22px] top-[18px] w-2.5 h-2.5 rounded-full border-2 z-10 transition-all duration-300",
                    isActiveView(item)
                      ? "bg-primary-500 border-primary-400 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                      : "bg-white border-gray-300"
                  )} />
                  
                  {/* 父级菜单项 */}
                  <button
                    onClick={() => item.children ? toggleMenu(item.id) : item.view && handleNavigate(item.view)}
                    className={cn(
                      "w-full flex items-center justify-between pl-10 pr-4 py-3 rounded-lg transition-all duration-200",
                      "text-sm font-medium",
                      isActiveView(item)
                        ? "bg-white/50 text-gray-900"
                        : "text-gray-700 hover:bg-white/30 hover:text-gray-900"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "transition-colors duration-200",
                        isActiveView(item) ? "text-primary-600" : "text-gray-500"
                      )}>
                        {item.icon}
                      </span>
                      <span>{t(item.labelKey)}</span>
                    </div>
                    {item.children && (
                      <ChevronRight 
                        size={14} 
                        className={cn(
                          "transition-transform duration-200 text-gray-400",
                          openMenus.includes(item.id) && "rotate-90"
                        )}
                      />
                    )}
                  </button>

                  {/* 子菜单 - 分支效果 */}
                  {item.children && (
                    <div className={cn(
                      "overflow-hidden transition-all duration-300 ease-in-out",
                      openMenus.includes(item.id) ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                    )}>
                      <div className="relative ml-[26px] mt-1 space-y-0.5">
                        {item.children.map((child) => (
                          <div key={child.id} className="relative">
                            {/* 分支线 - L形连接 */}
                            <div className="absolute left-0 top-0 bottom-1/2 w-4 border-l-2 border-b-2 border-primary-300/40 rounded-bl-lg" />
                            
                            {/* 子节点圆点 */}
                            <div className={cn(
                              "absolute left-[14px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-all duration-200",
                              isChildActive(child.view)
                                ? "bg-primary-500 shadow-[0_0_6px_rgba(99,102,241,0.6)]"
                                : "bg-gray-400"
                            )} />
                            
                            <button
                              onClick={() => handleNavigate(child.view)}
                              className={cn(
                                "w-full flex items-center gap-2 pl-7 pr-4 py-2 text-sm rounded-lg transition-all ml-2",
                                isChildActive(child.view)
                                  ? "text-primary-600 bg-primary-50/50 font-medium"
                                  : "text-gray-600 hover:text-gray-800 hover:bg-white/30"
                              )}
                            >
                              <span className={cn(
                                "transition-colors duration-200",
                                isChildActive(child.view) ? "text-primary-500" : "text-gray-400"
                              )}>
                                {getIconForChild(child.id)}
                              </span>
                              {t(child.labelKey)}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </nav>

        {/* 底部语言切换 */}
        <div className="p-4 border-t border-white/30 space-y-2">
          {/* 管理员入口 - 仅管理员可见 */}
          {getStoredUser()?.role === 'admin' && (
            <button 
              onClick={() => handleNavigate('admin')}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-colors",
                currentView === 'admin'
                  ? "bg-red-100 text-red-700"
                  : "bg-white/40 text-gray-700 hover:bg-red-50 hover:text-red-600"
              )}
            >
              <ShieldCheck size={16} className={currentView === 'admin' ? "text-red-600" : "text-red-500"} />
              {t('sidebar.adminConsole')}
            </button>
          )}
          <LanguageSwitcher />
        </div>
        </div>
      </aside>
    </>
  );
}
