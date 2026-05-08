/**
 * 全局应用状态管理
 * 使用 Zustand 实现轻量级状态管理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Deck, Question, Card, PracticeMode, PracticeSession, UserAnswer, SessionStats } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { db, deckOperations, questionOperations, cardOperations, reviewLogOperations, dailyRecordOperations, wrongQuestionOperations } from '../lib/database';
import { scheduleCard, ratingMap } from '../lib/sm2';
import { weightedSample, shuffleArray, filterDifficultCards } from '../lib/weighted-sampling';
import { refreshQueries } from '../hooks/useAsyncQuery';
import { isLoggedIn } from '../lib/auth';
import type { SimpleRating } from '../types';

function getDefaultTagFromDeckName(deckName: string): string {
  let name = (deckName || '').trim();
  if (!name) return '';

  // 常见后缀/前缀清理
  name = name.replace(/(题库|题目库|练习|训练|刷题)\s*$/g, '');
  name = name.replace(/^\s*(题库|题目库)\s*/g, '');
  name = name.replace(/\s+/g, ' ').trim();

  return name;
}

// 应用状态接口
interface AppState {
  // 当前选中的题库
  currentDeckId: string | null;
  
  // 练习会话状态
  session: PracticeSession | null;
  
  // UI 状态
  isLoading: boolean;
  error: string | null;
  
  // 设置
  settings: AppSettings;
}

interface AppSettings {
  dailyNewCards: number;
  dailyReviews: number;
  showTimer: boolean;
  autoPlayAudio: boolean;
  errorWeightMultiplier: number;
  decayWeightMultiplier: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  dailyNewCards: 20,
  dailyReviews: 100,
  showTimer: true,
  autoPlayAudio: false,
  errorWeightMultiplier: 2.0,
  decayWeightMultiplier: 1.0
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isWeightMultiplier(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 10;
}

// 动作接口
interface AppActions {
  // 题库操作
  setCurrentDeck: (deckId: string | null) => void;
  createDeck: (name: string, description?: string) => Promise<Deck>;
  deleteDeck: (deckId: string) => Promise<void>;
  
  // 题目导入
  importQuestions: (deckId: string, questions: Question[]) => Promise<void>;
  
  // 练习会话
  startPractice: (deckId: string, mode: PracticeMode, options?: PracticeOptions) => Promise<void>;
  submitAnswer: (selectedOptions: string[]) => void;
  rateCard: (rating: SimpleRating) => Promise<void>;
  nextCard: () => void;
  endSession: () => SessionStats | null;
  
  // 设置
  updateSettings: (settings: Partial<AppSettings>) => void;
  loadUserSettings: () => Promise<void>;
  saveUserSettings: () => Promise<void>;
  
  // 工具
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

interface PracticeOptions {
  limit?: number;
  tags?: string[];
  onlyDifficult?: boolean;
  onlyNew?: boolean;
  questionIds?: string[];  // 指定题目ID列表（用于收藏练习、错题练习等）
  examConfig?: {           // 考试配置
    questionCount: number;
    timeLimit: number;
    shuffleOptions: boolean;
    shuffleQuestions: boolean;
    showProgress: boolean;
    allowSkip: boolean;
    convertToMulti: boolean;
    multiRatio: number;
  };
}

type AppStore = AppState & AppActions;

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      currentDeckId: null,
      session: null,
      isLoading: false,
      error: null,
      settings: DEFAULT_SETTINGS,

      // 设置当前题库
      setCurrentDeck: (deckId) => set({ currentDeckId: deckId }),

