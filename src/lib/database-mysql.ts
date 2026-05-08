/**
 * MySQL 后端数据库适配器
 * 提供与 IndexedDB 相同的接口，但使用 MySQL 后端 API
 */

import type { Deck, Question, Card, ReviewLog, DailyRecord, CardState, Option } from '../types';
import { authFetch } from './auth';

const API_BASE = '/api';

// 通用请求函数（带认证）
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const response = await authFetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: '请求失败' }));
      console.error('API Error:', endpoint, error);
      throw new Error(error.error || '请求失败');
    }

    const body = await response.text();
    return (body ? JSON.parse(body) : undefined) as T;
  } catch (err) {
    console.error('Request failed:', endpoint, err);
    throw err;
  }
}

// 转换 API 响应为前端 Card 类型
function toCard(c: any): Card {
  return {
    id: c.id,
    questionId: c.questionId || c.question_id,
    deckId: c.deckId || c.deck_id,
    state: (c.state || 'new') as CardState,
    dueDate: c.due || c.dueDate || Date.now(),
    interval: c.scheduledDays || c.interval || 0,
    easeFactor: c.difficulty || c.easeFactor || 2.5,
    reps: c.reps || 0,
    lapses: c.lapses || 0,
    lastReview: c.lastReview || c.last_review,
    createdAt: c.createdAt || c.created_at || Date.now(),
  };
}

// 判断选项是否为正确答案
function isOptionCorrect(optionId: string, correctAnswer: any): boolean {
  if (!correctAnswer) return false;
  
  // 标准化选项ID（大写）
  const normalizedId = optionId.toUpperCase();
  
  // 如果是数组，检查是否包含该选项
  if (Array.isArray(correctAnswer)) {
    return correctAnswer.some(ans => 
      String(ans).toUpperCase().trim() === normalizedId
    );
  }
  
  // 如果是字符串
  if (typeof correctAnswer === 'string') {
    const normalizedAnswer = correctAnswer.toUpperCase().trim();
    
    // 精确匹配单个字母答案 (如 "B")
    if (normalizedAnswer === normalizedId) {
      return true;
    }
    
    // 处理多选答案格式 (如 "A,B" 或 "AB" 或 "A、B")
    // 先尝试按分隔符拆分
    const separators = [',', '、', ';', '，', ' '];
    for (const sep of separators) {
      if (normalizedAnswer.includes(sep)) {
        const answers = normalizedAnswer.split(sep).map(s => s.trim()).filter(Boolean);
        if (answers.includes(normalizedId)) {
          return true;
        }
      }
    }
    
    // 如果没有分隔符，检查是否是连续字母格式 (如 "AB", "BCD")
    // 只有当答案全是字母时才按单字符拆分
    if (/^[A-Z]+$/.test(normalizedAnswer) && normalizedAnswer.length > 1) {
      return normalizedAnswer.includes(normalizedId);
    }
  }
  
  return false;
}

// 转换 API 响应为前端 Question 类型
function toQuestion(q: any): Question {
  // 获取正确答案（从 correctAnswer 或 answer 字段）
  const correctAnswer = q.correctAnswer || q.answer || '';
  
  // 处理选项
  let options: Option[] = [];
  if (Array.isArray(q.options)) {
    options = q.options.map((opt: any, idx: number) => {
      const id = String.fromCharCode(65 + idx);
      if (typeof opt === 'string') {
        // 选项是字符串，根据 correctAnswer 计算 isCorrect
        const isCorrect = isOptionCorrect(id, correctAnswer);
        return { id, content: { text: opt }, isCorrect };
      }
      // 选项是对象，确保有正确的 isCorrect 值
      const optId = opt.id || id;
      // 优先使用选项自带的 isCorrect，否则根据 correctAnswer 计算
      const isCorrect = opt.isCorrect === true || isOptionCorrect(optId, correctAnswer);
      return { 
        id: optId, 
        content: typeof opt.content === 'string' ? { text: opt.content } : (opt.content || { text: opt.text || '' }), 
        isCorrect 
      };
    });
  }

  return {
    id: q.id,
    deckId: q.deckId || q.deck_id,
    type: q.type || 'MCQ',
    content: typeof q.content === 'string' ? { text: q.content } : (q.content || { text: '' }),
    options,
    answer: correctAnswer,
    explanation: q.explanation || '',
    tags: q.tags || [],
    difficulty: q.difficulty || 3,
    createdAt: q.createdAt || q.created_at || Date.now(),
    updatedAt: q.updatedAt || q.updated_at || Date.now(),
  };
}

