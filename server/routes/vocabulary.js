/**
 * 词库相关 API 路由
 */
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

function normalizeImportWord(word) {
  if (!word || typeof word !== 'object') {
    return null;
  }

  const normalizedTranslations = Array.isArray(word.translations)
    ? word.translations
        .map(item => ({
          type: String(item?.type || item?.pos || '').trim(),
          translation: String(item?.translation || item?.cn || '').trim(),
        }))
        .filter(item => item.translation)
    : [];

  const normalizedWord = String(word.word || '').trim();
  if (!normalizedWord || normalizedTranslations.length === 0) {
    return null;
  }

  return {
    word: normalizedWord,
    phoneticUs: String(word.phonetic?.us || word.phonetic_us || word.phoneticUs || '').trim() || null,
    phoneticUk: String(word.phonetic?.uk || word.phonetic_uk || word.phoneticUk || '').trim() || null,
    translations: normalizedTranslations,
    phrases: Array.isArray(word.phrases) ? word.phrases : [],
    sentences: Array.isArray(word.sentences) ? word.sentences : [],
    synonyms: Array.isArray(word.synonyms) ? word.synonyms : [],
    antonyms: Array.isArray(word.antonyms) ? word.antonyms : [],
  };
}

// ============================================
// 公共词库 API
// ============================================

// 获取所有公共词库
router.get('/books/public', async (req, res) => {
  try {
    const [books] = await pool.query(
      `SELECT vb.id, vb.name, vb.description, vb.word_count, 
              vb.is_built_in, vb.cover_image, vb.created_at, vb.user_id,
              u.username as author_name, u.nickname as author_nickname
       FROM vocabulary_books vb
       LEFT JOIN users u ON vb.user_id = u.id
       WHERE vb.is_public = TRUE 
       ORDER BY vb.is_built_in DESC, vb.created_at DESC`
    );
    res.json(books.map(b => ({
      id: b.id,
      name: b.name,
      description: b.description,
      wordCount: b.word_count,
      isBuiltIn: b.is_built_in,
      coverImage: b.cover_image,
      createdAt: b.created_at,
      authorId: b.user_id,
      authorName: b.author_nickname || b.author_name || (b.is_built_in ? '官方' : '匿名'),
    })));
  } catch (error) {
    console.error('获取公共词库失败:', error);
    res.status(500).json({ error: '获取公共词库失败' });
  }
});

// 获取词库详情
router.get('/books/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    const [books] = await pool.query(
      'SELECT * FROM vocabulary_books WHERE id = ?',
      [bookId]
    );
    if (books.length === 0) {
      return res.status(404).json({ error: '词库不存在' });
    }
    res.json(books[0]);
  } catch (error) {
    console.error('获取词库详情失败:', error);
    res.status(500).json({ error: '获取词库详情失败' });
  }
});

// 创建自定义词库
router.post('/books', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, description } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '词库名称不能为空' });
    }
    
    const id = uuidv4();
    const now = Date.now();
    
    await pool.query(
      `INSERT INTO vocabulary_books (id, name, description, word_count, is_built_in, is_public, user_id, created_at, updated_at)
       VALUES (?, ?, ?, 0, FALSE, FALSE, ?, ?, ?)`,
      [id, name.trim(), description || null, userId, now, now]
    );
    
    res.json({ id, message: '创建成功' });
  } catch (error) {
    console.error('创建词库失败:', error);
    res.status(500).json({ error: '创建词库失败' });
  }
});

// 更新词库
router.put('/books/:bookId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;
    const { name, description } = req.body;
    
    // 验证是用户自己创建的词库
    const [books] = await pool.query(
      'SELECT id FROM vocabulary_books WHERE id = ? AND user_id = ? AND is_built_in = FALSE',
      [bookId, userId]
    );
    
    if (books.length === 0) {
      return res.status(404).json({ error: '词库不存在或无权限' });
    }
    
    await pool.query(
      'UPDATE vocabulary_books SET name = ?, description = ?, updated_at = ? WHERE id = ?',
      [name, description || null, Date.now(), bookId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('更新词库失败:', error);
    res.status(500).json({ error: '更新词库失败' });
  }
});

