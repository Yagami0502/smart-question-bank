/**
 * 词库数据加载器 - MySQL API 版本
 * 词库数据由后端管理，前端只负责获取
 */
import { wordOperations, vocabularyBookOperations } from './vocabulary-db';

/**
 * 加载词库数据
 * 现在词库数据存储在 MySQL，由后端提供
 * @param bookId 词库ID
 * @returns 是否加载成功
 */
export async function loadVocabularyData(bookId: string): Promise<boolean> {
  try {
    // 获取词库信息
    const book = await vocabularyBookOperations.getById(bookId);
    if (!book) {
      console.error('词库不存在:', bookId);
      return false;
    }

    // 检查是否有数据
    const words = await wordOperations.getByBookId(bookId);
    return words.length > 0;
  } catch (error) {
    console.error('加载词库数据失败:', error);
    return false;
  }
}

/**
 * 初始化示例词库数据
 * 现在词库数据由后端管理，此函数仅用于兼容性
 * 实际数据通过后端导入脚本导入
 */
export async function initSampleVocabulary(_bookId: string, _bookName: string): Promise<void> {
  // 词库数据现在由后端管理，无需前端初始化
  console.log('词库数据由后端管理，跳过前端初始化');
}

/**
 * 检查词库是否有数据
 */
export async function hasVocabularyData(bookId: string): Promise<boolean> {
  try {
    const words = await wordOperations.getByBookId(bookId);
    return words.length > 0;
  } catch {
    return false;
  }
}
