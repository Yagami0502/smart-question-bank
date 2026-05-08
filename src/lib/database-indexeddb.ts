/**
 * IndexedDB 数据库 - 使用 Dexie
 * 这是原始的本地存储实现
 */

import Dexie, { Table } from 'dexie';
import type { Deck, Question, Card, ReviewLog, DailyRecord } from '../types';

// 定义数据库类
class QuestionBankDB extends Dexie {
  decks!: Table<Deck, string>;
  questions!: Table<Question, string>;
  cards!: Table<Card, string>;
  reviewLogs!: Table<ReviewLog, string>;
  dailyRecords!: Table<DailyRecord, string>;

  constructor() {
    super('SmartQuestionBank');
    
    this.version(1).stores({
      decks: 'id, name, createdAt, updatedAt',
      questions: 'id, deckId, type, *tags, difficulty, createdAt',
      cards: 'id, questionId, deckId, state, dueDate, lapses, lastReview',
      reviewLogs: 'id, cardId, questionId, reviewTime, rating',
      dailyRecords: 'date, count'
    });
  }
}

// 创建数据库单例
export const db = new QuestionBankDB();

// 题库操作
export const deckOperations = {
  async create(deck: Deck): Promise<string> {
    return await db.decks.add(deck);
  },

  async getAll(): Promise<Deck[]> {
    return await db.decks.orderBy('updatedAt').reverse().toArray();
  },

  async getById(id: string): Promise<Deck | undefined> {
    return await db.decks.get(id);
  },

  async update(id: string, changes: Partial<Deck>): Promise<number> {
    return await db.decks.update(id, { ...changes, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.decks, db.questions, db.cards, db.reviewLogs], async () => {
      const questions = await db.questions.where('deckId').equals(id).toArray();
      const questionIds = questions.map(q => q.id);
      
      await db.reviewLogs.where('questionId').anyOf(questionIds).delete();
      await db.cards.where('deckId').equals(id).delete();
      await db.questions.where('deckId').equals(id).delete();
      await db.decks.delete(id);
    });
  },

  async getStats(deckId: string): Promise<{
    total: number;
    new: number;
    learning: number;
    review: number;
    due: number;
    mastered: number;
  }> {
    const now = Date.now();
    const cards = await db.cards.where('deckId').equals(deckId).toArray();
    
    let newCount = 0;
    let learningCount = 0;
    let reviewCount = 0;
    let masteredCount = 0;
    
    cards.forEach(c => {
      if (c.state === 'new') {
        newCount++;
      } else if (c.state === 'learning' || c.state === 'relearning') {
        learningCount++;
      } else if (c.state === 'review') {
        if (c.dueDate <= now) {
          // 待复习
          reviewCount++;
        } else {
          // 检查是否已掌握
          const reps = c.reps || 0;
          const lapses = c.lapses || 0;
          const total = reps + lapses;
          const accuracy = total > 0 ? reps / total : 0;
          if (reps >= 10 && accuracy >= 0.9) {
            masteredCount++;
          } else {
            learningCount++;
          }
        }
      }
    });
    
    return {
      total: cards.length,
      new: newCount,
      learning: learningCount,
      review: reviewCount,
      due: cards.filter(c => c.dueDate <= now).length,
      mastered: masteredCount
    };
  }
};

// 题目操作
export const questionOperations = {
  async create(question: Question): Promise<string> {
    return await db.questions.add(question);
  },

  async createBatch(questions: Question[]): Promise<void> {
    await db.questions.bulkAdd(questions);
  },

  async getByDeckId(deckId: string): Promise<Question[]> {
    return await db.questions.where('deckId').equals(deckId).toArray();
  },

  async getById(id: string): Promise<Question | undefined> {
    return await db.questions.get(id);
  },

  async getByIds(ids: string[]): Promise<Question[]> {
    return await db.questions.where('id').anyOf(ids).toArray();
  },

  async update(id: string, changes: Partial<Question>): Promise<number> {
    return await db.questions.update(id, { ...changes, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.questions, db.cards, db.reviewLogs], async () => {
      await db.reviewLogs.where('questionId').equals(id).delete();
      await db.cards.where('questionId').equals(id).delete();
      await db.questions.delete(id);
    });
  },

  async getByTags(deckId: string, tags: string[]): Promise<Question[]> {
    const questions = await db.questions.where('deckId').equals(deckId).toArray();
    return questions.filter(q => tags.some(tag => q.tags.includes(tag)));
  },

  async getAllTags(deckId: string): Promise<string[]> {
    const questions = await db.questions.where('deckId').equals(deckId).toArray();
    const tagSet = new Set<string>();
    questions.forEach(q => q.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet);
  }
};