// 删除词库
router.delete('/books/:bookId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;
    
    // 验证是用户自己创建的词库（非内置）
    const [books] = await pool.query(
      'SELECT id FROM vocabulary_books WHERE id = ? AND user_id = ? AND is_built_in = FALSE',
      [bookId, userId]
    );
    
    if (books.length === 0) {
      return res.status(404).json({ error: '词库不存在或无权限' });
    }
    
    // 删除相关数据
    await pool.query('DELETE FROM words WHERE book_id = ?', [bookId]);
    await pool.query('DELETE FROM user_vocabularies WHERE book_id = ?', [bookId]);
    await pool.query('DELETE FROM word_progress WHERE book_id = ?', [bookId]);
    await pool.query('DELETE FROM wrong_words WHERE book_id = ?', [bookId]);
    await pool.query('DELETE FROM favorite_words WHERE book_id = ?', [bookId]);
    await pool.query('DELETE FROM mastered_words WHERE book_id = ?', [bookId]);
    await pool.query('DELETE FROM vocabulary_books WHERE id = ?', [bookId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除词库失败:', error);
    res.status(500).json({ error: '删除词库失败' });
  }
});

// 获取词库中的单词
router.get('/books/:bookId/words', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    
    const [words] = await pool.query(
      `SELECT * FROM words WHERE book_id = ? ORDER BY word LIMIT ? OFFSET ?`,
      [bookId, parseInt(limit), offset]
    );
    
    // 解析 JSON 字段
    const parsedWords = words.map(w => ({
      ...w,
      translations: JSON.parse(w.translations || '[]'),
      phrases: JSON.parse(w.phrases || '[]'),
      sentences: JSON.parse(w.sentences || '[]'),
      synonyms: JSON.parse(w.synonyms || '[]'),
      antonyms: JSON.parse(w.antonyms || '[]'),
      phonetic: {
        us: w.phonetic_us,
        uk: w.phonetic_uk,
      },
    }));
    
    res.json(parsedWords);
  } catch (error) {
    console.error('获取单词列表失败:', error);
    res.status(500).json({ error: '获取单词列表失败' });
  }
});

// ============================================
// 用户词库 API（需要认证）
// ============================================

