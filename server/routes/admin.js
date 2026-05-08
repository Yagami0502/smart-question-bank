/**
 * 管理员 API 路由
 * 需要管理员权限才能访问
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 所有管理员路由都需要认证和管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

// ============================================
// 数据统计 API
// ============================================

// 获取系统概览统计
router.get('/stats/overview', async (req, res) => {
  try {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const [userStatsResult, deckStatsResult, questionStatsResult, vocabStatsResult, wordStatsResult, todayStatsResult] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as totalUsers,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeUsers,
          SUM(CASE WHEN status = 'banned' THEN 1 ELSE 0 END) as bannedUsers,
          SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) as newUsersToday
        FROM users
      `, [dayAgo]),
      pool.query(`
        SELECT
          COUNT(*) as totalDecks,
          SUM(CASE WHEN is_public = TRUE THEN 1 ELSE 0 END) as publicDecks
        FROM decks
      `),
      pool.query(`
        SELECT COUNT(*) as totalQuestions FROM questions
      `),
      pool.query(`
        SELECT
          COUNT(*) as totalBooks,
          SUM(CASE WHEN is_built_in = TRUE THEN 1 ELSE 0 END) as builtInBooks,
          SUM(CASE WHEN is_public = TRUE AND is_built_in = FALSE THEN 1 ELSE 0 END) as userPublicBooks
        FROM vocabulary_books
      `),
      pool.query(`
        SELECT COUNT(*) as totalWords FROM words
      `),
      pool.query(`
        SELECT
          COUNT(DISTINCT user_id) as activeLearnersToday,
          COUNT(*) as reviewsToday
        FROM review_logs
        WHERE review_time > ?
      `, [dayAgo])
    ]);

    const [[userStats]] = userStatsResult;
    const [[deckStats]] = deckStatsResult;
    const [[questionStats]] = questionStatsResult;
    const [[vocabStats]] = vocabStatsResult;
    const [[wordStats]] = wordStatsResult;
    const [[todayStats]] = todayStatsResult;
    
    res.json({
      users: {
        total: userStats.totalUsers,
        active: userStats.activeUsers,
        banned: userStats.bannedUsers,
        newToday: userStats.newUsersToday,
      },
      decks: {
        total: deckStats.totalDecks,
        public: deckStats.publicDecks,
      },
      questions: {
        total: questionStats.totalQuestions,
      },
      vocabulary: {
        totalBooks: vocabStats.totalBooks,
        builtInBooks: vocabStats.builtInBooks,
        userPublicBooks: vocabStats.userPublicBooks,
        totalWords: wordStats.totalWords,
      },
      today: {
        activeLearners: todayStats.activeLearnersToday,
        reviews: todayStats.reviewsToday,
      },
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// ============================================
// 用户管理 API
// ============================================

// 获取用户列表
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;
    
    const filters = [];
    const filterParams = [];

    if (status) {
      filters.push('u.status = ?');
      filterParams.push(status);
    }

    if (search) {
      filters.push('(u.username LIKE ? OR u.email LIKE ? OR u.nickname LIKE ?)');
      const searchPattern = `%${search}%`;
      filterParams.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = filters.length > 0
      ? `WHERE ${filters.join(' AND ')}`
      : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      filterParams
    );

    const [users] = await pool.query(
      `SELECT u.id, u.username, u.email, u.nickname, u.avatar, u.role, u.status,
              u.created_at, u.last_login_at, u.login_count,
              us.total_study_days, us.total_questions_answered
       FROM users u
       LEFT JOIN user_stats us ON u.id = us.user_id
       ${whereClause}
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...filterParams, parseInt(limit), offset]
    );
    
    res.json({
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        nickname: u.nickname,
        avatar: u.avatar,
        role: u.role,
        status: u.status,
        createdAt: u.created_at,
        lastLoginAt: u.last_login_at,
        loginCount: u.login_count,
        totalStudyDays: u.total_study_days || 0,
        totalQuestionsAnswered: u.total_questions_answered || 0,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 更新用户状态（禁用/启用）
router.put('/users/:userId/status', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    
    if (!['active', 'banned'].includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }
    
    // 不能禁用自己
    if (userId === req.user.userId) {
      return res.status(400).json({ error: '不能修改自己的状态' });
    }
    
    await pool.query(
      'UPDATE users SET status = ?, updated_at = ? WHERE id = ?',
      [status, Date.now(), userId]
    );
    
    res.json({ success: true, message: status === 'banned' ? '用户已禁用' : '用户已启用' });
  } catch (error) {
    console.error('更新用户状态失败:', error);
    res.status(500).json({ error: '更新用户状态失败' });
  }
});

// 删除用户
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 不能删除自己
    if (userId === req.user.userId) {
      return res.status(400).json({ error: '不能删除自己' });
    }
    
    // 检查用户是否存在
    const [users] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 不能删除其他管理员
    if (users[0].role === 'admin') {
      return res.status(400).json({ error: '不能删除管理员账户' });
    }
    
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    
    res.json({ success: true, message: '用户已删除' });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// 设置用户角色
router.put('/users/:userId/role', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }
    
    await pool.query(
      'UPDATE users SET role = ?, updated_at = ? WHERE id = ?',
      [role, Date.now(), userId]
    );
    
    res.json({ success: true, message: '角色已更新' });
  } catch (error) {
    console.error('更新用户角色失败:', error);
    res.status(500).json({ error: '更新用户角色失败' });
  }
});


// ============================================
// 题库管理 API
// ============================================

// 获取公开题库（管理员只能管理公开题库）
router.get('/decks', async (req, res) => {
  try {
    const { page = 1, limit = 20, isBuiltIn, search } = req.query;
    const offset = (page - 1) * limit;
    
    // 只查询公开题库
    let whereClause = 'd.is_public = TRUE';
    const params = [];
    
    if (isBuiltIn !== undefined) {
      whereClause += ' AND d.is_built_in = ?';
      params.push(isBuiltIn === 'true');
    }
    
    if (search) {
      whereClause += ' AND (d.name LIKE ? OR d.description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }
    
    // 获取总数
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM decks d WHERE ${whereClause}`,
      params
    );
    
    // 获取分页数据（使用 LEFT JOIN 支持显示作者已删除的题库）
    const dataParams = [...params, parseInt(limit), offset];
    const [decks] = await pool.query(
      `SELECT d.*, u.username as author_name, u.nickname as author_nickname,
              (SELECT COUNT(*) FROM questions WHERE deck_id = d.id) as question_count
       FROM decks d
       LEFT JOIN users u ON d.user_id = u.id
       WHERE ${whereClause}
       ORDER BY d.is_built_in DESC, d.created_at DESC LIMIT ? OFFSET ?`,
      dataParams
    );
    
    res.json({
      decks: decks.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        isPublic: d.is_public,
        isBuiltIn: d.is_built_in || false,
        questionCount: d.question_count,
        authorId: d.user_id,
        authorName: d.author_nickname || d.author_name || '匿名',
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('获取题库列表失败:', error);
    res.status(500).json({ error: '获取题库列表失败' });
  }
});

// 创建内置题库
router.post('/decks', async (req, res) => {
  try {
    const { name, description, isBuiltIn = false, isPublic = true } = req.body;
    const { v4: uuidv4 } = require('uuid');
    
    if (!name) {
      return res.status(400).json({ error: '题库名称不能为空' });
    }
    
    // 获取当前管理员的 userId
    const userId = req.user.userId || req.user.id;
    
    const id = uuidv4();
    const now = Date.now();
    
    await pool.query(
      `INSERT INTO decks (id, user_id, name, description, is_public, is_built_in, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, name, description || null, isPublic, isBuiltIn, now, now]
    );
    
    res.json({
      id,
      name,
      description,
      isBuiltIn,
      isPublic,
      questionCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error('创建题库失败:', error);
    res.status(500).json({ error: '创建题库失败' });
  }
});

// 更新题库信息
router.put('/decks/:deckId', async (req, res) => {
  try {
    const { deckId } = req.params;
    const { name, description } = req.body;
    
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }
    
    updates.push('updated_at = ?');
    params.push(Date.now());
    params.push(deckId);
    
    await pool.query(
      `UPDATE decks SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json({ success: true, message: '题库已更新' });
  } catch (error) {
    console.error('更新题库失败:', error);
    res.status(500).json({ error: '更新题库失败' });
  }
});

// 获取题库中的题目
router.get('/decks/:deckId/questions', async (req, res) => {
  try {
    const { deckId } = req.params;
    
    const [questions] = await pool.query(
      `SELECT id, content, type, options, correct_answer, explanation, created_at, updated_at
       FROM questions 
       WHERE deck_id = ?
       ORDER BY created_at DESC`,
      [deckId]
    );
    
    res.json({
      questions: questions.map(q => ({
        id: q.id,
        content: q.content,
        type: q.type,
        options: q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [],
        answer: q.correct_answer,
        explanation: q.explanation,
        createdAt: q.created_at,
        updatedAt: q.updated_at,
      })),
    });
  } catch (error) {
    console.error('获取题目列表失败:', error);
    res.status(500).json({ error: '获取题目列表失败' });
  }
});

// 删除题目
router.delete('/questions/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;
    
    // 获取题目所属题库
    const [questions] = await pool.query('SELECT deck_id FROM questions WHERE id = ?', [questionId]);
    if (questions.length === 0) {
      return res.status(404).json({ error: '题目不存在' });
    }
    
    await pool.query('DELETE FROM questions WHERE id = ?', [questionId]);
    
    res.json({ success: true, message: '题目已删除' });
  } catch (error) {
    console.error('删除题目失败:', error);
    res.status(500).json({ error: '删除题目失败' });
  }
});

// 更新题库公开状态
router.put('/decks/:deckId/public', async (req, res) => {
  try {
    const { deckId } = req.params;
    const { isPublic } = req.body;
    
    await pool.query(
      'UPDATE decks SET is_public = ?, updated_at = ? WHERE id = ?',
      [isPublic, Date.now(), deckId]
    );
    
    res.json({ success: true, message: isPublic ? '题库已公开' : '题库已设为私有' });
  } catch (error) {
    console.error('更新题库状态失败:', error);
    res.status(500).json({ error: '更新题库状态失败' });
  }
});

// 删除题库
router.delete('/decks/:deckId', async (req, res) => {
  try {
    const { deckId } = req.params;
    
    await pool.query('DELETE FROM decks WHERE id = ?', [deckId]);
    
    res.json({ success: true, message: '题库已删除' });
  } catch (error) {
    console.error('删除题库失败:', error);
    res.status(500).json({ error: '删除题库失败' });
  }
});

// ============================================
// 词库管理 API
// ============================================

// 获取公开词库（管理员只能管理公开词库：内置词库或用户公开的词库）
router.get('/vocabulary/books', async (req, res) => {
  try {
    const { page = 1, limit = 20, isBuiltIn, search } = req.query;
    const offset = (page - 1) * limit;
    
    // 只查询公开词库（内置词库或用户公开的词库）
    let whereClause = 'vb.is_public = TRUE';
    const params = [];
    
    if (isBuiltIn !== undefined) {
      whereClause += ' AND vb.is_built_in = ?';
      params.push(isBuiltIn === 'true');
    }
    
    if (search) {
      whereClause += ' AND (vb.name LIKE ? OR vb.description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }
    
    // 获取总数
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM vocabulary_books vb WHERE ${whereClause}`,
      params
    );
    
    // 获取分页数据
    const dataParams = [...params, parseInt(limit), offset];
    const [books] = await pool.query(
      `SELECT vb.*, 
              (SELECT COUNT(*) FROM words WHERE book_id = vb.id) as word_count
       FROM vocabulary_books vb
       WHERE ${whereClause}
       ORDER BY vb.is_built_in DESC, vb.created_at DESC LIMIT ? OFFSET ?`,
      dataParams
    );
    
    res.json({
      books: books.map(b => ({
        id: b.id,
        name: b.name,
        description: b.description,
        wordCount: b.word_count,
        isBuiltIn: b.is_built_in,
        isPublic: b.is_public,
        coverImage: b.cover_image,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('获取词库列表失败:', error);
    res.status(500).json({ error: '获取词库列表失败' });
  }
});

// 创建词库
router.post('/vocabulary/books', async (req, res) => {
  try {
    const { name, description, isBuiltIn = false, isPublic = true } = req.body;
    const { v4: uuidv4 } = require('uuid');
    
    if (!name) {
      return res.status(400).json({ error: '词库名称不能为空' });
    }
    
    const id = uuidv4();
    const now = Date.now();
    
    await pool.query(
      `INSERT INTO vocabulary_books (id, name, description, is_built_in, is_public, word_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, name, description || null, isBuiltIn, isPublic, now, now]
    );
    
    res.json({
      id,
      name,
      description,
      isBuiltIn,
      isPublic,
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error('创建词库失败:', error);
    res.status(500).json({ error: '创建词库失败' });
  }
});

// 更新词库
router.put('/vocabulary/books/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { name, description, isPublic } = req.body;
    
    const updates = [];
    const params = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (isPublic !== undefined) {
      updates.push('is_public = ?');
      params.push(isPublic);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }
    
    updates.push('updated_at = ?');
    params.push(Date.now());
    params.push(bookId);
    
    await pool.query(
      `UPDATE vocabulary_books SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json({ success: true, message: '词库已更新' });
  } catch (error) {
    console.error('更新词库失败:', error);
    res.status(500).json({ error: '更新词库失败' });
  }
});

// 删除词库
router.delete('/vocabulary/books/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    
    // 检查是否为内置词库
    const [books] = await pool.query(
      'SELECT is_built_in FROM vocabulary_books WHERE id = ?',
      [bookId]
    );
    
    if (books.length === 0) {
      return res.status(404).json({ error: '词库不存在' });
    }
    
    if (books[0].is_built_in) {
      return res.status(400).json({ error: '不能删除内置词库' });
    }
    
    await pool.query('DELETE FROM vocabulary_books WHERE id = ?', [bookId]);
    
    res.json({ success: true, message: '词库已删除' });
  } catch (error) {
    console.error('删除词库失败:', error);
    res.status(500).json({ error: '删除词库失败' });
  }
});


// ============================================
// 单词管理 API
// ============================================

// 获取词库中的单词
router.get('/vocabulary/books/:bookId/words', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { page = 1, limit = 50, search } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM words WHERE book_id = ?';
    const params = [bookId];
    
    if (search) {
      query += ' AND word LIKE ?';
      params.push(`%${search}%`);
    }
    
    // 获取总数
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM words WHERE book_id = ?` + (search ? ' AND word LIKE ?' : ''),
      search ? [bookId, `%${search}%`] : [bookId]
    );
    
    query += ' ORDER BY word LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const [words] = await pool.query(query, params);
    
    res.json({
      words: words.map(w => ({
        id: w.id,
        bookId: w.book_id,
        word: w.word,
        phoneticUs: w.phonetic_us,
        phoneticUk: w.phonetic_uk,
        translations: JSON.parse(w.translations || '[]'),
        phrases: JSON.parse(w.phrases || '[]'),
        sentences: JSON.parse(w.sentences || '[]'),
        synonyms: JSON.parse(w.synonyms || '[]'),
        antonyms: JSON.parse(w.antonyms || '[]'),
        createdAt: w.created_at,
        updatedAt: w.updated_at,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('获取单词列表失败:', error);
    res.status(500).json({ error: '获取单词列表失败' });
  }
});

// 添加单词
router.post('/vocabulary/books/:bookId/words', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { word, phoneticUs, phoneticUk, translations, phrases, sentences, synonyms, antonyms } = req.body;
    const { v4: uuidv4 } = require('uuid');
    
    if (!word || !translations || translations.length === 0) {
      return res.status(400).json({ error: '单词和释义不能为空' });
    }
    
    const id = uuidv4();
    const now = Date.now();
    
    await pool.query(
      `INSERT INTO words (id, book_id, word, phonetic_us, phonetic_uk, translations, phrases, sentences, synonyms, antonyms, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, bookId, word,
        phoneticUs || null, phoneticUk || null,
        JSON.stringify(translations),
        JSON.stringify(phrases || []),
        JSON.stringify(sentences || []),
        JSON.stringify(synonyms || []),
        JSON.stringify(antonyms || []),
        now, now
      ]
    );
    
    // 更新词库单词数量
    await pool.query(
      'UPDATE vocabulary_books SET word_count = word_count + 1, updated_at = ? WHERE id = ?',
      [now, bookId]
    );
    
    res.json({
      id,
      bookId,
      word,
      phoneticUs,
      phoneticUk,
      translations,
      phrases: phrases || [],
      sentences: sentences || [],
      synonyms: synonyms || [],
      antonyms: antonyms || [],
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error('添加单词失败:', error);
    res.status(500).json({ error: '添加单词失败' });
  }
});

// 更新单词
router.put('/vocabulary/words/:wordId', async (req, res) => {
  try {
    const { wordId } = req.params;
    const { word, phoneticUs, phoneticUk, translations, phrases, sentences, synonyms, antonyms } = req.body;
    
    const updates = [];
    const params = [];
    
    if (word !== undefined) {
      updates.push('word = ?');
      params.push(word);
    }
    if (phoneticUs !== undefined) {
      updates.push('phonetic_us = ?');
      params.push(phoneticUs);
    }
    if (phoneticUk !== undefined) {
      updates.push('phonetic_uk = ?');
      params.push(phoneticUk);
    }
    if (translations !== undefined) {
      updates.push('translations = ?');
      params.push(JSON.stringify(translations));
    }
    if (phrases !== undefined) {
      updates.push('phrases = ?');
      params.push(JSON.stringify(phrases));
    }
    if (sentences !== undefined) {
      updates.push('sentences = ?');
      params.push(JSON.stringify(sentences));
    }
    if (synonyms !== undefined) {
      updates.push('synonyms = ?');
      params.push(JSON.stringify(synonyms));
    }
    if (antonyms !== undefined) {
      updates.push('antonyms = ?');
      params.push(JSON.stringify(antonyms));
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }
    
    updates.push('updated_at = ?');
    params.push(Date.now());
    params.push(wordId);
    
    await pool.query(
      `UPDATE words SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    res.json({ success: true, message: '单词已更新' });
  } catch (error) {
    console.error('更新单词失败:', error);
    res.status(500).json({ error: '更新单词失败' });
  }
});

// 删除单词
router.delete('/vocabulary/words/:wordId', async (req, res) => {
  try {
    const { wordId } = req.params;
    
    // 获取单词所属词库
    const [words] = await pool.query('SELECT book_id FROM words WHERE id = ?', [wordId]);
    if (words.length === 0) {
      return res.status(404).json({ error: '单词不存在' });
    }
    
    const bookId = words[0].book_id;
    
    await pool.query('DELETE FROM words WHERE id = ?', [wordId]);
    
    // 更新词库单词数量
    await pool.query(
      'UPDATE vocabulary_books SET word_count = word_count - 1, updated_at = ? WHERE id = ?',
      [Date.now(), bookId]
    );
    
    res.json({ success: true, message: '单词已删除' });
  } catch (error) {
    console.error('删除单词失败:', error);
    res.status(500).json({ error: '删除单词失败' });
  }
});

// 批量导入单词
router.post('/vocabulary/books/:bookId/import', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { words } = req.body;
    const { v4: uuidv4 } = require('uuid');
    
    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: '单词列表不能为空' });
    }
    
    const now = Date.now();
    let importedCount = 0;
    
    // 批量插入
    for (const w of words) {
      if (!w.word || !w.translations || w.translations.length === 0) {
        continue;
      }
      
      const id = uuidv4();
      await pool.query(
        `INSERT INTO words (id, book_id, word, phonetic_us, phonetic_uk, translations, phrases, sentences, synonyms, antonyms, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, bookId, w.word,
          w.phoneticUs || w.phonetic_us || null,
          w.phoneticUk || w.phonetic_uk || null,
          JSON.stringify(w.translations),
          JSON.stringify(w.phrases || []),
          JSON.stringify(w.sentences || []),
          JSON.stringify(w.synonyms || []),
          JSON.stringify(w.antonyms || []),
          now, now
        ]
      );
      importedCount++;
    }
    
    // 更新词库单词数量
    await pool.query(
      'UPDATE vocabulary_books SET word_count = word_count + ?, updated_at = ? WHERE id = ?',
      [importedCount, now, bookId]
    );
    
    res.json({ 
      success: true, 
      message: `成功导入 ${importedCount} 个单词`,
      importedCount,
    });
  } catch (error) {
    console.error('批量导入单词失败:', error);
    res.status(500).json({ error: '批量导入单词失败' });
  }
});

module.exports = router;
