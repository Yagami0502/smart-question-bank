/**
 * SM-2 间隔重复算法实现
 * 基于 SuperMemo 2 算法，用于计算最优复习间隔
 * 
 * 核心参数:
 * - interval (I): 距离下次复习的天数
 * - easeFactor (EF): 简易度因子，范围 1.3-2.5+
 * - reps: 连续正确回答次数
 * - lapses: 遗忘次数（用于针对性强化）
 */

import type { Card, Rating, SimpleRating, CardState } from '../types';

// 评分映射: 简化评分 -> SM-2 标准评分
export const ratingMap: Record<SimpleRating, Rating> = {
  'again': 0,  // 完全遗忘
  'hard': 2,   // 困难但记住
  'good': 3,   // 一般
  'easy': 5    // 轻松
};

// 默认学习步骤 (分钟)
export const DEFAULT_LEARNING_STEPS = [1, 10];

// 默认毕业间隔 (天)
export const DEFAULT_GRADUATING_INTERVAL = 1;

// 默认简单间隔 (天)
export const DEFAULT_EASY_INTERVAL = 4;

// 最小简易度因子
export const MIN_EASE_FACTOR = 1.3;

// 默认简易度因子
export const DEFAULT_EASE_FACTOR = 2.5;

// 最大间隔 (天)
export const MAX_INTERVAL = 365 * 2; // 2年

/**
 * SM-2 算法核心: 更新简易度因子
 * EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 */
export function calculateNewEaseFactor(currentEF: number, rating: Rating): number {
  const q = rating;
  const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  const newEF = currentEF + delta;
  return Math.max(MIN_EASE_FACTOR, newEF);
}

/**
 * 计算下一个间隔
 * I(1) = 1
 * I(2) = 6
 * I(n) = I(n-1) * EF
 */
export function calculateNextInterval(
  currentInterval: number,
  reps: number,
  easeFactor: number,
  rating: Rating
): number {
  // 如果评分 < 3，重置间隔（遗忘）
  if (rating < 3) {
    return 1;
  }

  let nextInterval: number;

  if (reps === 0) {
    nextInterval = 1;
  } else if (reps === 1) {
    nextInterval = 6;
  } else {
    nextInterval = Math.round(currentInterval * easeFactor);
  }

  // 如果评分为 easy，额外增加间隔
  if (rating === 5) {
    nextInterval = Math.round(nextInterval * 1.3);
  }

  return Math.min(nextInterval, MAX_INTERVAL);
}

/**
 * 计算下次复习时间
 */
export function calculateDueDate(intervalDays: number): number {
  const now = new Date();
  now.setDate(now.getDate() + intervalDays);
  now.setHours(4, 0, 0, 0); // 设置为凌晨4点，作为新一天的开始
  return now.getTime();
}

/**
 * 根据评分确定卡片新状态
 */
export function determineNewState(currentState: CardState, rating: Rating): CardState {
  if (rating < 3) {
    // 遗忘: 进入重学状态
    return currentState === 'new' ? 'learning' : 'relearning';
  }
  
  if (currentState === 'new' || currentState === 'learning') {
    // 学习中的卡片，评分 >= 3 则毕业到复习状态
    return 'review';
  }
  
  if (currentState === 'relearning') {
    // 重学中的卡片，评分 >= 3 返回复习状态
    return 'review';
  }
  
  // 复习状态保持
  return 'review';
}

/**
 * 处理用户对卡片的评分，返回更新后的卡片数据
 */
export interface SchedulingResult {
  card: Partial<Card>;
  scheduledDays: number;
}

export function scheduleCard(card: Card, rating: Rating): SchedulingResult {
  const wasNew = card.state === 'new';
  const wasForgotten = rating < 3;
  
  // 计算新的简易度因子
  const newEaseFactor = calculateNewEaseFactor(card.easeFactor, rating);
  
  // 计算新的重复次数
  const newReps = wasForgotten ? 0 : card.reps + 1;
  
  // 计算新的遗忘次数 - 任何时候答错都记录
  const newLapses = wasForgotten ? card.lapses + 1 : card.lapses;
  
  // 计算下一个间隔
  const currentInterval = wasNew ? 0 : card.interval;
  const newInterval = calculateNextInterval(currentInterval, newReps, newEaseFactor, rating);
  
  // 计算新状态
  const newState = determineNewState(card.state, rating);
  
  // 计算下次复习时间
  const newDueDate = calculateDueDate(newInterval);
  
  return {
    card: {
      state: newState,
      interval: newInterval,
      easeFactor: newEaseFactor,
      reps: newReps,
      lapses: newLapses,
      dueDate: newDueDate,
      lastReview: Date.now()
    },
    scheduledDays: newInterval
  };
}

/**
 * 预览各评分对应的下次复习时间
 * 用于在界面上显示 "Again: 1d, Hard: 3d, Good: 7d, Easy: 15d"
 */
export function previewSchedule(card: Card): Record<SimpleRating, string> {
  const previews: Record<SimpleRating, string> = {
    again: '',
    hard: '',
    good: '',
    easy: ''
  };

  for (const [simpleRating, numericRating] of Object.entries(ratingMap)) {
    const result = scheduleCard(card, numericRating as Rating);
    previews[simpleRating as SimpleRating] = formatInterval(result.scheduledDays);
  }

  return previews;
}

/**
 * 格式化间隔为人类可读形式
 */
export function formatInterval(days: number): string {
  if (days < 1) {
    return '< 1天';
  } else if (days === 1) {
    return '1天';
  } else if (days < 30) {
    return `${days}天`;
  } else if (days < 365) {
    const months = Math.round(days / 30);
    return `${months}个月`;
  } else {
    const years = (days / 365).toFixed(1);
    return `${years}年`;
  }
}

/**
 * 计算记忆保留率 (基于遗忘曲线)
 * R = e^(-t/S)
 * 其中 t 是时间, S 是稳定性 (可以用 interval * EF 近似)
 */
export function estimateRetention(card: Card): number {
  if (!card.lastReview) return 1;
  
  const daysSinceReview = (Date.now() - card.lastReview) / (1000 * 60 * 60 * 24);
  const stability = card.interval * card.easeFactor;
  
  if (stability <= 0) return 1;
  
  const retention = Math.exp(-daysSinceReview / stability);
  return Math.max(0, Math.min(1, retention));
}

/**
 * 预测未来N天的遗忘曲线
 */
export function predictForgettingCurve(
  cards: Card[],
  daysAhead: number = 30
): Array<{ day: number; retention: number; dueCount: number }> {
  const predictions: Array<{ day: number; retention: number; dueCount: number }> = [];
  const now = Date.now();
  
  for (let day = 0; day <= daysAhead; day++) {
    const futureTime = now + day * 24 * 60 * 60 * 1000;
    
    let totalRetention = 0;
    let dueCount = 0;
    
    for (const card of cards) {
      if (card.state === 'new') continue;
      
      const daysSinceReview = card.lastReview 
        ? (futureTime - card.lastReview) / (1000 * 60 * 60 * 24)
        : 0;
      
      const stability = card.interval * card.easeFactor;
      const retention = stability > 0 ? Math.exp(-daysSinceReview / stability) : 1;
      
      totalRetention += retention;
      
      if (card.dueDate <= futureTime) {
        dueCount++;
      }
    }
    
    const reviewableCards = cards.filter(c => c.state !== 'new').length;
    const averageRetention = reviewableCards > 0 ? totalRetention / reviewableCards : 1;
    
    predictions.push({
      day,
      retention: averageRetention,
      dueCount
    });
  }
  
  return predictions;
}
