import { act, createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import App from './App';
import { AUTH_LOGOUT_EVENT } from './lib/auth';

const mocks = vi.hoisted(() => {
  const startPractice = vi.fn();
  const setCurrentDeck = vi.fn();
  const loadUserSettings = vi.fn();
  const useAppStore = Object.assign(
    vi.fn(() => ({ startPractice, setCurrentDeck })),
    {
      getState: vi.fn(() => ({
        loadUserSettings,
        session: null,
      })),
    }
  );

  return {
    startPractice,
    setCurrentDeck,
    loadUserSettings,
    useAppStore,
  };
});

vi.mock('./hooks/useAsyncQuery', () => ({
  useLiveQuery: vi.fn(() => []),
}));

vi.mock('./stores/appStore', () => ({
  useAppStore: mocks.useAppStore,
}));

vi.mock('./hooks/useModals', () => ({
  useModals: vi.fn(() => ({
    modals: {
      pomodoro: false,
      achievements: false,
      dataExport: false,
      flashcard: false,
      calendar: false,
      favorites: false,
      dailyGoals: false,
      statsReport: false,
      search: false,
      reminder: false,
      share: false,
      plan: false,
      graph: false,
      timeline: false,
      errorAnalysis: false,
      examSettings: false,
      settings: false,
      wrongBook: false,
      glassDebugger: false,
    },
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
    tryOpenFromView: vi.fn(() => false),
    getActiveModal: vi.fn(() => null),
  })),
}));

vi.mock('./lib/database', () => ({
  db: {
    cards: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(async () => []),
        })),
      })),
    },
  },
}));

vi.mock('./components/Layout', () => ({
  default: ({ children }: { children: ReactNode }) => createElement('div', { 'data-testid': 'app-shell' }, children),
}));

vi.mock('./components/ui/ConfirmDialog', () => ({
  default: () => null,
  dialog: {
    confirm: vi.fn(async () => true),
    warning: vi.fn(),
  },
}));

vi.mock('./components/ui/LiquidGlassDebugger', () => ({
  default: () => null,
  initLiquidGlassConfig: vi.fn(),
}));

vi.mock('./pages/LoginPage', () => ({
  default: () => createElement('div', { 'data-testid': 'login-page' }, 'login page'),
}));

vi.mock('./pages/HomePage', () => ({
  default: () => createElement('div', { 'data-testid': 'home-page' }, 'home page'),
}));

vi.mock('./pages/DecksPage', () => ({ default: () => null }));
vi.mock('./pages/MyDecksPage', () => ({ default: () => null }));
vi.mock('./pages/PublicVocabularyPage', () => ({ default: () => null }));
vi.mock('./pages/MyVocabularyPage', () => ({ default: () => null }));
vi.mock('./pages/VocabularyPracticePage', () => ({ default: () => null }));
vi.mock('./pages/VocabularyWrongWordsPage', () => ({ default: () => null }));
vi.mock('./pages/VocabularyFavoritesPage', () => ({ default: () => null }));
vi.mock('./pages/VocabularySettingsPage', () => ({ default: () => null }));
vi.mock('./pages/VocabularyImportPage', () => ({ default: () => null }));
vi.mock('./pages/VocabularyStatsPage', () => ({ default: () => null }));
vi.mock('./pages/VocabularyDetailsPage', () => ({ default: () => null }));
vi.mock('./pages/ArticlesPage', () => ({ default: () => null }));
vi.mock('./pages/ArticlePracticePage', () => ({ default: () => null }));
vi.mock('./pages/PracticePage', () => ({ default: () => null }));
vi.mock('./pages/ImportPage', () => ({ default: () => null }));
vi.mock('./pages/DashboardPage', () => ({ default: () => null }));
vi.mock('./pages/DeckDetailsPage', () => ({ default: () => null }));
vi.mock('./pages/AdminPage', () => ({ default: () => null }));

vi.mock('./components/PomodoroTimer', () => ({ default: () => null }));
vi.mock('./components/AchievementsPanel', () => ({ default: () => null }));
vi.mock('./components/DataExport', () => ({ default: () => null }));
vi.mock('./components/QuickFlashcard', () => ({ default: () => null }));
vi.mock('./components/LearningCalendar', () => ({ default: () => null }));
vi.mock('./components/FavoritesPanel', () => ({ default: () => null }));
vi.mock('./components/DailyGoals', () => ({ default: () => null }));
vi.mock('./components/StatsReport', () => ({ default: () => null }));
vi.mock('./components/QuestionSearch', () => ({ default: () => null }));
vi.mock('./components/StudyReminder', () => ({ default: () => null }));
vi.mock('./components/StudyShare', () => ({ default: () => null }));
vi.mock('./components/StudyPlan', () => ({ default: () => null }));
vi.mock('./components/KnowledgeGraph', () => ({ default: () => null }));
vi.mock('./components/StudyTimeline', () => ({ default: () => null }));
vi.mock('./components/ErrorAnalysis', () => ({ default: () => null }));
vi.mock('./components/ExamSettings', () => ({
  default: () => null,
}));
vi.mock('./components/SettingsModal', () => ({ default: () => null }));
vi.mock('./components/WrongBookModal', () => ({ default: () => null }));

describe('App auth logout event', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('mindforge_access_token', 'valid-token');
    localStorage.setItem('mindforge_user', JSON.stringify({ id: 'u1' }));
    localStorage.removeItem('currentView');
    localStorage.removeItem('selectedDeck');
    localStorage.removeItem('smart-question-bank-storage');

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
  });

  it('does not crash on startup when selectedDeck in localStorage contains malformed JSON', async () => {
    localStorage.setItem('selectedDeck', '{invalid-json');

    await act(async () => {
      root.render(createElement(App));
    });

    expect(container.querySelector('[data-testid="home-page"]')).not.toBeNull();
    expect(localStorage.getItem('selectedDeck')).toBeNull();
  });

  it('switches back to the login UI when AUTH_LOGOUT_EVENT is dispatched', async () => {
    await act(async () => {
      root.render(createElement(App));
    });

    expect(container.querySelector('[data-testid="home-page"]')).not.toBeNull();
    expect(mocks.loadUserSettings).toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
    });

    expect(container.querySelector('[data-testid="login-page"]')).not.toBeNull();
    expect(mocks.setCurrentDeck).toHaveBeenCalledWith(null);
    expect(localStorage.getItem('currentView')).toBeNull();
    expect(localStorage.getItem('selectedDeck')).toBeNull();
  });
});
