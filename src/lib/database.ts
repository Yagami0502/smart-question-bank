/**
 * 数据库层
 * 
 * 切换数据源：
 * - 使用 MySQL: import from './database-mysql'
 * - 使用 IndexedDB: import from './database-indexeddb'
 */

// 使用 MySQL 后端
export {
  db,
  deckOperations,
  questionOperations,
  cardOperations,
  reviewLogOperations,
  dailyRecordOperations,
  wrongQuestionOperations,
} from './database-mysql';

export { db as default } from './database-mysql';