function getText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object' && typeof content.text === 'string') return content.text;
  return String(content);
}

function toQuestionPayload(question: Question) {
  // 从选项中提取正确答案
  const correctIds = (question.options || [])
    .filter(o => o.isCorrect)
    .map(o => o.id);
  
  // 如果有明确的 answer 字段，使用它；否则从选项中提取
  let correctAnswer = question.answer;
  if (!correctAnswer || (Array.isArray(correctAnswer) && correctAnswer.length === 0)) {
    correctAnswer = question.type === 'MULTI' ? correctIds : (correctIds[0] || '');
  }
  
  return {
    deckId: question.deckId,
    content: getText(question.content),
    type: question.type,
    options: (question.options || []).map(o => getText((o as any).content ?? (o as any).text)),
    correctAnswer,
    explanation: question.explanation || '',
    tags: Array.isArray(question.tags) ? question.tags : [],
    difficulty: question.difficulty ?? 3,
  };
}

// 转换 API 响应为前端 Deck 类型
function toDeck(d: any): Deck {
  return {
    id: d.id,
    name: d.name,
    description: d.description || '',
    isPublic: d.isPublic ?? d.is_public ?? false,
    settings: d.settings || {
      newCardsPerDay: 20,
      reviewsPerDay: 100,
      maxInterval: 365,
      learningSteps: [1, 10],
      graduatingInterval: 1,
      easyInterval: 4,
    },
    createdAt: d.createdAt || d.created_at || Date.now(),
    updatedAt: d.updatedAt || d.updated_at || Date.now(),
  };
}