// 批量导入单词（普通用户）
router.post('/books/:bookId/import', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;
    const { words } = req.body;

    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: '单词列表不能为空' });
    }

    const [books] = await pool.query(
      'SELECT id FROM vocabulary_books WHERE id = ? AND user_id = ? AND is_built_in = FALSE',
      [bookId, userId]
    );

    if (books.length === 0) {
      return res.status(404).json({ error: '词库不存在或无权限' });
    }

    const now = Date.now();
    let importedCount = 0;

    for (const rawWord of words) {
      const word = normalizeImportWord(rawWord);
      if (!word) {
        continue;
      }

      await pool.query(
        `INSERT INTO words (id, book_id, word, phonetic_us, phonetic_uk, translations, phrases, sentences, synonyms, antonyms, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          bookId,
          word.word,
          word.phoneticUs,
          word.phoneticUk,
          JSON.stringify(word.translations),
          JSON.stringify(word.phrases),
          JSON.stringify(word.sentences),
          JSON.stringify(word.synonyms),
          JSON.stringify(word.antonyms),
          now,
          now,
        ]
      );
      importedCount++;
    }

    await pool.query(
      'UPDATE vocabulary_books SET word_count = word_count + ?, updated_at = ? WHERE id = ?',
      [importedCount, now, bookId]
    );

    res.json({ success: true, importedCount, message: `成功导入 ${importedCount} 个单词` });
  } catch (error) {
    console.error('批量导入单词失败:', error);
    res.status(500).json({ error: '批量导入单词失败' });
  }
});

// 获取用户的词库列表
router.get('/user/books', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [vocabularies] = await pool.query(
      `SELECT uv.*, vb.name as book_name, vb.description, vb.word_count,
              vb.is_built_in, vb.is_public, vb.cover_image, vb.user_id as book_user_id
       FROM user_vocabularies uv
       JOIN vocabulary_books vb ON uv.book_id = vb.id
       WHERE uv.user_id = ?
       ORDER BY uv.updated_at DESC`,
      [userId]
    );
    
    res.json(vocabularies.map(v => ({
      ...v,
      // 标记是否是用户自己创建的词库（可以编辑公开状态）
      isOwner: v.book_user_id === userId,
    })));
  } catch (error) {
    console.error('获取用户词库失败:', error);
    res.status(500).json({ error: '获取用户词库失败' });
  }
});

// 添加词库到用户
router.post('/user/books', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.body;
    
    // 检查是否已添加
    const [existing] = await pool.query(
      'SELECT id FROM user_vocabularies WHERE user_id = ? AND book_id = ?',
      [userId, bookId]
    );
    
    if (existing.length > 0) {
      return res.json({ id: existing[0].id, message: '词库已添加' });
    }
    
    const id = uuidv4();
    const now = Date.now();
    
    await pool.query(
      `INSERT INTO user_vocabularies (id, user_id, book_id, learned_count, mastered_count, created_at, updated_at)
       VALUES (?, ?, ?, 0, 0, ?, ?)`,
      [id, userId, bookId, now, now]
    );
    
    res.json({ id, message: '添加成功' });
  } catch (error) {
    console.error('添加词库失败:', error);
    res.status(500).json({ error: '添加词库失败' });
  }
});

// 移除用户词库
router.delete('/user/books/:bookId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;
    
    await pool.query(
      'DELETE FROM user_vocabularies WHERE user_id = ? AND book_id = ?',
      [userId, bookId]
    );
    
    res.json({ message: '移除成功' });
  } catch (error) {
    console.error('移除词库失败:', error);
    res.status(500).json({ error: '移除词库失败' });
  }
});

// 切换词库公开状态（仅限用户自己创建的词库）
router.patch('/books/:bookId/public', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;
    const { isPublic } = req.body;
    
    // 验证是用户自己创建的词库（非内置）
    const [books] = await pool.query(
      'SELECT id, is_built_in FROM vocabulary_books WHERE id = ? AND user_id = ?',
      [bookId, userId]
    );
    
    if (books.length === 0) {
      return res.status(404).json({ error: '词库不存在或无权限' });
    }
    
    if (books[0].is_built_in) {
      return res.status(403).json({ error: '内置词库不能修改公开状态' });
    }
    
    await pool.query(
      'UPDATE vocabulary_books SET is_public = ?, updated_at = ? WHERE id = ?',
      [isPublic, Date.now(), bookId]
    );
    
    res.json({ success: true, isPublic });
  } catch (error) {
    console.error('更新词库公开状态失败:', error);
    res.status(500).json({ error: '更新词库公开状态失败' });
  }
});

// 获取用户词库统计
router.get('/user/books/:bookId/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;
    
    // 获取总词数
    const [[{ wordCount }]] = await pool.query(
      'SELECT COUNT(*) as wordCount FROM words WHERE book_id = ?',
      [bookId]
    );
    
    // 获取学习中的词数
    const [[{ learnedCount }]] = await pool.query(
      `SELECT COUNT(*) as learnedCount FROM word_progress 
       WHERE user_id = ? AND book_id = ? AND state != 'new'`,
      [userId, bookId]
    );
    
    // 获取已掌握的词数
    const [[{ masteredCount }]] = await pool.query(
      'SELECT COUNT(*) as masteredCount FROM mastered_words WHERE user_id = ? AND book_id = ?',
      [userId, bookId]
    );
    
    res.json({ wordCount, learnedCount, masteredCount });
  } catch (error) {
    console.error('获取词库统计失败:', error);
    res.status(500).json({ error: '获取词库统计失败' });
  }
});

// ============================================
// 学习进度 API
// ============================================

// 获取待学习/复习的单词
router.get('/user/books/:bookId/practice', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;
    const { mode = 'smart', limit = 20 } = req.query;
    const now = Date.now();
    
    let words = [];
    
    if (mode === 'smart') {
      // 智能模式：优先复习到期单词，然后学习新单词
      // 1. 获取到期的复习单词
      const [dueWords] = await pool.query(
        `SELECT w.*, wp.state, wp.due_date
         FROM words w
         JOIN word_progress wp ON w.id = wp.word_id
         WHERE wp.user_id = ? AND wp.book_id = ? 
           AND wp.state IN ('learning', 'review') 
           AND wp.due_date <= ?
         ORDER BY wp.due_date
         LIMIT ?`,
        [userId, bookId, now, parseInt(limit)]
      );
      
      words = dueWords;
      
      // 2. 如果不够，补充新单词
      if (words.length < limit) {
        const remaining = limit - words.length;
        const existingWordIds = words.map(w => w.id);
        
        // 获取还没有进度记录的单词
        let newWordsQuery = `
          SELECT w.* FROM words w
          LEFT JOIN word_progress wp ON w.id = wp.word_id AND wp.user_id = ?
          WHERE w.book_id = ? AND wp.id IS NULL
          LIMIT ?
        `;
        
        const [newWords] = await pool.query(newWordsQuery, [userId, bookId, remaining]);
        words = [...words, ...newWords];
      }
    } else {
      // 自由模式：随机获取单词
      const [randomWords] = await pool.query(
        `SELECT * FROM words WHERE book_id = ? ORDER BY RAND() LIMIT ?`,
        [bookId, parseInt(limit)]
      );
      words = randomWords;
    }
    
    // 解析 JSON 字段
    const parsedWords = words.map(w => ({
      ...w,
      translations: JSON.parse(w.translations || '[]'),
      phrases: JSON.parse(w.phrases || '[]'),
      sentences: JSON.parse(w.sentences || '[]'),
      synonyms: JSON.parse(w.synonyms || '[]'),
      antonyms: JSON.parse(w.antonyms || '[]'),
      phonetic: {
        us: w.phonetic_us,
        uk: w.phonetic_uk,
      },
    }));
    
    res.json(parsedWords);
  } catch (error) {
    console.error('获取练习单词失败:', error);
    res.status(500).json({ error: '获取练习单词失败' });
  }
});

// 更新学习进度
router.post('/user/progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { wordId, bookId, isCorrect } = req.body;
    const now = Date.now();
    
    // 获取现有进度
    const [existing] = await pool.query(
      'SELECT * FROM word_progress WHERE user_id = ? AND word_id = ?',
      [userId, wordId]
    );
    
    let state, interval, easeFactor, reps, lapses, correctCount, wrongCount;
    
    if (existing.length === 0) {
      // 初始化进度
      state = isCorrect ? 'learning' : 'new';
      interval = isCorrect ? 1 : 0;
      easeFactor = 2.5;
      reps = isCorrect ? 1 : 0;
      lapses = isCorrect ? 0 : 1;
      correctCount = isCorrect ? 1 : 0;
      wrongCount = isCorrect ? 0 : 1;
      
      const id = uuidv4();
      const dueDate = now + interval * 24 * 60 * 60 * 1000;
      
      await pool.query(
        `INSERT INTO word_progress 
         (id, user_id, word_id, book_id, state, due_date, interval_days, ease_factor, reps, lapses, correct_count, wrong_count, last_review, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, wordId, bookId, state, dueDate, interval, easeFactor, reps, lapses, correctCount, wrongCount, now, now, now]
      );
    } else {
      // 更新进度（SM-2 算法简化版）
      const progress = existing[0];
      state = progress.state;
      interval = progress.interval_days;
      easeFactor = progress.ease_factor;
      reps = progress.reps;
      lapses = progress.lapses;
      correctCount = progress.correct_count;
      wrongCount = progress.wrong_count;
      
      if (isCorrect) {
        correctCount++;
        reps++;
        
        if (state === 'new' || state === 'learning') {
          interval = 1;
          state = 'learning';
        } else {
          interval = Math.round(interval * easeFactor);
        }
        
        easeFactor = Math.max(1.3, easeFactor + 0.1);
        
        if (reps >= 3 && state === 'learning') {
          state = 'review';
        }
      } else {
        wrongCount++;
        lapses++;
        interval = 1;
        state = 'learning';
        easeFactor = Math.max(1.3, easeFactor - 0.2);
      }
      
      const dueDate = now + interval * 24 * 60 * 60 * 1000;
      
      await pool.query(
        `UPDATE word_progress SET 
         state = ?, due_date = ?, interval_days = ?, ease_factor = ?, 
         reps = ?, lapses = ?, correct_count = ?, wrong_count = ?, 
         last_review = ?, updated_at = ?
         WHERE id = ?`,
        [state, dueDate, interval, easeFactor, reps, lapses, correctCount, wrongCount, now, now, progress.id]
      );
    }
    
    // 更新用户词库统计
    await updateUserVocabularyStats(userId, bookId);
    
    res.json({ success: true, state, interval });
  } catch (error) {
    console.error('更新学习进度失败:', error);
    res.status(500).json({ error: '更新学习进度失败' });
  }
});

