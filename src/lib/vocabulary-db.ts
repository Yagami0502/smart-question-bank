/**
 * 词库数据库操作 - MySQL API 版本
 * 通过后端 API 访问 MySQL 数据库
 */
import type {
  Word,
  VocabularyBook,
  UserVocabulary,
  WordProgress,
  WrongWord,
  FavoriteWord,
  MasteredWord,
  VocabularySettings,
} from '../types/vocabulary';
import { defaultVocabularySettings } from '../types/vocabulary';
import { authFetch } from './auth';

const API_BASE = '/api/vocabulary';

// 通用请求函数
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await authFetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '请求失败');
  }

  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

// ============================================
// 词库操作
// ============================================
export const vocabularyBookOperations = {
  // 获取所有内置词库（公共词库）
  async getBuiltInBooks(): Promise<VocabularyBook[]> {
    const books = await apiRequest<any[]>('/books/public');
    return books.filter(b => b.is_built_in).map(transformBook);
  },

  // 获取所有公共词库
  async getPublicBooks(): Promise<VocabularyBook[]> {
    const books = await apiRequest<any[]>('/books/public');
    return books.map(transformBook);
  },

  // 获取词库详情
  async getById(id: string): Promise<VocabularyBook | undefined> {
    try {
      const book = await apiRequest<any>(`/books/${id}`);
      return transformBook(book);
    } catch {
      return undefined;
    }
  },

  // 创建自定义词库
  async create(book: Omit<VocabularyBook, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const result = await apiRequest<{ id: string }>('/books', {
      method: 'POST',
      body: JSON.stringify(book),
    });
    return result.id;
  },

  // 更新词库
  async update(id: string, data: Partial<VocabularyBook>): Promise<void> {
    await apiRequest(`/books/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // 删除词库
  async delete(id: string): Promise<void> {
    await apiRequest(`/books/${id}`, { method: 'DELETE' });
  },

  // 切换词库公开状态
  async togglePublic(id: string, isPublic: boolean): Promise<void> {
    await apiRequest(`/books/${id}/public`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublic }),
    });
  },
};

// 转换词库数据格式
function transformBook(raw: any): VocabularyBook {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    isBuiltIn: raw.is_built_in,
    isPublic: raw.is_public,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

// ============================================
// 单词操作
// ============================================

// 转换单词数据格式
function transformWord(raw: any): Word {
  return {
    id: raw.id,
    bookId: raw.book_id || raw.bookId,
    word: raw.word,
    phonetic: raw.phonetic || {
      us: raw.phonetic_us,
      uk: raw.phonetic_uk,
    },
    translations: Array.isArray(raw.translations) 
      ? raw.translations.map((t: any) => ({
          type: t.type || t.pos || '',
          translation: t.translation || t.cn || '',
        }))
      : [],
    phrases: raw.phrases || [],
    sentences: raw.sentences || [],
    synonyms: raw.synonyms || [],
    antonyms: raw.antonyms || [],
  };
}

export const wordOperations = {
  // 获取词库中的所有单词
  async getByBookId(bookId: string, page = 1, limit = 1000): Promise<Word[]> {
    const words = await apiRequest<any[]>(`/books/${bookId}/words?page=${page}&limit=${limit}`);
    return words.map(transformWord);
  },

  // 获取单个单词
  async getById(_id: string): Promise<Word | undefined> {
    // 单词详情通过词库单词列表获取，暂不单独实现
    console.warn('getById 暂未实现，请使用 getByBookId');
    return undefined;
  },

  async bulkAdd(bookId: string, words: Word[]): Promise<void> {
    await apiRequest(`/books/${bookId}/import`, {
      method: 'POST',
      body: JSON.stringify({ words }),
    });
  },

  // 更新单词（暂不支持）
  async update(_id: string, _updates: Partial<Word>): Promise<void> {
    throw new Error('更新单词功能暂未开放');
  },

  // 删除单词（暂不支持）
  async delete(_id: string): Promise<void> {
    throw new Error('删除单词功能暂未开放');
  },

  // 搜索单词
  async search(query: string, bookId?: string): Promise<Word[]> {
    // 简单实现：获取词库单词后在前端过滤
    if (!bookId) return [];
    const words = await this.getByBookId(bookId);
    return words.filter(w => 
      w.word.toLowerCase().startsWith(query.toLowerCase())
    ).slice(0, 50);
  },
};

// ============================================
// 用户词库操作
// ============================================
export const userVocabularyOperations = {
  // 获取用户所有词库
  async getAll(): Promise<UserVocabulary[]> {
    const vocabularies = await apiRequest<any[]>('/user/books');
    return vocabularies.map(transformUserVocabulary);
  },

  // 获取用户所有词库（带实时统计）
  async getAllWithStats(): Promise<(UserVocabulary & { wordCount: number; isBuiltIn?: boolean; isPublic?: boolean; isOwner?: boolean })[]> {
    const vocabularies = await apiRequest<any[]>('/user/books');
    return vocabularies.map(v => ({
      ...transformUserVocabulary(v),
      wordCount: v.word_count || 0,
      isBuiltIn: v.is_built_in || false,
      isPublic: v.is_public || false,
      isOwner: v.isOwner || false,
    }));
  },

  // 获取单个词库的实时统计
  async getStatsForBook(bookId: string): Promise<{ wordCount: number; learnedCount: number; masteredCount: number }> {
    return apiRequest(`/user/books/${bookId}/stats`);
  },

  // 添加词库到我的词库
  async add(bookId: string, _bookName: string): Promise<string> {
    const result = await apiRequest<{ id: string }>('/user/books', {
      method: 'POST',
      body: JSON.stringify({ bookId }),
    });
    return result.id;
  },

  // 更新学习进度（由后端自动处理）
  async updateProgress(_bookId: string): Promise<void> {
    // 后端在更新进度时会自动更新统计
  },

  // 移除词库
  async remove(bookId: string): Promise<void> {
    await apiRequest(`/user/books/${bookId}`, { method: 'DELETE' });
  },
};

// 转换用户词库数据格式
function transformUserVocabulary(raw: any): UserVocabulary {
  return {
    id: raw.id,
    bookId: raw.book_id || raw.bookId,
    bookName: raw.book_name || raw.bookName,
    learnedCount: raw.learned_count || raw.learnedCount || 0,
    masteredCount: raw.mastered_count || raw.masteredCount || 0,
    createdAt: raw.created_at || raw.createdAt,
    updatedAt: raw.updated_at || raw.updatedAt,
  };
}


// ============================================
// 学习进度操作
// ============================================
export const wordProgressOperations = {
  // 获取单词学习进度
  async get(_wordId: string): Promise<WordProgress | undefined> {
    // 暂不单独实现，通过 getByBookId 获取
    return undefined;
  },

  // 获取词库的所有学习进度
  async getByBookId(bookId: string): Promise<WordProgress[]> {
    const progress = await apiRequest<any[]>(`/user/books/${bookId}/progress`);
    return progress.map(transformWordProgress);
  },

  // 获取待复习单词
  async getDueWords(bookId: string, limit: number = 50): Promise<WordProgress[]> {
    const allProgress = await this.getByBookId(bookId);
    const now = Date.now();
    return allProgress
      .filter(p => (p.state === 'learning' || p.state === 'review') && p.dueDate <= now)
      .slice(0, limit);
  },

  // 获取新单词
  async getNewWords(bookId: string, limit: number = 20): Promise<WordProgress[]> {
    const allProgress = await this.getByBookId(bookId);
    return allProgress.filter(p => p.state === 'new').slice(0, limit);
  },

  // 初始化单词进度（由后端自动处理）
  async initProgress(_wordId: string, _bookId: string, _word: string): Promise<void> {
    // 后端在首次更新进度时会自动初始化
  },

  // 更新学习进度
  async updateProgress(wordId: string, isCorrect: boolean, bookId?: string): Promise<void> {
    await apiRequest('/user/progress', {
      method: 'POST',
      body: JSON.stringify({ wordId, bookId, isCorrect }),
    });
  },

  // 删除学习进度
  async delete(wordId: string): Promise<void> {
    await apiRequest(`/user/progress/${wordId}`, { method: 'DELETE' });
  },
};

// 转换学习进度数据格式
function transformWordProgress(raw: any): WordProgress {
  return {
    id: raw.id,
    wordId: raw.wordId || raw.word_id,
    bookId: raw.bookId || raw.book_id,
    word: raw.word,
    state: raw.state,
    dueDate: raw.dueDate || raw.due_date,
    interval: raw.interval || raw.interval_days || 0,
    easeFactor: raw.easeFactor || raw.ease_factor || 2.5,
    reps: raw.reps || 0,
    lapses: raw.lapses || 0,
    correctCount: raw.correctCount || raw.correct_count || 0,
    wrongCount: raw.wrongCount || raw.wrong_count || 0,
    lastReview: raw.lastReview || raw.last_review,
    createdAt: raw.createdAt || raw.created_at,
    updatedAt: raw.updatedAt || raw.updated_at,
  };
}

// ============================================
// 错词本操作
// ============================================
export const wrongWordOperations = {
  async getAll(): Promise<WrongWord[]> {
    const words = await apiRequest<any[]>('/user/wrong-words');
    return words.map(transformWrongWord);
  },

  async getByBookId(bookId: string): Promise<WrongWord[]> {
    const words = await apiRequest<any[]>(`/user/wrong-words?bookId=${bookId}`);
    return words.map(transformWrongWord);
  },

  async add(wordId: string, bookId: string, word: string, userInput: string): Promise<void> {
    await apiRequest('/user/wrong-words', {
      method: 'POST',
      body: JSON.stringify({ wordId, bookId, word, userInput }),
    });
  },

  async remove(wordId: string): Promise<void> {
    await apiRequest(`/user/wrong-words/${wordId}`, { method: 'DELETE' });
  },

  async clear(): Promise<void> {
    await apiRequest('/user/wrong-words', { method: 'DELETE' });
  },
};

// 转换错词数据格式
function transformWrongWord(raw: any): WrongWord {
  return {
    id: raw.id,
    wordId: raw.word_id || raw.wordId,
    bookId: raw.book_id || raw.bookId,
    word: raw.word,
    wrongCount: raw.wrong_count || raw.wrongCount || 1,
    lastWrongTime: raw.last_wrong_time || raw.lastWrongTime,
    userInputs: raw.userInputs || raw.user_inputs || [],
    createdAt: raw.created_at || raw.createdAt,
  };
}

// ============================================
// 收藏操作
// ============================================
export const favoriteWordOperations = {
  async getAll(): Promise<FavoriteWord[]> {
    const favorites = await apiRequest<any[]>('/user/favorites');
    return favorites.map(transformFavoriteWord);
  },

  async isFavorite(wordId: string): Promise<boolean> {
    const favorites = await this.getAll();
    return favorites.some(f => f.wordId === wordId);
  },

  async toggle(wordId: string, bookId: string, word: string): Promise<boolean> {
    const result = await apiRequest<{ isFavorite: boolean }>('/user/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify({ wordId, bookId, word }),
    });
    return result.isFavorite;
  },

  async remove(wordId: string): Promise<void> {
    // 使用 toggle 来移除
    await this.toggle(wordId, '', '');
  },

  async clear(): Promise<void> {
    await apiRequest('/user/favorites', { method: 'DELETE' });
  },
};

// 转换收藏数据格式
function transformFavoriteWord(raw: any): FavoriteWord {
  return {
    id: raw.id,
    wordId: raw.word_id || raw.wordId,
    bookId: raw.book_id || raw.bookId,
    word: raw.word,
    createdAt: raw.created_at || raw.createdAt,
  };
}

// ============================================
// 已掌握操作
// ============================================
export const masteredWordOperations = {
  async getAll(): Promise<MasteredWord[]> {
    const mastered = await apiRequest<any[]>('/user/mastered');
    return mastered.map(m => ({
      id: m.id,
      wordId: m.wordId,
      bookId: m.bookId,
      word: m.word,
      masteredAt: m.masteredAt,
    }));
  },

  async isMastered(wordId: string): Promise<boolean> {
    const mastered = await this.getAll();
    return mastered.some(m => m.wordId === wordId);
  },

  async add(wordId: string, bookId: string, word: string): Promise<void> {
    await apiRequest('/user/mastered', {
      method: 'POST',
      body: JSON.stringify({ wordId, bookId, word }),
    });
  },

  async remove(wordId: string): Promise<void> {
    await apiRequest(`/user/mastered/${wordId}`, { method: 'DELETE' });
  },
};

// ============================================
// 设置操作
// ============================================
export const vocabularySettingsOperations = {
  async get(): Promise<VocabularySettings> {
    try {
      const settings = await apiRequest<any>('/user/settings');
      return {
        autoPlayAudio: settings.autoPlayAudio ?? defaultVocabularySettings.autoPlayAudio,
        voiceType: settings.voiceType ?? defaultVocabularySettings.voiceType,
        voiceRate: settings.speechRate ?? defaultVocabularySettings.voiceRate,
        dailyNewWords: settings.dailyNewWords ?? defaultVocabularySettings.dailyNewWords,
        dailyReviewWords: settings.dailyReviewWords ?? defaultVocabularySettings.dailyReviewWords,
        showPhonetic: settings.showPhonetic ?? defaultVocabularySettings.showPhonetic,
        showExample: settings.showExample ?? defaultVocabularySettings.showExample,
        keyboardSound: settings.keyboardSound ?? defaultVocabularySettings.keyboardSound,
        keyboardSoundType: settings.keyboardSoundType ?? defaultVocabularySettings.keyboardSoundType,
        shortcuts: defaultVocabularySettings.shortcuts,
      };
    } catch {
      return { ...defaultVocabularySettings };
    }
  },

  async save(settings: Partial<VocabularySettings>): Promise<void> {
    await apiRequest('/user/settings', {
      method: 'PUT',
      body: JSON.stringify({
        dailyNewWords: settings.dailyNewWords,
        dailyReviewWords: settings.dailyReviewWords,
        autoPlayAudio: settings.autoPlayAudio,
        voiceType: settings.voiceType,
        speechRate: settings.voiceRate,
        showPhonetic: settings.showPhonetic,
        showExample: settings.showExample,
        keyboardSound: settings.keyboardSound,
        keyboardSoundType: settings.keyboardSoundType,
      }),
    });
  },
};

// ============================================
// 练习相关 API
// ============================================
export const practiceOperations = {
  // 获取练习单词
  async getPracticeWords(bookId: string, mode: 'smart' | 'free' = 'smart', limit = 20): Promise<Word[]> {
    const words = await apiRequest<any[]>(
      `/user/books/${bookId}/practice?mode=${mode}&limit=${limit}`
    );
    return words.map(transformWord);
  },
};

// 兼容旧代码：导出空的 vocabularyDb 对象
export const vocabularyDb = {
  // 这是一个占位符，用于兼容可能直接访问 vocabularyDb 的旧代码
  // 新代码应该使用上面导出的各个 operations 对象
};

// ============================================
// 文章操作
// ============================================
import type { Article } from '../types/vocabulary';

export const articleOperations = {
  async getAll(): Promise<Article[]> {
    const articles = await apiRequest<any[]>('/articles');
    return articles.map(transformArticle);
  },

  async add(article: Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'sentences'>): Promise<Article> {
    const result = await apiRequest<any>('/articles', {
      method: 'POST',
      body: JSON.stringify(article),
    });
    return transformArticle(result);
  },

  async delete(articleId: string): Promise<void> {
    await apiRequest(`/articles/${articleId}`, { method: 'DELETE' });
  },
};

// 转换文章数据格式
function transformArticle(raw: any): Article {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content,
    translation: raw.translation,
    sentences: [], // 文章句子需要单独解析
    category: raw.category,
    source: raw.source,
    isBuiltIn: raw.isBuiltIn || raw.is_built_in || false,
    createdAt: raw.createdAt || raw.created_at,
    updatedAt: raw.updatedAt || raw.updated_at,
  };
}