      // 创建题库
      createDeck: async (name, description) => {
        const deck: Deck = {
          id: uuidv4(),
          name,
          description,
          settings: {
            newCardsPerDay: 20,
            reviewsPerDay: 100,
            maxInterval: 365,
            learningSteps: [1, 10],
            graduatingInterval: 1,
            easyInterval: 4
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        await deckOperations.create(deck);
        return deck;
      },

      // 删除题库
      deleteDeck: async (deckId) => {
        await deckOperations.delete(deckId);
        const { currentDeckId } = get();
        if (currentDeckId === deckId) {
          set({ currentDeckId: null });
        }
      },

      // 导入题目
      importQuestions: async (deckId, questions) => {
        set({ isLoading: true, error: null });
        
        try {
          const deck = await deckOperations.getById(deckId);
          const defaultTag = deck ? getDefaultTagFromDeckName(deck.name) : '';

          // 检查并为无标签题目生成标签
          const questionsWithTags = await Promise.all(
            questions.map(async (q) => {
              const existingTags = Array.isArray(q.tags) ? q.tags : [];
              const baseTags = defaultTag ? [defaultTag, ...existingTags] : [...existingTags];

              try {
                const { extractTags } = await import('../lib/ai-service');
                const generatedTags = await extractTags([{
                  content: typeof q.content === 'string' ? q.content : q.content.text,
                  type: q.type,
                  options: q.options.map(opt => typeof opt.content === 'string' ? opt.content : opt.content.text),
                  correctAnswer: q.answer,
                  explanation: q.explanation,
                  tags: [],
                  difficulty: q.difficulty
                }]);

                const mergedTags = Array.from(new Set([...baseTags, ...generatedTags])).filter(Boolean);

                if (generatedTags.length > 0 || defaultTag) {
                  const contentText = typeof q.content === 'string' ? q.content : q.content.text;
                  const contentPreview = contentText.substring(0, 30);
                  console.log(`✨ 为题目 "${contentPreview}..." 生成标签: ${mergedTags.join(', ')}`);
                }

                return { ...q, tags: mergedTags };
              } catch (error) {
                console.warn('⚠️ AI标签生成失败，使用默认/原始标签:', error);
                return { ...q, tags: baseTags };
              }
            })
          );
          
          // 批量添加题目
          await questionOperations.createBatch(questionsWithTags);
          
          // 为每个题目创建对应的卡片
          const cards: Card[] = questionsWithTags.map(q => ({
            id: uuidv4(),
            questionId: q.id,
            deckId: q.deckId,
            state: 'new' as const,
            dueDate: Date.now(),
            interval: 0,
            easeFactor: 2.5,
            reps: 0,
            lapses: 0,
            createdAt: Date.now()
          }));
          
          await cardOperations.createBatch(cards);
          
          set({ isLoading: false });
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : '导入失败' 
          });
          throw error;
        }
      },

