/**
 * 异步查询 Hook - 替代 dexie-react-hooks 的 useLiveQuery
 * 用于 MySQL 后端 API 调用
 */

import { useState, useEffect, useCallback } from 'react';

// 全局刷新计数器 - 用于触发所有查询刷新
let globalRefreshCounter = 0;
const listeners = new Set<() => void>();

/**
 * 触发所有查询刷新
 */
export function refreshQueries() {
  globalRefreshCounter++;
  listeners.forEach(listener => listener());
}

/**
 * 异步查询钩子，模拟 useLiveQuery 的行为
 * @param queryFn 异步查询函数
 * @param deps 依赖数组
 * @param defaultValue 默认值
 */
export function useAsyncQuery<T>(
  queryFn: () => Promise<T> | T | undefined,
  deps: any[] = [],
  defaultValue?: T
): T | undefined {
  const [data, setData] = useState<T | undefined>(defaultValue);
  const [, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const executeQuery = useCallback(async () => {
    try {
      const result = await queryFn();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Query error:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      if (defaultValue !== undefined) {
        setData(defaultValue);
      }
    }
  }, [...deps, refreshKey]);

  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  // 订阅全局刷新
  useEffect(() => {
    const listener = () => setRefreshKey(k => k + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  return data;
}

/**
 * 兼容 useLiveQuery 的别名
 */
export const useLiveQuery = useAsyncQuery;

export default useAsyncQuery;
