/**
 * 加权随机采样算法
 * 用于"针对性强化"模式下的题目选择
 * 
 * 权重计算公式:
 * W_i = (α · ErrorRate_i) + (β · DecayFactor_i) + γ
 * 
 * 其中:
 * - ErrorRate: 错误率 (lapses / (reps + lapses))
 * - DecayFactor: 时间衰减因子 log(1 + daysSinceLastReview)
 * - α, β: 调节系数
 * - γ: 基础权重
 */

import type { Card } from '../types';

export interface WeightConfig {
  errorWeight: number;      // α: 错误率权重
  decayWeight: number;      // β: 时间衰减权重
  baseWeight: number;       // γ: 基础权重
  newCardBonus: number;     // 新卡片额外权重
  difficultThreshold: number; // 困难题目阈值 (lapses >= 此值视为困难)
  recentPenalty: number;    // 最近复习过的题目惩罚系数
  recentHours: number;      // 多少小时内算"最近复习"
}

export const DEFAULT_WEIGHT_CONFIG: WeightConfig = {
  errorWeight: 2.0,
  decayWeight: 1.0,
  baseWeight: 0.1,
  newCardBonus: 1.5,  // 增加新题目出现概率
  difficultThreshold: 2,
  recentPenalty: 0.95,  // 最近复习过的题目权重降低95%
  recentHours: 24       // 24小时内复习过的算"最近"
};

/**
 * 计算单个卡片的权重
 */
export function calculateCardWeight(card: Card, config: WeightConfig = DEFAULT_WEIGHT_CONFIG): number {
  const { errorWeight, decayWeight, baseWeight, newCardBonus, recentPenalty, recentHours } = config;
  
  // 错误率计算
  const totalAttempts = card.reps + card.lapses;
  const errorRate = totalAttempts > 0 ? card.lapses / totalAttempts : 0;
  
  // 时间衰减计算
  let decayFactor = 0;
  let recentlyReviewed = false;
  
  if (card.lastReview) {
    const hoursSince = (Date.now() - card.lastReview) / (1000 * 60 * 60);
    const daysSince = hoursSince / 24;
    decayFactor = Math.log(1 + daysSince);
    
    // 检查是否最近复习过
    if (hoursSince < recentHours) {
      recentlyReviewed = true;
    }
  }
  
  // 新卡片奖励
  const newBonus = card.state === 'new' ? newCardBonus : 0;
  
  // 计算总权重
  let weight = (errorWeight * errorRate) + (decayWeight * decayFactor) + baseWeight + newBonus;
  
  // 如果最近复习过，大幅降低权重
  if (recentlyReviewed) {
    weight *= (1 - recentPenalty);
  }
  
  return Math.max(0.001, weight); // 确保权重为正但很小
}

/**
 * 为一组卡片计算权重
 */
export function calculateWeights(cards: Card[], config?: WeightConfig): Map<string, number> {
  const weights = new Map<string, number>();
  
  for (const card of cards) {
    weights.set(card.id, calculateCardWeight(card, config));
  }
  
  return weights;
}

/**
 * 加权随机采样 - 使用累积分布函数 (CDF) 方法
 * 
 * @param cards 待采样的卡片数组
 * @param count 采样数量
 * @param config 权重配置
 * @returns 采样结果 (不重复)
 */
export function weightedSample(
  cards: Card[],
  count: number,
  config?: WeightConfig
): Card[] {
  if (cards.length === 0) return [];
  if (count >= cards.length) return shuffleArray([...cards]);
  
  const weights = calculateWeights(cards, config);
  const selected: Card[] = [];
  const remaining = [...cards];
  
  for (let i = 0; i < count && remaining.length > 0; i++) {
    // 计算累积权重
    let totalWeight = 0;
    const cdf: number[] = [];
    
    for (const card of remaining) {
      totalWeight += weights.get(card.id) || 0.01;
      cdf.push(totalWeight);
    }
    
    // 随机选择
    const random = Math.random() * totalWeight;
    let selectedIndex = 0;
    
    for (let j = 0; j < cdf.length; j++) {
      if (random <= cdf[j]) {
        selectedIndex = j;
        break;
      }
    }
    
    // 添加到结果并从候选中移除
    selected.push(remaining[selectedIndex]);
    remaining.splice(selectedIndex, 1);
  }
  
  return selected;
}

/**
 * Fisher-Yates 洗牌算法
 * 保证均匀分布的随机打乱
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

/**
 * 分组洗牌 - 先按类型/标签分组，再组内打乱
 * 确保不同类型的题目均匀分布
 */
export function groupedShuffle<T>(
  items: T[],
  groupBy: (item: T) => string
): T[] {
  // 按分组收集
  const groups = new Map<string, T[]>();
  
  for (const item of items) {
    const key = groupBy(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }
  
  // 对每组内部打乱
  for (const group of groups.values()) {
    shuffleArray(group);
  }
  
  // 交替合并各组
  const result: T[] = [];
  const groupArrays = Array.from(groups.values());
  const indices = new Array(groupArrays.length).fill(0);
  
  let totalItems = items.length;
  while (totalItems > 0) {
    for (let i = 0; i < groupArrays.length; i++) {
      if (indices[i] < groupArrays[i].length) {
        result.push(groupArrays[i][indices[i]]);
        indices[i]++;
        totalItems--;
      }
    }
  }
  
  return result;
}

/**
 * 筛选困难题目 (高频错题)
 */
export function filterDifficultCards(
  cards: Card[],
  threshold: number = 2
): Card[] {
  return cards.filter(card => card.lapses >= threshold);
}

/**
 * 按错误率排序
 */
export function sortByErrorRate(cards: Card[], descending: boolean = true): Card[] {
  return [...cards].sort((a, b) => {
    const rateA = (a.reps + a.lapses) > 0 ? a.lapses / (a.reps + a.lapses) : 0;
    const rateB = (b.reps + b.lapses) > 0 ? b.lapses / (b.reps + b.lapses) : 0;
    return descending ? rateB - rateA : rateA - rateB;
  });
}

/**
 * 按到期时间排序 (逾期越久越靠前)
 */
export function sortByOverdue(cards: Card[]): Card[] {
  const now = Date.now();
  return [...cards].sort((a, b) => {
    const overdueA = now - a.dueDate;
    const overdueB = now - b.dueDate;
    return overdueB - overdueA;
  });
}