// ============ 题库操作 ============
export const deckOperations = {
  async create(deck: Deck): Promise<string> {
    const result = await request<any>('/decks', {
      method: 'POST',
      body: JSON.stringify({ name: deck.name, description: deck.description }),
    });
    return result.id;
  },

  async getAll(): Promise<Deck[]> {
    const decks = await request<any[]>('/decks');
    return decks.map(toDeck);
  },

  async getById(id: string): Promise<Deck | undefined> {
    try {
      const deck = await request<any>(`/decks/${id}`);
      return toDeck(deck);
    } catch {
      return undefined;
    }
  },

  async update(id: string, changes: Partial<Deck>): Promise<number> {
    await request(`/decks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(changes),
    });
    return 1;
  },

  async delete(id: string): Promise<void> {
    await request(`/decks/${id}`, { method: 'DELETE' });
  },

  async getStats(deckId: string): Promise<{
    total: number;
    new: number;
    learning: number;
    review: number;
    due: number;
    mastered: number;
  }> {
    const stats = await request<any>(`/decks/${deckId}/stats`);
    return {
      total: stats.total || 0,
      new: stats.new || 0,
      learning: stats.learning || 0,
      review: stats.review || 0,
      due: stats.due || 0,
      mastered: stats.mastered || 0,
    };
  }
};

// ============ 题目操作 ============
export const questionOperations = {
  async create(question: Question): Promise<string> {
    const result = await request<any>('/questions', {
      method: 'POST',
      body: JSON.stringify({
        deckId: question.deckId,
        content: typeof question.content === 'object' ? question.content.text : question.content,
        type: question.type,
        options: question.options.map(o => typeof o.content === 'object' ? o.content.text : o.content),
        correctAnswer: question.answer,
        explanation: question.explanation,
        tags: question.tags,
        difficulty: question.difficulty,
      }),
    });
    return result.question?.id || result.id;
  },

  async createBatch(questions: Question[]): Promise<void> {
    if (questions.length === 0) return;
    const deckId = questions[0].deckId;
    await request('/questions/batch', {
      method: 'POST',
      body: JSON.stringify({
        deckId,
        questions: questions.map(q => ({
          content: typeof q.content === 'object' ? q.content.text : q.content,
          type: q.type,
          options: q.options.map(o => typeof o.content === 'object' ? o.content.text : o.content),
          correctAnswer: q.answer,
          explanation: q.explanation,
          tags: q.tags,
          difficulty: q.difficulty,
        })),
      }),
    });
  },

  async getByDeckId(deckId: string): Promise<Question[]> {
    const questions = await request<any[]>(`/questions/deck/${deckId}`);
    return questions.map(toQuestion);
  },

  async getById(id: string): Promise<Question | undefined> {
    try {
      const q = await request<any>(`/questions/${id}`);
      return toQuestion(q);
    } catch {
      return undefined;
    }
  },

  async getByIds(ids: string[]): Promise<Question[]> {
    const results: Question[] = [];
    for (const id of ids) {
      const q = await this.getById(id);
      if (q) results.push(q);
    }
    return results;
  },

  async update(id: string, changes: Partial<Question>): Promise<number> {
    const existing = await questionOperations.getById(id);
    if (!existing) {
      throw new Error('题目不存在');
    }

    const merged: Question = {
      ...existing,
      ...changes,
      content: (changes as any).content ?? existing.content,
      options: (changes as any).options ?? existing.options,
      answer: (changes as any).answer ?? (changes as any).correctAnswer ?? existing.answer,
      tags: (changes as any).tags ?? existing.tags,
    };

    await request(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(toQuestionPayload(merged)),
    });
    return 1;
  },

  async delete(id: string): Promise<void> {
    await request(`/questions/${id}`, { method: 'DELETE' });
  },

  async getByTags(deckId: string, tags: string[]): Promise<Question[]> {
    const questions = await request<any[]>(`/questions/search/tags?deckId=${deckId}&tags=${tags.join(',')}`);
    return questions.map(toQuestion);
  },

  async getAllTags(deckId: string): Promise<string[]> {
    const questions = await this.getByDeckId(deckId);
    const tagSet = new Set<string>();
    questions.forEach(q => q.tags?.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet);
  }
};

// ============ 卡片操作 ============
export const cardOperations = {
  async create(card: Card): Promise<string> {
    return card.id;
  },

  async createBatch(_cards: Card[]): Promise<void> {
    // 卡片在创建题目时自动创建
  },

  async getById(id: string): Promise<Card | undefined> {
    try {
      const c = await request<any>(`/cards/${id}/detail`);
      return toCard(c);
    } catch {
      return undefined;
    }
  },

  async getByQuestionId(_questionId: string): Promise<Card | undefined> {
    return undefined;
  },

  async getDueCards(deckId: string, limit: number = 50): Promise<Card[]> {
    const cards = await request<any[]>(`/cards/deck/${deckId}/due?limit=${limit}`);
    return cards.map(toCard);
  },

  async getNewCards(deckId: string, limit: number = 20): Promise<Card[]> {
    const cards = await request<any[]>(`/cards/deck/${deckId}/new?limit=${limit}`);
    return cards.map(toCard);
  },

  async getHighLapseCards(deckId: string, minLapses: number = 2): Promise<Card[]> {
    const allCards = await request<any[]>(`/cards/deck/${deckId}`);
    return allCards.filter(c => (c.lapses || 0) >= minLapses).map(toCard);
  },

  async update(id: string, changes: Partial<Card>): Promise<number> {
    await request(`/cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        state: changes.state,
        due: changes.dueDate,
        scheduledDays: changes.interval,
        difficulty: changes.easeFactor,
        reps: changes.reps,
        lapses: changes.lapses,
        lastReview: changes.lastReview,
      }),
    });
    return 1;
  },

  async updateBatch(updates: Array<{ id: string; changes: Partial<Card> }>): Promise<void> {
    for (const { id, changes } of updates) {
      await this.update(id, changes);
    }
  },

  async deleteByQuestionId(questionId: string): Promise<void> {
    try {
      await request(`/cards/question/${questionId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Failed to delete cards by question id:', error);
      // 不阻塞主流程，卡片可能已经不存在
    }
  }
};

// ============ 复习日志操作 ============
export const reviewLogOperations = {
  async create(log: ReviewLog & { deckId?: string }): Promise<string> {
    try {
      // 评分映射: 0=again, 2=hard, 3=good, 5=easy
      const ratingToString = (r: number): string => {
        if (r <= 1) return 'again';
        if (r === 2) return 'hard';
        if (r === 3) return 'good';
        return 'easy';
      };
      
      const result = await request<any>('/cards/review-log', {
        method: 'POST',
        body: JSON.stringify({
          cardId: log.cardId,
          deckId: log.deckId || '',
          rating: ratingToString(log.rating),
          state: log.state,
          due: log.reviewTime,
          stability: 0,
          difficulty: 0,
          elapsedDays: 0,
          lastElapsedDays: 0,
          scheduledDays: log.scheduledDays || 0,
          reviewDuration: log.duration || 0,
        }),
      });
      return result.id;
    } catch (error) {
      console.error('Failed to create review log:', error);
      return ''; // 不阻塞主流程
    }
  },

  async getByCardId(_cardId: string): Promise<ReviewLog[]> {
    return [];
  },

  async getByDateRange(_start: number, _end: number): Promise<ReviewLog[]> {
    return [];
  },

  async getTodayStats(): Promise<{ reviews: number; correctRate: number }> {
    try {
      const stats = await request<any>('/stats/overview');
      return {
        reviews: stats.todayReviews || 0,
        correctRate: (stats.accuracy || 0) / 100,
      };
    } catch {
      return { reviews: 0, correctRate: 0 };
    }
  }
};

// ============ 每日记录操作 ============
export const dailyRecordOperations = {
  async recordStudy(_count: number, _duration: number): Promise<void> {
    // 后端自动记录
  },

  async getStreak(): Promise<number> {
    try {
      const result = await request<any>('/stats/streak');
      return result.streak || 0;
    } catch {
      return 0;
    }
  },

  async getHeatmapData(days: number = 365): Promise<DailyRecord[]> {
    try {
      const stats = await request<any[]>(`/stats/daily?days=${days}`);
      return stats.map(s => ({
        date: s.date,
        count: s.reviews || 0,
        duration: 0,
      }));
    } catch {
      return [];
    }
  }
};

// ============ 模拟 db 对象（兼容层）============
export const db = {
  decks: {
    add: (d: Deck) => deckOperations.create(d),
    get: (id: string) => deckOperations.getById(id),
    update: (id: string, changes: Partial<Deck>) => deckOperations.update(id, changes),
    delete: (id: string) => deckOperations.delete(id),
    toArray: () => deckOperations.getAll(),
    orderBy: () => ({ reverse: () => ({ toArray: () => deckOperations.getAll() }) }),
  },
  questions: {
    add: (q: Question) => questionOperations.create(q),
    bulkAdd: (qs: Question[]) => questionOperations.createBatch(qs),
    get: (id: string) => questionOperations.getById(id),
    update: (id: string, changes: Partial<Question>) => questionOperations.update(id, changes),
    delete: (id: string) => questionOperations.delete(id),
    toArray: async () => {
      // 获取所有题库的所有题目
      const decks = await deckOperations.getAll();
      const allQuestions: Question[] = [];
      for (const deck of decks) {
        const qs = await questionOperations.getByDeckId(deck.id);
        allQuestions.push(...qs);
      }
      return allQuestions;
    },
    where: (field: string) => ({
      equals: (value: string) => ({
        toArray: () => field === 'deckId' ? questionOperations.getByDeckId(value) : Promise.resolve([]),
        filter: () => ({ toArray: () => questionOperations.getByDeckId(value) }),
      }),
      anyOf: (ids: string[]) => ({ toArray: () => questionOperations.getByIds(ids) }),
    }),
  },
  cards: {
    add: (c: Card) => cardOperations.create(c),
    bulkAdd: (cs: Card[]) => cardOperations.createBatch(cs),
    get: (id: string) => cardOperations.getById(id),
    update: (id: string, changes: Partial<Card>) => cardOperations.update(id, changes),
    toArray: async () => {
      // 获取所有题库的所有卡片
      const decks = await deckOperations.getAll();
      const allCards: Card[] = [];
      for (const deck of decks) {
        try {
          const cards = await request<any[]>(`/cards/deck/${deck.id}`);
          allCards.push(...cards.map(toCard));
        } catch {
          // ignore
        }
      }
      return allCards;
    },
    where: (field: string) => ({
      equals: (value: string) => ({
        toArray: async () => {
          if (field === 'deckId') {
            const cards = await request<any[]>(`/cards/deck/${value}`);
            return cards.map(toCard);
          }
          return [];
        },
        filter: (fn: (c: Card) => boolean) => ({
          toArray: async () => {
            if (field === 'deckId') {
              const cards = await request<any[]>(`/cards/deck/${value}`);
              return cards.map(toCard).filter(fn);
            }
            return [];
          },
        }),
        first: () => Promise.resolve(undefined),
      }),
    }),
  },
  reviewLogs: {
    add: (log: ReviewLog) => reviewLogOperations.create(log),
    where: () => ({
      equals: () => ({ toArray: () => Promise.resolve([]) }),
      between: () => ({ toArray: () => Promise.resolve([]) }),
      aboveOrEqual: () => ({ toArray: () => Promise.resolve([]) }),
      anyOf: () => ({ delete: () => Promise.resolve() }),
    }),
  },
  dailyRecords: {
    add: (r: DailyRecord) => Promise.resolve(r.date),
    get: () => Promise.resolve(undefined),
    update: () => Promise.resolve(1),
    orderBy: () => ({ reverse: () => ({ toArray: () => dailyRecordOperations.getHeatmapData() }) }),
    where: () => ({ aboveOrEqual: () => ({ toArray: () => dailyRecordOperations.getHeatmapData() }) }),
  },
  transaction: async <T>(_mode: string, _tables: any[], fn: () => Promise<T>): Promise<T> => fn(),
};

// ============ 错题本操作 ============
export interface WrongQuestion {
  id: string;
  questionId: string;
  deckId: string;
  wrongCount: number;
  lastWrongTime: number;
  firstWrongTime: number;
  userAnswer: string[];
  correctAnswer: string | string[];
  question?: Question;
  createdAt: number;
  updatedAt: number;
}

export const wrongQuestionOperations = {
  async getByDeckId(deckId: string): Promise<WrongQuestion[]> {
    const data = await request<any[]>(`/wrong-questions/deck/${deckId}`);
    return data;
  },

  async getAll(): Promise<WrongQuestion[]> {
    const data = await request<any[]>('/wrong-questions/all');
    return data;
  },

  async getStats(deckId: string): Promise<{
    totalWrong: number;
    hardCount: number;
    mediumCount: number;
    totalLapses: number;
    avgAccuracy: number;
  }> {
    return request(`/wrong-questions/deck/${deckId}/stats`);
  },

  async getAllStats(): Promise<{
    totalWrong: number;
    hardCount: number;
    mediumCount: number;
    totalLapses: number;
    avgAccuracy: number;
  }> {
    return request('/wrong-questions/all/stats');
  },

  async add(questionId: string, deckId: string, userAnswer: string[], correctAnswer: string | string[]): Promise<{ id: string; wrongCount: number }> {
    return request('/wrong-questions', {
      method: 'POST',
      body: JSON.stringify({ questionId, deckId, userAnswer, correctAnswer }),
    });
  },

  async delete(id: string): Promise<void> {
    await request(`/wrong-questions/${id}`, { method: 'DELETE' });
  },

  async resetByQuestionId(questionId: string): Promise<void> {
    await request(`/wrong-questions/question/${questionId}`, { method: 'DELETE' });
  }
};

// 收藏类型
export interface Favorite {
  id: string;
  questionId: string;
  deckId: string;
  deckName?: string;
  content: string;
  type: string;
  options: any[];
  tags: string[];
  difficulty: number;
  createdAt: number;
}

// 收藏操作
export const favoriteOperations = {
  async getAll(): Promise<Favorite[]> {
    return request('/favorites');
  },

  async getByDeckId(deckId: string): Promise<Favorite[]> {
    return request(`/favorites/deck/${deckId}`);
  },

  async isFavorite(questionId: string): Promise<boolean> {
    const result = await request<{ isFavorite: boolean }>(`/favorites/check/${questionId}`);
    return result.isFavorite;
  },

  async add(questionId: string, deckId: string): Promise<{ id: string; exists: boolean }> {
    return request('/favorites', {
      method: 'POST',
      body: JSON.stringify({ questionId, deckId }),
    });
  },

  async remove(questionId: string): Promise<void> {
    await request(`/favorites/question/${questionId}`, { method: 'DELETE' });
  },

  async removeById(id: string): Promise<void> {
    await request(`/favorites/${id}`, { method: 'DELETE' });
  }
};

// 笔记类型
export interface Note {
  id: string;
  questionId: string;
  deckId?: string;
  content: string;
  questionContent?: string;
  createdAt: number;
  updatedAt: number;
}

// 笔记操作
export const noteOperations = {
  async getByQuestionId(questionId: string): Promise<Note | null> {
    return request(`/notes/question/${questionId}`);
  },

  async getAll(): Promise<Note[]> {
    return request('/notes');
  },

  async save(questionId: string, content: string): Promise<{ id: string; updated: boolean }> {
    return request('/notes', {
      method: 'POST',
      body: JSON.stringify({ questionId, content }),
    });
  },

  async delete(questionId: string): Promise<void> {
    await request(`/notes/question/${questionId}`, { method: 'DELETE' });
  }
};

// 成就类型
export interface Achievement {
  id: string;
  achievementId: string;
  unlockedAt: number;
}

// 成就操作
export const achievementOperations = {
  async getAll(): Promise<Achievement[]> {
    return request('/achievements');
  },

  async isUnlocked(achievementId: string): Promise<boolean> {
    const result = await request<{ unlocked: boolean }>(`/achievements/check/${achievementId}`);
    return result.unlocked;
  },

  async unlock(achievementId: string): Promise<{ id: string; alreadyUnlocked: boolean }> {
    return request('/achievements', {
      method: 'POST',
      body: JSON.stringify({ achievementId }),
    });
  },

  async reset(): Promise<void> {
    await request('/achievements/reset', { method: 'DELETE' });
  }
};

// 学习计划类型
export interface StudyPlan {
  id: string;
  name: string;
  description?: string;
  targetQuestions: number;
  completedQuestions: number;
  startDate: number;
  endDate: number;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'paused';
  deckIds: string[];
  createdAt: number;
  updatedAt: number;
}

// 学习计划操作
export const studyPlanOperations = {
  async getAll(): Promise<StudyPlan[]> {
    return request('/study-plans');
  },

  async getById(id: string): Promise<StudyPlan> {
    return request(`/study-plans/${id}`);
  },

  async create(plan: Omit<StudyPlan, 'id' | 'completedQuestions' | 'status' | 'createdAt' | 'updatedAt'>): Promise<{ id: string }> {
    return request('/study-plans', {
      method: 'POST',
      body: JSON.stringify(plan),
    });
  },

  async update(id: string, updates: Partial<StudyPlan>): Promise<void> {
    await request(`/study-plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async updateProgress(id: string, increment: number = 1): Promise<void> {
    await request(`/study-plans/${id}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ increment }),
    });
  },

  async delete(id: string): Promise<void> {
    await request(`/study-plans/${id}`, { method: 'DELETE' });
  }
};

// 提醒类型
export interface Reminder {
  id: string;
  time: string;
  days: number[];
  message?: string;
  enabled: boolean;
  sound: boolean;
  createdAt: number;
}

// 提醒操作
export const reminderOperations = {
  async getAll(): Promise<Reminder[]> {
    return request('/reminders');
  },

  async create(reminder: Omit<Reminder, 'id' | 'createdAt'>): Promise<{ id: string }> {
    return request('/reminders', {
      method: 'POST',
      body: JSON.stringify(reminder),
    });
  },

  async update(id: string, updates: Partial<Reminder>): Promise<void> {
    await request(`/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async toggle(id: string): Promise<void> {
    await request(`/reminders/${id}/toggle`, { method: 'PATCH' });
  },

  async delete(id: string): Promise<void> {
    await request(`/reminders/${id}`, { method: 'DELETE' });
  }
};

export default db;
