/**
 * 后端 API 客户端
 * 用于连接 MySQL 数据库后端服务
 */

const API_BASE = '/api';

// 通用请求函数
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '请求失败');
  }
  
  return response.json();
}

// 题库 API
export const deckApi = {
  // 获取所有题库
  getAll: () => request<any[]>('/decks'),
  
  // 获取单个题库
  getById: (id: string) => request<any>(`/decks/${id}`),
  
  // 创建题库
  create: (name: string, description?: string) => 
    request<any>('/decks', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    }),
  
  // 更新题库
  update: (id: string, name: string, description?: string) =>
    request<any>(`/decks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description }),
    }),
  
  // 删除题库
  delete: (id: string) =>
    request<any>(`/decks/${id}`, { method: 'DELETE' }),
  
  // 获取题库统计
  getStats: (id: string) => request<any>(`/decks/${id}/stats`),
};

// 题目 API
export const questionApi = {
  // 获取题库的所有题目
  getByDeck: (deckId: string) => request<any[]>(`/questions/deck/${deckId}`),
  
  // 获取单个题目
  getById: (id: string) => request<any>(`/questions/${id}`),
  
  // 批量创建题目
  createBatch: (deckId: string, questions: any[]) =>
    request<any>('/questions/batch', {
      method: 'POST',
      body: JSON.stringify({ deckId, questions }),
    }),
  
  // 创建单个题目
  create: (data: any) =>
    request<any>('/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  // 更新题目
  update: (id: string, data: any) =>
    request<any>(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  // 删除题目
  delete: (id: string) =>
    request<any>(`/questions/${id}`, { method: 'DELETE' }),
  
  // 按标签搜索
  searchByTags: (deckId: string, tags: string[]) =>
    request<any[]>(`/questions/search/tags?deckId=${deckId}&tags=${tags.join(',')}`),
};

// 卡片 API
export const cardApi = {
  // 获取题库的所有卡片
  getByDeck: (deckId: string) => request<any[]>(`/cards/deck/${deckId}`),
  
  // 获取到期卡片
  getDue: (deckId: string, limit = 50) =>
    request<any[]>(`/cards/deck/${deckId}/due?limit=${limit}`),
  
  // 获取新卡片
  getNew: (deckId: string, limit = 20) =>
    request<any[]>(`/cards/deck/${deckId}/new?limit=${limit}`),
  
  // 更新卡片
  update: (id: string, data: any) =>
    request<any>(`/cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  // 获取卡片详情
  getDetail: (id: string) => request<any>(`/cards/${id}/detail`),
  
  // 记录复习日志
  logReview: (data: any) =>
    request<any>('/cards/review-log', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// 设置 API
export const settingsApi = {
  // 获取设置
  get: () => request<any>('/settings'),
  
  // 更新设置
  update: (data: any) =>
    request<any>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// 统计 API
export const statsApi = {
  // 获取整体统计
  getOverview: () => request<any>('/stats/overview'),
  
  // 获取每日统计
  getDaily: (days = 30) => request<any[]>(`/stats/daily?days=${days}`),
  
  // 获取题库统计
  getDeck: (deckId: string) => request<any>(`/stats/deck/${deckId}`),
  
  // 获取连续天数
  getStreak: () => request<any>('/stats/streak'),
};

// 健康检查
export const healthCheck = () => request<any>('/health');

// 检查后端是否可用
export async function isBackendAvailable(): Promise<boolean> {
  try {
    await healthCheck();
    return true;
  } catch {
    return false;
  }
}
