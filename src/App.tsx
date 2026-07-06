import { useState, useEffect } from 'react';
import { useLiveQuery } from './hooks/useAsyncQuery';
import { db, questionOperations } from './lib/database';
import { wrongQuestionOperations } from './lib/database-mysql';
import { useAppStore } from './stores/appStore';
import { isLoggedIn, logout, AUTH_LOGOUT_EVENT, type User } from './lib/auth';
import { useModals } from './hooks/useModals';

// 布局组件
import Layout from './components/Layout';
import { type PageView } from './components/Sidebar';
import ConfirmDialog, { dialog } from './components/ui/ConfirmDialog';
import LiquidGlassDebugger, { initLiquidGlassConfig } from './components/ui/LiquidGlassDebugger';

// 页面组件
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import DecksPage from './pages/DecksPage';
import MyDecksPage from './pages/MyDecksPage';
import PublicVocabularyPage from './pages/PublicVocabularyPage';
import MyVocabularyPage from './pages/MyVocabularyPage';
import VocabularyPracticePage from './pages/VocabularyPracticePage';
import VocabularyWrongWordsPage from './pages/VocabularyWrongWordsPage';
import VocabularyFavoritesPage from './pages/VocabularyFavoritesPage';
import VocabularySettingsPage from './pages/VocabularySettingsPage';
import VocabularyImportPage from './pages/VocabularyImportPage';
import VocabularyStatsPage from './pages/VocabularyStatsPage';
import VocabularyDetailsPage from './pages/VocabularyDetailsPage';
import ArticlesPage from './pages/ArticlesPage';
import ArticlePracticePage from './pages/ArticlePracticePage';
import PracticePage from './pages/PracticePage';
import ImportPage from './pages/ImportPage';
import DashboardPage from './pages/DashboardPage';
import DeckDetailsPage from './pages/DeckDetailsPage';
import AdminPage from './pages/AdminPage';

// 功能组件
import PomodoroTimer from './components/PomodoroTimer';
import AchievementsPanel from './components/AchievementsPanel';
import DataExport from './components/DataExport';
import QuickFlashcard from './components/QuickFlashcard';
import LearningCalendar from './components/LearningCalendar';
import FavoritesPanel from './components/FavoritesPanel';
import DailyGoals from './components/DailyGoals';
import StatsReport from './components/StatsReport';
import QuestionSearch from './components/QuestionSearch';
import StudyReminder from './components/StudyReminder';
import StudyShare from './components/StudyShare';
import StudyPlan from './components/StudyPlan';
import KnowledgeGraph from './components/KnowledgeGraph';
import StudyTimeline from './components/StudyTimeline';
import ErrorAnalysis from './components/ErrorAnalysis';
import ExamSettings, { ExamConfig } from './components/ExamSettings';
import SettingsModal from './components/SettingsModal';
import WrongBookModal from './components/WrongBookModal';

import type { Deck, PracticeMode } from './types';

