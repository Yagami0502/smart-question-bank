import { useState, useCallback } from 'react';

export type ModalName =
  | 'pomodoro'
  | 'achievements'
  | 'dataExport'
  | 'flashcard'
  | 'calendar'
  | 'favorites'
  | 'dailyGoals'
  | 'statsReport'
  | 'search'
  | 'reminder'
  | 'share'
  | 'plan'
  | 'graph'
  | 'timeline'
  | 'errorAnalysis'
  | 'examSettings'
  | 'settings'
  | 'wrongBook'
  | 'glassDebugger';

type ModalState = Record<ModalName, boolean>;

const initialState: ModalState = {
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
};

// 视图名称到 ModalName 的映射
const viewToModal: Record<string, ModalName> = {
  'flashcard': 'flashcard',
  'pomodoro': 'pomodoro',
  'study-plan': 'plan',
  'daily-goals': 'dailyGoals',
  'reminder': 'reminder',
  'stats': 'statsReport',
  'calendar': 'calendar',
  'timeline': 'timeline',
  'knowledge-graph': 'graph',
  'error-analysis': 'errorAnalysis',
  'my-favorites': 'favorites',
  'favorites': 'favorites',
  'achievements': 'achievements',
  'share': 'share',
  'export': 'dataExport',
  'settings': 'settings',
  'wrongbook': 'wrongBook',
};

export function useModals() {
  const [modals, setModals] = useState<ModalState>(initialState);

  const open = useCallback((name: ModalName) => {
    setModals(prev => ({ ...prev, [name]: true }));
  }, []);

  const close = useCallback((name: ModalName) => {
    setModals(prev => ({ ...prev, [name]: false }));
  }, []);

  const toggle = useCallback((name: ModalName) => {
    setModals(prev => ({ ...prev, [name]: !prev[name] }));
  }, []);

  // 尝试将视图名称映射为模态框，返回是否成功
  const tryOpenFromView = useCallback((view: string): boolean => {
    const modalName = viewToModal[view];
    if (modalName) {
      open(modalName);
      return true;
    }
    return false;
  }, [open]);

  // 获取当前活动的模态框名称（用于侧边栏高亮）
  const getActiveModal = useCallback((): string | null => {
    const priorityOrder: Array<[ModalName, string]> = [
      ['pomodoro', 'pomodoro'],
      ['flashcard', 'flashcard'],
      ['plan', 'study-plan'],
      ['dailyGoals', 'daily-goals'],
      ['reminder', 'reminder'],
      ['statsReport', 'stats'],
      ['calendar', 'calendar'],
      ['timeline', 'timeline'],
      ['graph', 'knowledge-graph'],
      ['errorAnalysis', 'error-analysis'],
      ['favorites', 'my-favorites'],
      ['wrongBook', 'wrongbook'],
      ['achievements', 'achievements'],
      ['share', 'share'],
      ['dataExport', 'export'],
      ['settings', 'settings'],
    ];
    for (const [key, viewName] of priorityOrder) {
      if (modals[key]) return viewName;
    }
    return null;
  }, [modals]);

  return { modals, open, close, toggle, tryOpenFromView, getActiveModal };
}