// 更新用户词库统计的辅助函数
async function updateUserVocabularyStats(userId, bookId) {
  const [[{ learnedCount }]] = await pool.query(
    `SELECT COUNT(*) as learnedCount FROM word_progress 
     WHERE user_id = ? AND book_id = ? AND state != 'new'`,
    [userId, bookId]
  );
  
  const [[{ masteredCount }]] = await pool.query(
    'SELECT COUNT(*) as masteredCount FROM mastered_words WHERE user_id = ? AND book_id = ?',
    [userId, bookId]
  );
  
  await pool.query(
    'UPDATE user_vocabularies SET learned_count = ?, mastered_count = ?, updated_at = ? WHERE user_id = ? AND book_id = ?',
    [learnedCount, masteredCount, Date.now(), userId, bookId]
  );
}

// ============================================
// 错词本 API
// ============================================

// 获取错词列表
router.get('/user/wrong-words', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.query;
    
    let query = `
      SELECT ww.*, w.translations, w.phonetic_us, w.phonetic_uk
      FROM wrong_words ww
      JOIN words w ON ww.word_id = w.id
      WHERE ww.user_id = ?
    `;
    const params = [userId];
    
    if (bookId) {
      query += ' AND ww.book_id = ?';
      params.push(bookId);
    }
    
    query += ' ORDER BY ww.last_wrong_time DESC';
    
    const [wrongWords] = await pool.query(query, params);
    
    const parsed = wrongWords.map(w => ({
      ...w,
      translations: JSON.parse(w.translations || '[]'),
      userInputs: JSON.parse(w.user_inputs || '[]'),
      phonetic: { us: w.phonetic_us, uk: w.phonetic_uk },
    }));
    
    res.json(parsed);
  } catch (error) {
    console.error('获取错词列表失败:', error);
    res.status(500).json({ error: '获取错词列表失败' });
  }
});