function App() {
  // 认证状态
  const [isAuthenticated, setIsAuthenticated] = useState(() => isLoggedIn());

  // 页面导航状态
  const [currentView, setCurrentView] = useState<PageView>(() => {
    const saved = localStorage.getItem('currentView');
    if (saved === 'practice') return 'home';
    return (saved as PageView) || 'home';
  });
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(() => {
    const saved = localStorage.getItem('selectedDeck');
    if (!saved) return null;

    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem('selectedDeck');
      return null;
    }
  });

  // 词库练习状态
  const [selectedVocabBookId, setSelectedVocabBookId] = useState<string | null>(null);
  const [selectedVocabBookName, setSelectedVocabBookName] = useState('');
  const [vocabDetailsFilter, setVocabDetailsFilter] = useState<'all' | 'new' | 'learning' | 'mastered' | 'wrong'>('all');
  const [vocabSourceView, setVocabSourceView] = useState<PageView>('my-vocabulary');

  // 题库详情筛选状态
  const [deckDetailsFilter, setDeckDetailsFilter] = useState<'all' | 'new' | 'learning' | 'review' | 'mastered'>('all');
  const [detailsSourceView, setDetailsSourceView] = useState<PageView>('home');

  // 文章练习状态
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [adminSourceTab, setAdminSourceTab] = useState<'overview' | 'users' | 'decks' | 'vocabulary' | null>(null);

  // 模态框状态（统一管理）
  const { modals, open, close, toggle, tryOpenFromView, getActiveModal } = useModals();

  const { startPractice, setCurrentDeck } = useAppStore();

  const resetAuthState = () => {
    localStorage.removeItem('currentView');
    localStorage.removeItem('selectedDeck');
    setIsAuthenticated(false);
    setCurrentView('home');
    setSelectedDeck(null);
    setSelectedVocabBookId(null);
    setSelectedVocabBookName('');
    setSelectedArticle(null);
    setCurrentDeck(null);
  };

  // 初始化液态玻璃配置
  useEffect(() => { initLiquidGlassConfig(); }, []);

  useEffect(() => {
    if (currentView === 'admin' && adminSourceTab !== null) {
      setAdminSourceTab(null);
    }
  }, [currentView, adminSourceTab]);

  // 题库详情数据
  const deckQuestions = useLiveQuery(
    async () => {
      if (!selectedDeck || !isAuthenticated) return [];
      return questionOperations.getByDeckId(selectedDeck.id);
    },
    [selectedDeck?.id, isAuthenticated]
  ) || [];

  const deckCards = useLiveQuery(
    async () => {
      if (!selectedDeck || !isAuthenticated) return [];
      return db.cards.where('deckId').equals(selectedDeck.id).toArray();
    },
    [selectedDeck?.id, isAuthenticated]
  ) || [];

  useEffect(() => {
    if (isAuthenticated) useAppStore.getState().loadUserSettings();
  }, [isAuthenticated]);

  useEffect(() => {
    const handleAuthLogout = () => {
      resetAuthState();
    };

    window.addEventListener(AUTH_LOGOUT_EVENT, handleAuthLogout);
    return () => {
      window.removeEventListener(AUTH_LOGOUT_EVENT, handleAuthLogout);
    };
  }, []);

  useEffect(() => { localStorage.setItem('currentView', currentView); }, [currentView]);

  useEffect(() => {
    if (selectedDeck) localStorage.setItem('selectedDeck', JSON.stringify(selectedDeck));
    else localStorage.removeItem('selectedDeck');
  }, [selectedDeck]);

  // 处理登录成功
  const handleLoginSuccess = async (_user: User) => {
    setIsAuthenticated(true);
    await useAppStore.getState().loadUserSettings();
  };

  // 处理登出
  const handleLogout = async () => {
    const confirmed = await dialog.confirm('确定要退出登录吗？', { title: '退出登录', isDanger: true });
    if (confirmed) {
      await logout();
      resetAuthState();
    }
  };

  // 处理导航
  const handleNavigate = (view: string, data?: any) => {
    if (data && typeof data === 'object' && 'id' in data && 'name' in data) {
      setSelectedDeck(data as Deck);
    }

    // 尝试打开模态框
    if (tryOpenFromView(view)) return;

    // 处理带数据的页面导航
    switch (view) {
      case 'vocabulary-import':
        if (data?.bookId) {
          setSelectedVocabBookId(data.bookId);
          setSelectedVocabBookName(data.bookName || '词库');
          setVocabSourceView((data.sourceView as PageView) || currentView);
          if (data?.sourceView === 'admin') {
            setAdminSourceTab((data.sourceTab as 'overview' | 'users' | 'decks' | 'vocabulary') || 'vocabulary');
          }
          setCurrentView('vocabulary-import' as PageView);
        }
        return;
      case 'vocabulary-stats':
        if (data?.bookId) {
          setSelectedVocabBookId(data.bookId);
          setSelectedVocabBookName(data.bookName || '词库');
          setCurrentView('vocabulary-stats' as PageView);
        }
        return;
      case 'vocabulary-details':
        if (data?.bookId) {
          setSelectedVocabBookId(data.bookId);
          setSelectedVocabBookName(data.bookName || '词库');
          setVocabDetailsFilter(data.filter || 'all');
          setCurrentView('vocabulary-details' as PageView);
        }
        return;
      case 'vocabulary-practice':
        if (data?.bookId) {
          setSelectedVocabBookId(data.bookId);
          setSelectedVocabBookName(data.bookName || '词库练习');
          setCurrentView('vocabulary-practice' as PageView);
        }
        return;
      case 'article-practice':
        if (data?.article) {
          setSelectedArticle(data.article);
          setCurrentView('article-practice' as PageView);
        }
        return;
      case 'deckdetails':
        if (data && 'id' in data) {
          setSelectedDeck(data as Deck);
          setDetailsSourceView(currentView);
          setDeckDetailsFilter(data.filter || 'all');
          setCurrentView('deckdetails' as PageView);
        }
        return;
      case 'import':
        if (data && 'id' in data) {
          setSelectedDeck(data as Deck);
          setCurrentView('import' as PageView);
        }
        return;
      default:
        setCurrentView(view as PageView);
    }
  };

  // 处理开始练习
  const handleStartPractice = async (deck: Deck, mode: PracticeMode) => {
    if (mode === 'exam') {
      setSelectedDeck(deck);
      open('examSettings');
      return;
    }
    setCurrentDeck(deck.id);
    await startPractice(deck.id, mode, { limit: 50 });
    const currentSession = useAppStore.getState().session;
    if (currentSession && currentSession.cards.length > 0) {
      setSelectedDeck(deck);
      setCurrentView('practice');
    } else {
      dialog.warning('没有可练习的题目，请先导入题目', '提示');
    }
  };

  // 开始考试
  const handleStartExam = async (config: ExamConfig) => {
    if (!selectedDeck) return;
    setCurrentDeck(selectedDeck.id);
    await startPractice(selectedDeck.id, 'exam', {
      limit: config.questionCount,
      examConfig: config,
    });
    const currentSession = useAppStore.getState().session;
    if (currentSession && currentSession.cards.length > 0) {
      close('examSettings');
      setCurrentView('practice');
    } else {
      dialog.warning('没有可练习的题目，请先导入题目', '提示');
    }
  };

  // 未登录 → 登录页
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // 渲染主内容
  const renderMainContent = () => {
    switch (currentView) {
      case 'practice':
        return <PracticePage onBack={() => setCurrentView('home')} />;
      case 'import':
        return selectedDeck ? <ImportPage deck={selectedDeck} onBack={() => setCurrentView('decks')} /> : null;
      case 'dashboard':
        return selectedDeck ? <DashboardPage deck={selectedDeck} onBack={() => setCurrentView('home')} /> : null;
      case 'deckdetails':
        return selectedDeck ? (
          <DeckDetailsPage
            deck={selectedDeck} questions={deckQuestions} cards={deckCards}
            initialFilter={deckDetailsFilter}
            onBack={() => { setSelectedDeck(null); setCurrentView(detailsSourceView); }}
          />
        ) : null;
      case 'decks':
        return <DecksPage onNavigate={handleNavigate} />;
      case 'my-decks':
        return <MyDecksPage onNavigate={handleNavigate} onStartPractice={handleStartPractice} />;
      case 'public-vocabulary':
        return <PublicVocabularyPage onNavigate={handleNavigate} />;
      case 'my-vocabulary':
        return <MyVocabularyPage onNavigate={handleNavigate} />;
      case 'vocabulary-practice':
        return selectedVocabBookId ? (
          <VocabularyPracticePage bookId={selectedVocabBookId} bookName={selectedVocabBookName}
            onBack={() => { setSelectedVocabBookId(null); setSelectedVocabBookName(''); setCurrentView('my-vocabulary'); }} />
        ) : null;
      case 'vocabulary-import':
        return selectedVocabBookId ? (
          <VocabularyImportPage bookId={selectedVocabBookId} bookName={selectedVocabBookName}
            onBack={() => { setSelectedVocabBookId(null); setSelectedVocabBookName(''); setCurrentView(vocabSourceView); }} />
        ) : null;
      case 'vocabulary-stats':
        return selectedVocabBookId ? (
          <VocabularyStatsPage bookId={selectedVocabBookId} bookName={selectedVocabBookName}
            onBack={() => { setSelectedVocabBookId(null); setSelectedVocabBookName(''); setCurrentView('my-vocabulary'); }} />
        ) : null;
      case 'vocabulary-details':
        return selectedVocabBookId ? (
          <VocabularyDetailsPage bookId={selectedVocabBookId} bookName={selectedVocabBookName}
            initialFilter={vocabDetailsFilter}
            onBack={() => { setSelectedVocabBookId(null); setSelectedVocabBookName(''); setCurrentView('my-vocabulary'); }} />
        ) : null;
      case 'articles':
        return <ArticlesPage onNavigate={handleNavigate} />;
      case 'article-practice':
        return selectedArticle ? (
          <ArticlePracticePage article={selectedArticle}
            onBack={() => { setSelectedArticle(null); setCurrentView('articles'); }} />
        ) : null;
      case 'vocabulary-wrong-words':
        return <VocabularyWrongWordsPage onBack={() => setCurrentView('my-vocabulary')} />;
      case 'vocabulary-favorites':
        return <VocabularyFavoritesPage onBack={() => setCurrentView('my-vocabulary')} />;
      case 'vocabulary-settings':
        return <VocabularySettingsPage onBack={() => setCurrentView('my-vocabulary')} />;
      case 'admin':
        return <AdminPage initialTab={adminSourceTab} onBack={() => setCurrentView('home')} onNavigate={handleNavigate} />;
      case 'home':
      default:
        return <HomePage onNavigate={handleNavigate} onStartPractice={handleStartPractice} />;
    }
  };

  // 全屏页面（不显示侧边栏）
  const fullScreenViews: PageView[] = ['practice', 'vocabulary-practice', 'article-practice'];
  if (fullScreenViews.includes(currentView)) {
    return renderMainContent();
  }

  return (
    <>
      <Layout
        currentView={currentView}
        onNavigate={handleNavigate}
        activeModal={getActiveModal()}
        onOpenSearch={() => open('search')}
        onOpenSettings={() => open('settings')}
        onToggleDebugger={() => toggle('glassDebugger')}
        isDebuggerOpen={modals.glassDebugger}
        onLogout={handleLogout}
      >
        {renderMainContent()}
      </Layout>

      {/* 功能弹窗 */}
      {modals.pomodoro && <PomodoroTimer isOpen onClose={() => close('pomodoro')} />}
      {modals.achievements && <AchievementsPanel isOpen onClose={() => close('achievements')} />}
      {modals.dataExport && <DataExport isOpen onClose={() => close('dataExport')} />}
      {modals.flashcard && <QuickFlashcard isOpen onClose={() => close('flashcard')} />}
      {modals.calendar && <LearningCalendar isOpen onClose={() => close('calendar')} />}
      {modals.favorites && (
        <FavoritesPanel isOpen onClose={() => close('favorites')}
          onPractice={async (questionIds, deckId) => {
            if (questionIds.length === 0) return;
            await startPractice(deckId, 'cram', { questionIds, limit: questionIds.length });
            setCurrentView('practice');
          }}
        />
      )}
      {modals.dailyGoals && <DailyGoals isOpen onClose={() => close('dailyGoals')} />}
      {modals.statsReport && <StatsReport isOpen onClose={() => close('statsReport')} />}
      {modals.search && <QuestionSearch isOpen onClose={() => close('search')} />}
      {modals.reminder && <StudyReminder isOpen onClose={() => close('reminder')} />}
      {modals.share && <StudyShare isOpen onClose={() => close('share')} />}
      {modals.plan && <StudyPlan isOpen onClose={() => close('plan')} />}
      {modals.graph && <KnowledgeGraph isOpen onClose={() => close('graph')} />}
      {modals.timeline && <StudyTimeline isOpen onClose={() => close('timeline')} />}
      {modals.errorAnalysis && <ErrorAnalysis isOpen onClose={() => close('errorAnalysis')} />}
      {modals.examSettings && selectedDeck && (
        <ExamSettings isOpen onClose={() => close('examSettings')} onStart={handleStartExam} deckId={selectedDeck.id} />
      )}
      {modals.settings && <SettingsModal isOpen onClose={() => close('settings')} />}
      {modals.wrongBook && (
        <WrongBookModal isOpen onClose={() => close('wrongBook')}
          onPractice={async (questionIds) => {
            if (questionIds.length === 0) return;
            const wrongQuestions = await wrongQuestionOperations.getAll();
            const firstWrong = wrongQuestions.find(wq => questionIds.includes(wq.questionId));
            if (firstWrong) {
              await startPractice(firstWrong.deckId, 'cram', { questionIds, limit: questionIds.length });
              setCurrentView('practice');
            }
          }}
        />
      )}

      <ConfirmDialog />
      <LiquidGlassDebugger isOpen={modals.glassDebugger} onClose={() => close('glassDebugger')} />
    </>
  );
}

export default App;
