// 题目类型枚举
export type QuestionType = 'MCQ' | 'MULTI' | 'FILL' | 'TRUE_FALSE' | 'SHORT_ANSWER';

// 卡片状态枚举
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

// 练习模式枚举
export type PracticeMode = 'smart' | 'new' | 'review' | 'cram' | 'exam';

// 题库接口
export interface Deck {
  id: string;
  name: string;
  description?: string;
  isPublic?: boolean;
  settings: DeckSettings;
  createdAt: number;
  updatedAt: number;
}

export interface DeckSettings {
  newCardsPerDay: number;
  reviewsPerDay: number;
  maxInterval: number;
  learningSteps: number[];
  graduatingInterval: number;
  easyInterval: number;
}

// 题目内容接口
export interface QuestionContent {
  text: string;
  images?: string[];
  latex?: string;
  html?: string;
}

// 选项接口
export interface Option {
  id: string;
  content: QuestionContent;
  isCorrect: boolean;
}

// 题目接口
export interface Question {
  id: string;
  deckId: string;
  type: QuestionType;
  content: QuestionContent;
  options: Option[];
  answer: string | string[];
  explanation?: string;
  tags: string[];
  difficulty: number;
  sourceFile?: string;
  createdAt: number;
  updatedAt: number;
}

// 卡片接口 (SRS调度实体)
export interface Card {
  id: string;
  questionId: string;
  deckId: string;
  state: CardState;
  dueDate: number;
  interval: number;
  easeFactor: number;
  reps: number;
  lapses: number;
  lastReview?: number;
  createdAt: number;
  // 派生统计字段（后端 /api/cards 返回，供错题分析与搜索视图使用）
  errorCount?: number;
  correctCount?: number;
  totalReviews?: number;
  due?: number;
}

// 复习日志接口
export interface ReviewLog {
  id: string;
  cardId: string;
  questionId: string;
  rating: number;
  duration: number;
  reviewTime: number;
  scheduledDays: number;
  state: CardState;
}

// 用户评分 (SM-2标准)
export type Rating = 0 | 1 | 2 | 3 | 4 | 5;

// 简化评分 (界面显示)
export type SimpleRating = 'again' | 'hard' | 'good' | 'easy';

// 考试配置
export interface ExamConfig {
  questionCount: number;
  timeLimit: number;
  shuffleOptions: boolean;
  shuffleQuestions: boolean;
  showProgress: boolean;
  allowSkip: boolean;
  convertToMulti: boolean;
  multiRatio: number;
}

// 练习会话状态
export interface PracticeSession {
  deckId: string;
  mode: PracticeMode;
  cards: Card[];
  currentIndex: number;
  answers: Map<string, UserAnswer>;
  startTime: number;
  cardStartTime: number;  // 当前卡片开始时间，用于计算单题用时
  endTime?: number;
  // 考试模式专用：存储转换后的多选题数据
  convertedQuestions?: Map<string, ConvertedQuestion>;
  // 考试配置
  examConfig?: ExamConfig;
}

// 转换后的多选题数据
export interface ConvertedQuestion {
  content: string;           // 反转后的题干
  options: string[];         // 选项内容
  correctAnswer: string[];   // 新的正确答案
  explanation: string;       // 新的解析
  originalAnswer: string;    // 原单选题答案
  isConverted: true;         // 标记为转换题
}

// 用户答案
export interface UserAnswer {
  cardId: string;
  questionId: string;
  selectedOptions: string[];
  isCorrect: boolean;
  rating?: Rating;
  duration: number;
  timestamp: number;
}

// 会话结果统计
export interface SessionStats {
  totalCards: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  totalDuration: number;
  averageDuration: number;
  fastestCard?: string;
  slowestCard?: string;
  byTag: Record<string, { correct: number; total: number }>;
}

// 导入配置
export interface ImportConfig {
  delimiter?: string;
  hasHeader: boolean;
  columnMapping: ColumnMapping;
  questionSeparator?: string;
  optionPattern?: string;
  answerPattern?: string;
}

export interface ColumnMapping {
  question?: number | string;
  optionA?: number | string;
  optionB?: number | string;
  optionC?: number | string;
  optionD?: number | string;
  optionE?: number | string;
  answer?: number | string;
  explanation?: number | string;
  tags?: number | string;
  difficulty?: number | string;
}

// 导入结果
export interface ImportResult {
  success: boolean;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errors: ImportError[];
  questions: Question[];
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

// 学习统计数据
export interface LearningStats {
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  dueToday: number;
  studiedToday: number;
  streakDays: number;
  totalReviews: number;
  retentionRate: number;
}

// 标签掌握度
export interface TagMastery {
  tag: string;
  totalCards: number;
  masteredCards: number;
  masteryRate: number;
  averageEaseFactor: number;
}

// 每日学习记录 (用于热力图)
export interface DailyRecord {
  date: string;
  count: number;
  duration: number;
}

// 遗忘预测
export interface ForgettingPrediction {
  date: string;
  estimatedForgotten: number;
  totalDue: number;
}
