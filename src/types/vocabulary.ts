/**
 * 词库相关类型定义
 */

// 单词翻译
export interface WordTranslation {
  type: string;        // 词性: n, v, adj, adv 等
  translation: string; // 释义
}

// 单词短语
export interface WordPhrase {
  phrase: string;      // 短语
  translation: string; // 短语释义
}

// 单词例句
export interface WordSentence {
  sentence: string;    // 例句
  translation: string; // 例句翻译
}

// 单词数据
export interface Word {
  id: string;
  bookId: string;                  // 所属词库ID
  word: string;                    // 单词
  phonetic?: {                     // 音标
    us?: string;                   // 美式音标
    uk?: string;                   // 英式音标
  };
  translations: WordTranslation[]; // 释义列表
  phrases?: WordPhrase[];          // 短语列表
  sentences?: WordSentence[];      // 例句列表
  synonyms?: string[];             // 近义词
  antonyms?: string[];             // 反义词
  roots?: string[];                // 同根词
  etymology?: string;              // 词源
}

// 词库信息
export interface VocabularyBook {
  id: string;
  name: string;
  description?: string;
  isBuiltIn: boolean;    // 是否内置词库
  isPublic: boolean;     // 是否公共词库
  authorId?: string;
  authorName?: string;
  createdAt: number;
  updatedAt: number;
}

// 用户词库（我的词库）
export interface UserVocabulary {
  id: string;
  bookId: string;        // 关联的词库ID
  bookName: string;      // 词库名称（冗余存储方便显示）
  learnedCount: number;  // 已学习数量
  masteredCount: number; // 已掌握数量
  createdAt: number;
  updatedAt: number;
}

// 单词学习状态
export type WordState = 'new' | 'learning' | 'review' | 'mastered';

// 单词学习记录
export interface WordProgress {
  id: string;
  wordId: string;
  bookId: string;
  word: string;          // 冗余存储方便查询
  state: WordState;
  dueDate: number;       // 下次复习时间
  interval: number;      // 复习间隔（天）
  easeFactor: number;    // 难度因子
  reps: number;          // 复习次数
  lapses: number;        // 遗忘次数
  correctCount: number;  // 正确次数
  wrongCount: number;    // 错误次数
  lastReview?: number;   // 上次复习时间
  createdAt: number;
  updatedAt: number;
}

// 错词记录
export interface WrongWord {
  id: string;
  wordId: string;
  bookId: string;
  word: string;
  wrongCount: number;
  lastWrongTime: number;
  userInputs: string[];  // 用户错误输入记录
  createdAt: number;
}

// 收藏单词
export interface FavoriteWord {
  id: string;
  wordId: string;
  bookId: string;
  word: string;
  createdAt: number;
}

// 已掌握单词
export interface MasteredWord {
  id: string;
  wordId: string;
  bookId: string;
  word: string;
  masteredAt: number;
}

// 练习模式
export type PracticeType = 'typing' | 'review' | 'dictation';

// 学习模式
export type LearningMode = 'smart' | 'free';

// 练习会话
export interface VocabularySession {
  bookId: string;
  mode: LearningMode;
  practiceType: PracticeType;
  words: Word[];
  currentIndex: number;
  startTime: number;
  correctCount: number;
  wrongCount: number;
}

// 文章数据
export interface Article {
  id: string;
  title: string;
  content: string;
  translation?: string;
  sentences: ArticleSentence[];
  category?: string;
  source?: string;
  isBuiltIn: boolean;
  createdAt: number;
  updatedAt: number;
}

// 文章句子
export interface ArticleSentence {
  id: string;
  text: string;
  translation?: string;
  audioUrl?: string;
}

// 词库设置
export interface VocabularySettings {
  // 发音设置
  autoPlayAudio: boolean;
  voiceType: 'us' | 'uk';
  voiceRate: number;
  
  // 练习设置
  dailyNewWords: number;
  dailyReviewWords: number;
  showPhonetic: boolean;
  showExample: boolean;
  
  // 键盘音效
  keyboardSound: boolean;
  keyboardSoundType: 'mechanical' | 'typewriter' | 'soft' | 'none';
  
  // 快捷键
  shortcuts: {
    playAudio: string;
    nextWord: string;
    prevWord: string;
    showAnswer: string;
    markMastered: string;
    addFavorite: string;
  };
}

// 默认设置
export const defaultVocabularySettings: VocabularySettings = {
  autoPlayAudio: true,
  voiceType: 'us',
  voiceRate: 1,
  dailyNewWords: 20,
  dailyReviewWords: 50,
  showPhonetic: true,
  showExample: true,
  keyboardSound: false,
  keyboardSoundType: 'mechanical',
  shortcuts: {
    playAudio: 'Space',
    nextWord: 'Enter',
    prevWord: 'Backspace',
    showAnswer: 'Tab',
    markMastered: 'Ctrl+M',
    addFavorite: 'Ctrl+F',
  },
};