// 添加错词
router.post('/user/wrong-words', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { wordId, bookId, word, userInput } = req.body;
    const now = Date.now();
    
    const [existing] = await pool.query(
      'SELECT * FROM wrong_words WHERE user_id = ? AND word_id = ?',
      [userId, wordId]
    );
    
    if (existing.length > 0) {
      const userInputs = JSON.parse(existing[0].user_inputs || '[]');
      userInputs.push(userInput);
      
      await pool.query(
        `UPDATE wrong_words SET wrong_count = wrong_count + 1, last_wrong_time = ?, 
         user_inputs = ?, updated_at = ? WHERE id = ?`,
        [now, JSON.stringify(userInputs.slice(-10)), now, existing[0].id]
      );
    } else {
      const id = uuidv4();
      await pool.query(
        `INSERT INTO wrong_words (id, user_id, word_id, book_id, word, wrong_count, last_wrong_time, user_inputs, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        [id, userId, wordId, bookId, word, now, JSON.stringify([userInput]), now, now]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('添加错词失败:', error);
    res.status(500).json({ error: '添加错词失败' });
  }
});

// 删除错词
router.delete('/user/wrong-words/:wordId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { wordId } = req.params;
    
    await pool.query(
      'DELETE FROM wrong_words WHERE user_id = ? AND word_id = ?',
      [userId, wordId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除错词失败:', error);
    res.status(500).json({ error: '删除错词失败' });
  }
});

// ============================================
// 收藏 API
// ============================================

// 获取收藏列表
router.get('/user/favorites', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [favorites] = await pool.query(
      `SELECT fw.*, w.translations, w.phonetic_us, w.phonetic_uk, vb.name as book_name
       FROM favorite_words fw
       JOIN words w ON fw.word_id = w.id
       JOIN vocabulary_books vb ON fw.book_id = vb.id
       WHERE fw.user_id = ?
       ORDER BY fw.created_at DESC`,
      [userId]
    );
    
    const parsed = favorites.map(f => ({
      ...f,
      translations: JSON.parse(f.translations || '[]'),
      phonetic: { us: f.phonetic_us, uk: f.phonetic_uk },
    }));
    
    res.json(parsed);
  } catch (error) {
    console.error('获取收藏列表失败:', error);
    res.status(500).json({ error: '获取收藏列表失败' });
  }
});

// 切换收藏状态
router.post('/user/favorites/toggle', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { wordId, bookId, word } = req.body;
    
    const [existing] = await pool.query(
      'SELECT id FROM favorite_words WHERE user_id = ? AND word_id = ?',
      [userId, wordId]
    );
    
    if (existing.length > 0) {
      await pool.query('DELETE FROM favorite_words WHERE id = ?', [existing[0].id]);
      res.json({ isFavorite: false });
    } else {
      const id = uuidv4();
      await pool.query(
        'INSERT INTO favorite_words (id, user_id, word_id, book_id, word, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, userId, wordId, bookId, word, Date.now()]
      );
      res.json({ isFavorite: true });
    }
  } catch (error) {
    console.error('切换收藏状态失败:', error);
    res.status(500).json({ error: '切换收藏状态失败' });
  }
});

// ============================================
// 已掌握 API
// ============================================

// 标记为已掌握
router.post('/user/mastered', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { wordId, bookId, word } = req.body;
    const now = Date.now();
    
    const [existing] = await pool.query(
      'SELECT id FROM mastered_words WHERE user_id = ? AND word_id = ?',
      [userId, wordId]
    );
    
    if (existing.length === 0) {
      const id = uuidv4();
      await pool.query(
        'INSERT INTO mastered_words (id, user_id, word_id, book_id, word, mastered_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, userId, wordId, bookId, word, now]
      );
      
      // 更新进度状态
      await pool.query(
        `UPDATE word_progress SET state = 'mastered', updated_at = ? WHERE user_id = ? AND word_id = ?`,
        [now, userId, wordId]
      );
      
      // 更新统计
      await updateUserVocabularyStats(userId, bookId);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('标记已掌握失败:', error);
    res.status(500).json({ error: '标记已掌握失败' });
  }
});

// ============================================
// 设置 API
// ============================================

// 获取词库设置
router.get('/user/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [settings] = await pool.query(
      'SELECT * FROM vocabulary_settings WHERE user_id = ?',
      [userId]
    );
    
    if (settings.length === 0) {
      // 返回默认设置
      res.json({
        dailyNewWords: 20,
        dailyReviewWords: 50,
        autoPlayAudio: true,
        voiceType: 'us',
        speechRate: 1.0,
        showPhonetic: true,
        showExample: true,
        keyboardSound: false,
        keyboardSoundType: 'mechanical',
      });
    } else {
      const s = settings[0];
      res.json({
        dailyNewWords: s.daily_new_words,
        dailyReviewWords: s.daily_review_words,
        autoPlayAudio: s.auto_play_audio,
        voiceType: s.voice_type,
        speechRate: s.speech_rate,
        showPhonetic: s.show_phonetic,
        showExample: s.show_example,
        keyboardSound: s.keyboard_sound,
        keyboardSoundType: s.keyboard_sound_type,
      });
    }
  } catch (error) {
    console.error('获取设置失败:', error);
    res.status(500).json({ error: '获取设置失败' });
  }
});

// 保存词库设置
router.put('/user/settings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const settings = req.body;
    const now = Date.now();
    
    const [existing] = await pool.query(
      'SELECT id FROM vocabulary_settings WHERE user_id = ?',
      [userId]
    );
    
    if (existing.length === 0) {
      const id = uuidv4();
      await pool.query(
        `INSERT INTO vocabulary_settings 
         (id, user_id, daily_new_words, daily_review_words, auto_play_audio, voice_type, speech_rate, show_phonetic, show_example, keyboard_sound, keyboard_sound_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, settings.dailyNewWords, settings.dailyReviewWords, settings.autoPlayAudio, settings.voiceType, settings.speechRate, settings.showPhonetic, settings.showExample, settings.keyboardSound, settings.keyboardSoundType, now, now]
      );
    } else {
      await pool.query(
        `UPDATE vocabulary_settings SET 
         daily_new_words = ?, daily_review_words = ?, auto_play_audio = ?, voice_type = ?, 
         speech_rate = ?, show_phonetic = ?, show_example = ?, keyboard_sound = ?, 
         keyboard_sound_type = ?, updated_at = ?
         WHERE user_id = ?`,
        [settings.dailyNewWords, settings.dailyReviewWords, settings.autoPlayAudio, settings.voiceType, settings.speechRate, settings.showPhonetic, settings.showExample, settings.keyboardSound, settings.keyboardSoundType, now, userId]
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('保存设置失败:', error);
    res.status(500).json({ error: '保存设置失败' });
  }
});