      // 开始练习
      startPractice: async (deckId, mode, options = {}) => {
        set({ isLoading: true, error: null });
        
        try {
          let cards: Card[] = [];
          const { limit = 50, tags, onlyDifficult, onlyNew, questionIds } = options;
          const { settings } = get();
          
          // 如果指定了题目ID列表，直接按ID获取卡片（用于收藏练习、错题练习）
          if (questionIds && questionIds.length > 0) {
            const allCards = await db.cards.where('deckId').equals(deckId).toArray();
            const questionIdSet = new Set(questionIds);
            cards = allCards.filter(c => questionIdSet.has(c.questionId));
            
            // 如果某些题目没有对应的卡片，尝试从其他题库获取
            if (cards.length < questionIds.length) {
              const allDbCards = await db.cards.toArray();
              const foundQuestionIds = new Set(cards.map(c => c.questionId));
              const missingCards = allDbCards.filter(c => 
                questionIdSet.has(c.questionId) && !foundQuestionIds.has(c.questionId)
              );
              cards = [...cards, ...missingCards];
            }
            
            // 打乱顺序
            cards = shuffleArray(cards);
          } else if (mode === 'smart') {
            // 智能复习模式: 获取到期卡片 + 新卡片
            const dueCards = await cardOperations.getDueCards(deckId, limit);
            
            // 过滤掉最近1小时内刚复习过的卡片（避免刚答完又出现）
            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            const filteredDueCards = dueCards.filter(c => !c.lastReview || c.lastReview < oneHourAgo);
            
            // 如果到期卡片不足，补充新卡片
            if (filteredDueCards.length < limit) {
              const newCards = await cardOperations.getNewCards(deckId, limit - filteredDueCards.length);
              // 使用 questionId 去重，避免同一题目出现多次
              const usedQuestionIds = new Set(filteredDueCards.map(c => c.questionId));
              const additionalNewCards = newCards.filter(c => !usedQuestionIds.has(c.questionId));
              cards = [...filteredDueCards, ...additionalNewCards];
            } else {
              cards = filteredDueCards;
            }
            
            // 如果仍然没有卡片，获取所有卡片（包括未到期的），但排除最近复习过的
            if (cards.length === 0) {
              const allCards = await db.cards.where('deckId').equals(deckId).toArray();
              // 优先选择没有复习过或复习时间较早的卡片
              const sortedCards = allCards.sort((a, b) => {
                if (!a.lastReview) return -1;
                if (!b.lastReview) return 1;
                return a.lastReview - b.lastReview;
              });
              cards = sortedCards.slice(0, limit);
            }
            
            // 最终按 questionId 去重
            const seenQuestionIds = new Set<string>();
            cards = cards.filter(c => {
              if (seenQuestionIds.has(c.questionId)) return false;
              seenQuestionIds.add(c.questionId);
              return true;
            });
          } else if (mode === 'new') {
            // 学习新题模式: 获取所有未学习过的新卡片（不限制数量）
            const newCards = await cardOperations.getNewCards(deckId, 9999); // 获取所有新卡片
            
            // 按 questionId 去重
            const seenQuestionIds = new Set<string>();
            cards = newCards.filter(c => {
              if (seenQuestionIds.has(c.questionId)) return false;
              seenQuestionIds.add(c.questionId);
              return true;
            });
            
            // 如果没有新卡片，提示用户
            if (cards.length === 0) {
              set({ isLoading: false, error: '没有新题目可学习，所有题目都已学习过' });
              return;
            }
            
            // 打乱顺序
            cards = shuffleArray(cards);
          } else if (mode === 'review') {
            // 一键刷题模式: 复习题库中所有题目
            const allCards = await db.cards.where('deckId').equals(deckId).toArray();
            
            // 按 questionId 去重
            const seenQuestionIds = new Set<string>();
            let reviewCards = allCards.filter(c => {
              if (seenQuestionIds.has(c.questionId)) return false;
              seenQuestionIds.add(c.questionId);
              return true;
            });
            
            if (reviewCards.length === 0) {
              set({ isLoading: false, error: '题库中没有题目' });
              return;
            }
            
            // 打乱顺序
            cards = shuffleArray(reviewCards);
          } else if (mode === 'cram') {
            // 强化突击模式
            let allCards = await db.cards.where('deckId').equals(deckId).toArray();
            
            // 过滤掉最近1小时内刚复习过的卡片（避免刚答完又出现）
            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            allCards = allCards.filter(c => !c.lastReview || c.lastReview < oneHourAgo);
            
            if (onlyNew) {
              allCards = allCards.filter(c => c.state === 'new');
            }
            
            if (onlyDifficult) {
              allCards = filterDifficultCards(allCards);
            }
            
            if (tags && tags.length > 0) {
              const questions = await questionOperations.getByTags(deckId, tags);
              const questionIds = new Set(questions.map(q => q.id));
              allCards = allCards.filter(c => questionIds.has(c.questionId));
            }
            
            // 先按 questionId 去重，避免同一题目出现多次
            const seenQuestionIds = new Set<string>();
            allCards = allCards.filter(c => {
              if (seenQuestionIds.has(c.questionId)) return false;
              seenQuestionIds.add(c.questionId);
              return true;
            });
            
            // 如果过滤后没有卡片了，放宽限制（允许最近复习过的）
            if (allCards.length === 0) {
              allCards = await db.cards.where('deckId').equals(deckId).toArray();
              const seenIds = new Set<string>();
              allCards = allCards.filter(c => {
                if (seenIds.has(c.questionId)) return false;
                seenIds.add(c.questionId);
                return true;
              });
            }
            
            // 使用加权随机采样，降低最近复习过的题目出现概率
            cards = weightedSample(allCards, Math.min(limit, allCards.length), {
              errorWeight: settings.errorWeightMultiplier,
              decayWeight: settings.decayWeightMultiplier,
              baseWeight: 0.1,
              newCardBonus: 1.5,  // 增加新题目出现概率
              difficultThreshold: 2,
              recentPenalty: 0.95,  // 最近24小时内复习过的题目权重降低95%
              recentHours: 24
            });
          } else if (mode === 'exam') {
            // 模拟考试模式 - 使用考试配置
            const examConfig = options.examConfig;
            const questionCount = examConfig?.questionCount || limit || 100;
            const convertToMulti = examConfig?.convertToMulti ?? true;
            const multiRatio = examConfig?.multiRatio ?? 15;
            const shouldShuffleQuestions = examConfig?.shuffleQuestions ?? true;
            
            // 获取所有单选题卡片
            const allCards = await db.cards.where('deckId').equals(deckId).toArray();
            const allQuestions = await questionOperations.getByDeckId(deckId);
            
            // 筛选单选题
            const singleChoiceQuestions = allQuestions.filter(q => q.type === 'MCQ');
            const singleChoiceQuestionIds = new Set(singleChoiceQuestions.map(q => q.id));
            let singleChoiceCards = allCards.filter(c => singleChoiceQuestionIds.has(c.questionId));
            
            // 按 questionId 去重，避免同一题目出现多次
            const seenQuestionIds = new Set<string>();
            singleChoiceCards = singleChoiceCards.filter(c => {
              if (seenQuestionIds.has(c.questionId)) return false;
              seenQuestionIds.add(c.questionId);
              return true;
            });
            
            if (singleChoiceCards.length < 10) {
              set({ isLoading: false, error: '单选题数量不足，至少需要10道单选题' });
              return;
            }
            
            // 打乱顺序（如果配置要求）
            let shuffledCards = shouldShuffleQuestions 
              ? shuffleArray([...singleChoiceCards])
              : [...singleChoiceCards];
            
            // 计算实际抽取数量
            const availableCount = shuffledCards.length;
            const actualTotal = Math.min(questionCount, availableCount);
            
            // 计算多选题数量
            let actualMulti = 0;
            let actualSingle = actualTotal;
            
            if (convertToMulti && multiRatio > 0) {
              actualMulti = Math.floor(actualTotal * multiRatio / 100);
              actualSingle = actualTotal - actualMulti;
            }
            
            // 抽取单选题
            const singleCards = shuffledCards.slice(0, actualSingle);
            
            // 抽取要转换为多选的题目
            const toConvertCards = convertToMulti 
              ? shuffledCards.slice(actualSingle, actualSingle + actualMulti)
              : [];
            
            // 合并所有卡片
            cards = [...singleCards, ...toConvertCards];
            
            // 将转换信息存储到 session 中
            const examNow = Date.now();
            const session: PracticeSession = {
              deckId,
              mode,
              cards,
              currentIndex: 0,
              answers: new Map(),
              startTime: examNow,
              cardStartTime: examNow,
              convertedQuestions: new Map(),
              examConfig: examConfig  // 存储考试配置
            };
            
            // 标记需要转换的题目（先存储ID，实际转换在 PracticePage 中异步进行）
            for (const card of toConvertCards) {
              const question = singleChoiceQuestions.find(q => q.id === card.questionId);
              if (question) {
                // 先存储一个占位符，表示这道题需要转换
                session.convertedQuestions!.set(card.questionId, {
                  content: '',
                  options: [],
                  correctAnswer: [],
                  explanation: '',
                  originalAnswer: '',
                  isConverted: true,
                  needsConversion: true, // 标记需要转换
                  originalQuestion: question, // 存储原题目用于转换
                } as any);
              }
            }
            
            set({ session, isLoading: false });
            return; // 提前返回，不走下面的通用逻辑
          }
          
          if (cards.length === 0) {
            set({ isLoading: false, error: '没有可练习的题目' });
            return;
          }
          
          const now = Date.now();
          const session: PracticeSession = {
            deckId,
            mode,
            cards,
            currentIndex: 0,
            answers: new Map(),
            startTime: now,
            cardStartTime: now  // 初始化当前卡片开始时间
          };
          
          set({ session, isLoading: false });
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : '启动练习失败' 
          });
        }
      },

      // 提交答案
      submitAnswer: (selectedOptions) => {
        const { session } = get();
        if (!session) return;
        
        const currentCard = session.cards[session.currentIndex];
        const now = Date.now();
        
        // 暂时标记为未评分状态
        const answer: UserAnswer = {
          cardId: currentCard.id,
          questionId: currentCard.questionId,
          selectedOptions,
          isCorrect: false, // 将在获取题目后更新
          duration: now - session.cardStartTime,  // 使用当前卡片开始时间计算用时
          timestamp: now
        };
        
        const newAnswers = new Map(session.answers);
        newAnswers.set(currentCard.id, answer);
        
        set({
          session: { ...session, answers: newAnswers }
        });
      },

      // 评分卡片
      rateCard: async (simpleRating) => {
        const { session } = get();
        if (!session) return;
        
        const currentCard = session.cards[session.currentIndex];
        const rating = ratingMap[simpleRating];
        const wasForgotten = rating < 3; // 答错了
        
        // 计算新的调度数据
        const result = scheduleCard(currentCard, rating);
        
        // 更新数据库中的卡片
        await cardOperations.update(currentCard.id, result.card);
        
        // 如果答错了，记录到错题本
        if (wasForgotten) {
          try {
            const answer = session.answers.get(currentCard.id);
            const question = await questionOperations.getById(currentCard.questionId);
            const correctAnswer = question?.answer || '';
            
            await wrongQuestionOperations.add(
              currentCard.questionId,
              session.deckId,
              answer?.selectedOptions || [],
              correctAnswer
            );
          } catch (error) {
            console.error('记录错题失败:', error);
            // 不阻塞主流程
          }
        }
        
        // 记录复习日志
        await reviewLogOperations.create({
          id: uuidv4(),
          cardId: currentCard.id,
          questionId: currentCard.questionId,
          deckId: session.deckId,
          rating,
          duration: session.answers.get(currentCard.id)?.duration || 0,
          reviewTime: Date.now(),
          scheduledDays: result.scheduledDays,
          state: currentCard.state
        });
        
        // 更新答案的评分
        const newAnswers = new Map(session.answers);
        const answer = newAnswers.get(currentCard.id);
        if (answer) {
          newAnswers.set(currentCard.id, {
            ...answer,
            rating,
            isCorrect: rating >= 3
          });
        }
        
        // 更新会话中的卡片数据
        const updatedCards = [...session.cards];
        updatedCards[session.currentIndex] = {
          ...currentCard,
          ...result.card
        } as Card;
        
        set({
          session: { ...session, cards: updatedCards, answers: newAnswers }
        });
      },

      // 下一张卡片
      nextCard: () => {
        const { session } = get();
        if (!session) return;
        
        const nextIndex = session.currentIndex + 1;
        const now = Date.now();
        
        if (nextIndex >= session.cards.length) {
          // 练习结束
          set({
            session: { ...session, currentIndex: nextIndex, endTime: now }
          });
        } else {
          // 重置当前卡片开始时间
          set({
            session: { ...session, currentIndex: nextIndex, cardStartTime: now }
          });
        }
      },

      // 结束会话并返回统计
      endSession: () => {
        const { session } = get();
        if (!session) return null;
        
        const answers = Array.from(session.answers.values());
        const totalCards = answers.length;
        const correctCount = answers.filter(a => a.isCorrect).length;
        const totalDuration = answers.reduce((sum, a) => sum + a.duration, 0);
        
        // 记录每日学习
        dailyRecordOperations.recordStudy(totalCards, totalDuration);
        
        const stats: SessionStats = {
          totalCards,
          correctCount,
          incorrectCount: totalCards - correctCount,
          accuracy: totalCards > 0 ? correctCount / totalCards : 0,
          totalDuration,
          averageDuration: totalCards > 0 ? totalDuration / totalCards : 0,
          byTag: {}
        };
        
        set({ session: null });
        
        // 刷新所有查询，确保掌握度等数据实时更新
        refreshQueries();
        
        return stats;
      },

      // 更新设置
      updateSettings: (newSettings) => {
        const { settings, saveUserSettings } = get();
        set({ settings: { ...settings, ...newSettings } });
        // 如果已登录，自动同步到服务器
        if (isLoggedIn()) {
          saveUserSettings();
        }
      },

      // 从服务器加载用户设置
      loadUserSettings: async () => {
        if (!isLoggedIn()) return;

        try {
          const { authFetch } = await import('../lib/auth');
          const response = await authFetch('/api/user-settings');

          if (!response.ok) {
            return;
          }

          const rawSettings = await response.json();
          const serverSettings = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)
            ? rawSettings
            : {};
          set(state => ({
            settings: {
              ...state.settings,
              dailyNewCards: isPositiveInteger(serverSettings.dailyNewCards)
                ? serverSettings.dailyNewCards
                : state.settings.dailyNewCards,
              dailyReviews: isPositiveInteger(serverSettings.dailyReviews)
                ? serverSettings.dailyReviews
                : state.settings.dailyReviews,
              showTimer: isBoolean(serverSettings.showTimer)
                ? serverSettings.showTimer
                : state.settings.showTimer,
              autoPlayAudio: isBoolean(serverSettings.autoPlayAudio)
                ? serverSettings.autoPlayAudio
                : state.settings.autoPlayAudio,
              errorWeightMultiplier: isWeightMultiplier(serverSettings.errorWeightMultiplier)
                ? serverSettings.errorWeightMultiplier
                : state.settings.errorWeightMultiplier,
              decayWeightMultiplier: isWeightMultiplier(serverSettings.decayWeightMultiplier)
                ? serverSettings.decayWeightMultiplier
                : state.settings.decayWeightMultiplier,
            }
          }));
        } catch (error) {
          console.error('加载用户设置失败:', error);
        }
      },

      // 保存用户设置到服务器
      saveUserSettings: async () => {
        if (!isLoggedIn()) return;

        try {
          const { authFetch } = await import('../lib/auth');
          const { settings } = get();

          const response = await authFetch('/api/user-settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              dailyNewCards: settings.dailyNewCards,
              dailyReviews: settings.dailyReviews,
              showTimer: settings.showTimer,
              autoPlayAudio: settings.autoPlayAudio,
              errorWeightMultiplier: settings.errorWeightMultiplier,
              decayWeightMultiplier: settings.decayWeightMultiplier
            })
          });

          if (!response.ok) {
            const result = await response.json().catch(() => ({ error: '保存用户设置失败' }));
            throw new Error(result.error || '保存用户设置失败');
          }
        } catch (error) {
          console.error('保存用户设置失败:', error);
        }
      },

      // 工具函数
      setError: (error) => set({ error }),
      setLoading: (isLoading) => set({ isLoading })
    }),
    {
      name: 'smart-question-bank-storage',
      partialize: (state) => ({
        settings: state.settings,
        currentDeckId: state.currentDeckId
      })
    }
  )
);

export default useAppStore;