// 卡片操作
export const cardOperations = {
  async create(card: Card): Promise<string> {
    return await db.cards.add(card);
  },

  async createBatch(cards: Card[]): Promise<void> {
    await db.cards.bulkAdd(cards);
  },

  async getById(id: string): Promise<Card | undefined> {
    return await db.cards.get(id);
  },

  async getByQuestionId(questionId: string): Promise<Card | undefined> {
    return await db.cards.where('questionId').equals(questionId).first();
  },

  async getDueCards(deckId: string, limit?: number): Promise<Card[]> {
    const now = Date.now();
    let query = db.cards
      .where('deckId').equals(deckId)
      .filter(card => card.dueDate <= now);
    
    const cards = await query.toArray();
    
    cards.sort((a, b) => {
      if (a.state === 'new' && b.state !== 'new') return -1;
      if (a.state !== 'new' && b.state === 'new') return 1;
      return a.dueDate - b.dueDate;
    });
    
    return limit ? cards.slice(0, limit) : cards;
  },

  async getNewCards(deckId: string, limit?: number): Promise<Card[]> {
    const cards = await db.cards
      .where('deckId').equals(deckId)
      .filter(card => card.state === 'new')
      .toArray();
    
    return limit ? cards.slice(0, limit) : cards;
  },

  async getHighLapseCards(deckId: string, minLapses: number = 2): Promise<Card[]> {
    return await db.cards
      .where('deckId').equals(deckId)
      .filter(card => card.lapses >= minLapses)
      .toArray();
  },

  async update(id: string, changes: Partial<Card>): Promise<number> {
    return await db.cards.update(id, changes);
  },

  async updateBatch(updates: Array<{ id: string; changes: Partial<Card> }>): Promise<void> {
    await db.transaction('rw', db.cards, async () => {
      for (const { id, changes } of updates) {
        await db.cards.update(id, changes);
      }
    });
  }
};

// 复习日志操作
export const reviewLogOperations = {
  async create(log: ReviewLog): Promise<string> {
    return await db.reviewLogs.add(log);
  },

  async getByCardId(cardId: string): Promise<ReviewLog[]> {
    return await db.reviewLogs.where('cardId').equals(cardId).toArray();
  },

  async getByDateRange(start: number, end: number): Promise<ReviewLog[]> {
    return await db.reviewLogs
      .where('reviewTime')
      .between(start, end)
      .toArray();
  },

  async getTodayStats(): Promise<{ reviews: number; correctRate: number }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const logs = await db.reviewLogs
      .where('reviewTime')
      .aboveOrEqual(startOfDay.getTime())
      .toArray();
    
    if (logs.length === 0) {
      return { reviews: 0, correctRate: 0 };
    }
    
    const correctCount = logs.filter(log => log.rating >= 3).length;
    return {
      reviews: logs.length,
      correctRate: correctCount / logs.length
    };
  }
};

// 每日记录操作
export const dailyRecordOperations = {
  async recordStudy(count: number, duration: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const existing = await db.dailyRecords.get(today);
    
    if (existing) {
      await db.dailyRecords.update(today, {
        count: existing.count + count,
        duration: existing.duration + duration
      });
    } else {
      await db.dailyRecords.add({ date: today, count, duration });
    }
  },

  async getStreak(): Promise<number> {
    const records = await db.dailyRecords.orderBy('date').reverse().toArray();
    
    if (records.length === 0) return 0;
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < records.length; i++) {
      const recordDate = new Date(records[i].date);
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      
      if (recordDate.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
        streak++;
      } else if (i === 0) {
        expectedDate.setDate(expectedDate.getDate() - 1);
        if (recordDate.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
          streak++;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    
    return streak;
  },

  async getHeatmapData(days: number = 365): Promise<DailyRecord[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return await db.dailyRecords
      .where('date')
      .aboveOrEqual(startDate.toISOString().split('T')[0])
      .toArray();
  }
};

export default db;