// ============================================
// 批量操作 API
// ============================================

// 清空所有错词
router.delete('/user/wrong-words', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    await pool.query('DELETE FROM wrong_words WHERE user_id = ?', [userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('清空错词失败:', error);
    res.status(500).json({ error: '清空错词失败' });
  }
});

// 清空所有收藏
router.delete('/user/favorites', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    await pool.query('DELETE FROM favorite_words WHERE user_id = ?', [userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('清空收藏失败:', error);
    res.status(500).json({ error: '清空收藏失败' });
  }
});

// ============================================
// 学习进度查询 API
// ============================================

// 获取词库的学习进度列表
router.get('/user/books/:bookId/progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;
    
    const [progress] = await pool.query(
      `SELECT wp.*, w.word, w.translations, w.phonetic_us, w.phonetic_uk
       FROM word_progress wp
       JOIN words w ON wp.word_id = w.id
       WHERE wp.user_id = ? AND wp.book_id = ?`,
      [userId, bookId]
    );
    
    const parsed = progress.map(p => ({
      id: p.id,
      wordId: p.word_id,
      bookId: p.book_id,
      word: p.word,
      state: p.state,
      dueDate: p.due_date,
      interval: p.interval_days,
      easeFactor: p.ease_factor,
      reps: p.reps,
      lapses: p.lapses,
      correctCount: p.correct_count,
      wrongCount: p.wrong_count,
      lastReview: p.last_review,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      translations: JSON.parse(p.translations || '[]'),
      phonetic: { us: p.phonetic_us, uk: p.phonetic_uk },
    }));
    
    res.json(parsed);
  } catch (error) {
    console.error('获取学习进度失败:', error);
    res.status(500).json({ error: '获取学习进度失败' });
  }
});

