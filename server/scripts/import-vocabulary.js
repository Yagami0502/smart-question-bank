/**
 * 词库数据导入脚本
 * 从 CET4/CET6 JSON 文件导入到 MySQL
 * 
 * 使用方法: node scripts/import-vocabulary.js
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/connection');

// 词库配置
const VOCABULARY_BOOKS = [
  {
    jsonFile: '../../CET4_T.json',
    name: '大学英语四级词汇',
    description: 'CET-4 核心词汇，包含约 4500 个常用单词',
    category: '考试词汇',
  },
  {
    jsonFile: '../../CET6_T.json',
    name: '大学英语六级词汇',
    description: 'CET-6 核心词汇，包含约 5500 个常用单词',
    category: '考试词汇',
  },
];

/**
 * 转换单词数据格式
 */
function transformWord(rawWord, bookId) {
  const id = uuidv4();
  const now = Date.now();
  
  // 转换翻译格式
  const translations = (rawWord.trans || []).map(t => ({
    type: t.pos || '',
    translation: t.cn || '',
  })).filter(t => t.translation);
  
  // 转换短语格式
  const phrases = (rawWord.phrases || []).map(p => ({
    phrase: p.c || '',
    translation: p.cn || '',
  })).filter(p => p.phrase);
  
  // 转换例句格式
  const sentences = (rawWord.sentences || []).map(s => ({
    sentence: s.c || '',
    translation: s.cn || '',
  })).filter(s => s.sentence);
  
  // 转换近义词
  const synonyms = (rawWord.synos || []).flatMap(s => s.ws || []);
  
  return {
    id,
    book_id: bookId,
    word: rawWord.word || '',
    phonetic_us: rawWord.phonetic0 || rawWord.phonetic || '',
    phonetic_uk: rawWord.phonetic1 || rawWord.phonetic || '',
    translations: JSON.stringify(translations),
    phrases: JSON.stringify(phrases),
    sentences: JSON.stringify(sentences),
    synonyms: JSON.stringify(synonyms),
    antonyms: JSON.stringify([]),
    created_at: now,
    updated_at: now,
  };
}

/**
 * 导入单个词库
 */
async function importVocabularyBook(config) {
  const jsonPath = path.join(__dirname, config.jsonFile);
  
  // 检查文件是否存在
  if (!fs.existsSync(jsonPath)) {
    console.log(`⚠️  文件不存在: ${config.jsonFile}`);
    return null;
  }
  
  console.log(`📖 正在读取: ${config.name}...`);
  
  // 读取 JSON 文件
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const words = JSON.parse(rawData);
  
  console.log(`   找到 ${words.length} 个单词`);
  
  // 创建词库记录
  const bookId = uuidv4();
  const now = Date.now();
  
  await pool.query(
    `INSERT INTO vocabulary_books (id, name, description, category, word_count, is_built_in, is_public, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, TRUE, TRUE, ?, ?)`,
    [bookId, config.name, config.description, config.category, words.length, now, now]
  );
  
  console.log(`   词库已创建: ${bookId}`);
  
  // 批量插入单词（每批 500 个）
  const BATCH_SIZE = 500;
  let inserted = 0;
  
  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, i + BATCH_SIZE);
    const transformedWords = batch.map(w => transformWord(w, bookId));
    
    // 构建批量插入 SQL
    const placeholders = transformedWords.map(() => 
      '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).join(', ');
    
    const values = transformedWords.flatMap(w => [
      w.id, w.book_id, w.word, w.phonetic_us, w.phonetic_uk,
      w.translations, w.phrases, w.sentences, w.synonyms, w.antonyms,
      w.created_at, w.updated_at
    ]);
    
    await pool.query(
      `INSERT INTO words (id, book_id, word, phonetic_us, phonetic_uk, translations, phrases, sentences, synonyms, antonyms, created_at, updated_at)
       VALUES ${placeholders}`,
      values
    );
    
    inserted += batch.length;
    process.stdout.write(`\r   已导入: ${inserted}/${words.length}`);
  }
  
  console.log(`\n✅ ${config.name} 导入完成`);
  return bookId;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始导入词库数据...\n');
  
  try {
    // 检查是否已有内置词库
    const [existing] = await pool.query(
      'SELECT COUNT(*) as count FROM vocabulary_books WHERE is_built_in = TRUE'
    );
    
    if (existing[0].count > 0) {
      console.log('⚠️  检测到已有内置词库数据');
      console.log('   如需重新导入，请先清空 vocabulary_books 和 words 表');
      console.log('   DELETE FROM words WHERE book_id IN (SELECT id FROM vocabulary_books WHERE is_built_in = TRUE);');
      console.log('   DELETE FROM vocabulary_books WHERE is_built_in = TRUE;');
      process.exit(0);
    }
    
    // 导入所有词库
    for (const config of VOCABULARY_BOOKS) {
      await importVocabularyBook(config);
      console.log('');
    }
    
    console.log('🎉 所有词库导入完成！');
    
  } catch (error) {
    console.error('❌ 导入失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