// 删除单词的学习进度
router.delete('/user/progress/:wordId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { wordId } = req.params;
    
    await pool.query(
      'DELETE FROM word_progress WHERE user_id = ? AND word_id = ?',
      [userId, wordId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除学习进度失败:', error);
    res.status(500).json({ error: '删除学习进度失败' });
  }
});

// ============================================
// 文章 API
// ============================================

// 获取所有文章
router.get('/articles', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 获取公共文章和用户自己的文章
    const [articles] = await pool.query(
      `SELECT * FROM articles 
       WHERE is_public = TRUE OR user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );
    
    res.json(articles.map(a => ({
      id: a.id,
      title: a.title,
      content: a.content,
      translation: a.translation,
      category: a.category,
      difficulty: a.difficulty,
      wordCount: a.word_count,
      isBuiltIn: a.is_built_in,
      isPublic: a.is_public,
      userId: a.user_id,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    })));
  } catch (error) {
    console.error('获取文章列表失败:', error);
    res.status(500).json({ error: '获取文章列表失败' });
  }
});

// 添加文章
router.post('/articles', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, content, translation, category, difficulty } = req.body;
    const now = Date.now();
    const id = uuidv4();
    
    // 计算单词数
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    
    await pool.query(
      `INSERT INTO articles (id, title, content, translation, category, difficulty, word_count, is_built_in, is_public, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, FALSE, ?, ?, ?)`,
      [id, title, content, translation || null, category || null, difficulty || 3, wordCount, userId, now, now]
    );
    
    res.json({
      id,
      title,
      content,
      translation,
      category,
      difficulty: difficulty || 3,
      wordCount,
      isBuiltIn: false,
      isPublic: false,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error('添加文章失败:', error);
    res.status(500).json({ error: '添加文章失败' });
  }
});

// 删除文章
router.delete('/articles/:articleId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { articleId } = req.params;
    
    // 只能删除自己的文章
    const [result] = await pool.query(
      'DELETE FROM articles WHERE id = ? AND user_id = ? AND is_built_in = FALSE',
      [articleId, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '文章不存在或无权删除' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除文章失败:', error);
    res.status(500).json({ error: '删除文章失败' });
  }
});

// ============================================
// 已掌握单词列表 API
// ============================================

// 获取已掌握单词列表
router.get('/user/mastered', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.query;
    
    let query = `
      SELECT mw.*, w.translations, w.phonetic_us, w.phonetic_uk, vb.name as book_name
      FROM mastered_words mw
      JOIN words w ON mw.word_id = w.id
      JOIN vocabulary_books vb ON mw.book_id = vb.id
      WHERE mw.user_id = ?
    `;
    const params = [userId];
    
    if (bookId) {
      query += ' AND mw.book_id = ?';
      params.push(bookId);
    }
    
    query += ' ORDER BY mw.mastered_at DESC';
    
    const [mastered] = await pool.query(query, params);
    
    res.json(mastered.map(m => ({
      id: m.id,
      wordId: m.word_id,
      bookId: m.book_id,
      word: m.word,
      masteredAt: m.mastered_at,
      bookName: m.book_name,
      translations: JSON.parse(m.translations || '[]'),
      phonetic: { us: m.phonetic_us, uk: m.phonetic_uk },
    })));
  } catch (error) {
    console.error('获取已掌握单词失败:', error);
    res.status(500).json({ error: '获取已掌握单词失败' });
  }
});

// 取消已掌握状态
router.delete('/user/mastered/:wordId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { wordId } = req.params;
    
    // 获取 bookId 用于更新统计
    const [mastered] = await pool.query(
      'SELECT book_id FROM mastered_words WHERE user_id = ? AND word_id = ?',
      [userId, wordId]
    );
    
    if (mastered.length > 0) {
      const bookId = mastered[0].book_id;
      
      await pool.query(
        'DELETE FROM mastered_words WHERE user_id = ? AND word_id = ?',
        [userId, wordId]
      );
      
      // 恢复进度状态为 review
      await pool.query(
        `UPDATE word_progress SET state = 'review', updated_at = ? WHERE user_id = ? AND word_id = ?`,
        [Date.now(), userId, wordId]
      );
      
      // 更新统计
      await updateUserVocabularyStats(userId, bookId);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('取消已掌握状态失败:', error);
    res.status(500).json({ error: '取消已掌握状态失败' });
  }
});

module.exports = router;
