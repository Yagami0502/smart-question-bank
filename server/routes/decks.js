/**
 * 题库 API 路由
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// ============ 公共题库 API（必须放在 /:id 路由之前）============

// 获取所有公共题库
router.get('/public/list', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.*, u.username as author_name, u.nickname as author_nickname,
        (SELECT COUNT(*) FROM questions WHERE deck_id = d.id) as question_count
       FROM decks d
       LEFT JOIN users u ON d.user_id = u.id
       WHERE d.is_public = 1
       ORDER BY d.created_at DESC`
    );
    
    const decks = rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      authorId: row.user_id,
      authorName: row.author_nickname || row.author_name || '匿名',
      questionCount: row.question_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(decks);
  } catch (error) {
    console.error('获取公共题库失败:', error);
    res.status(500).json({ error: '获取公共题库失败' });
  }
});

// 获取公共题库的题目列表（只读预览）- 必须在 /public/:id 之前
router.get('/public/:id/questions', authenticateToken, async (req, res) => {
  try {
    const deckId = req.params.id;
    
    // 验证是公共题库
    const [deckRows] = await pool.query(
      'SELECT id FROM decks WHERE id = ? AND is_public = 1',
      [deckId]
    );
    
    if (deckRows.length === 0) {
      return res.status(404).json({ error: '公共题库不存在' });
    }
    
    // 获取题目列表
    const [questions] = await pool.query(
      'SELECT id, content, type, options, correct_answer, explanation FROM questions WHERE deck_id = ? ORDER BY created_at ASC',
      [deckId]
    );
    
    const result = questions.map(q => {
      // 解析 JSON 字段
      let content = q.content;
      let options = q.options;
      
      // 解析 content
      try {
        if (typeof content === 'string') content = JSON.parse(content);
      } catch {}
      
      // 解析 options - 可能是嵌套 JSON 字符串
      try {
        if (typeof options === 'string') {
          options = JSON.parse(options);
          // 如果解析后还是字符串，再解析一次（双重 JSON 编码情况）
          if (typeof options === 'string') {
            options = JSON.parse(options);
          }
        }
      } catch {}
      
      // 标准化选项格式为 [{id, text}]
      if (Array.isArray(options)) {
        options = options.map((opt, idx) => {
          if (typeof opt === 'string') {
            return { id: String(idx), text: opt };
          }
          if (opt.text) {
            return { id: opt.id || String(idx), text: opt.text };
          }
          if (opt.content) {
            const text = typeof opt.content === 'string' ? opt.content : (opt.content.text || '');
            return { id: opt.id || String(idx), text };
          }
          return { id: String(idx), text: String(opt) };
        });
      } else {
        options = [];
      }
      
      // 解析正确答案
      let correctAnswer = q.correct_answer;
      try {
        if (typeof correctAnswer === 'string') {
          correctAnswer = JSON.parse(correctAnswer);
        }
      } catch {}
      
      return {
        id: q.id,
        content,
        type: q.type,
        options,
        correctAnswer,
        explanation: q.explanation
      };
    });
    
    res.json(result);
  } catch (error) {
    console.error('获取公共题库题目失败:', error);
    res.status(500).json({ error: '获取公共题库题目失败' });
  }
});

// 获取公共题库详情
router.get('/public/:id', authenticateToken, async (req, res) => {
  try {
    const deckId = req.params.id;
    
    const [deckRows] = await pool.query(
      `SELECT d.*, u.username as author_name, u.nickname as author_nickname
       FROM decks d
       LEFT JOIN users u ON d.user_id = u.id
       WHERE d.id = ? AND d.is_public = 1`,
      [deckId]
    );
    
    if (deckRows.length === 0) {
      return res.status(404).json({ error: '公共题库不存在' });
    }
    
    const deck = deckRows[0];
    
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as count FROM questions WHERE deck_id = ?',
      [deckId]
    );
    
    res.json({
      id: deck.id,
      name: deck.name,
      description: deck.description,
      authorId: deck.user_id,
      authorName: deck.author_nickname || deck.author_name || '匿名',
      questionCount: countResult[0].count,
      createdAt: deck.created_at,
      updatedAt: deck.updated_at
    });
  } catch (error) {
    console.error('获取公共题库详情失败:', error);
    res.status(500).json({ error: '获取公共题库详情失败' });
  }
});

// 导入公共题库到用户自己的题库
router.post('/public/:id/import', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.userId;
    const sourceDeckId = req.params.id;
    
    const [sourceDecks] = await connection.query(
      'SELECT * FROM decks WHERE id = ? AND is_public = 1',
      [sourceDeckId]
    );
    
    if (sourceDecks.length === 0) {
      return res.status(404).json({ error: '公共题库不存在' });
    }
    
    const sourceDeck = sourceDecks[0];
    
    await connection.beginTransaction();
    
    const newDeckId = uuidv4();
    const now = Date.now();
    
    await connection.query(
      `INSERT INTO decks (id, user_id, name, description, is_public, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [newDeckId, userId, sourceDeck.name, sourceDeck.description, now, now]
    );
    
    const [questions] = await connection.query(
      'SELECT * FROM questions WHERE deck_id = ?',
      [sourceDeckId]
    );
    
    let importedCount = 0;
    
    for (const q of questions) {
      const newQuestionId = uuidv4();
      const newCardId = uuidv4();
      
      // JSON 字段需要序列化 - 确保是有效的 JSON 字符串
      const options = typeof q.options === 'string' ? q.options : JSON.stringify(q.options || []);
      // correct_answer 可能是字符串如 "A" 或数组如 ["A","B"]，都需要包装成 JSON
      let correctAnswer = q.correct_answer;
      if (typeof correctAnswer === 'string') {
        // 检查是否已经是 JSON 字符串
        try {
          JSON.parse(correctAnswer);
        } catch {
          // 不是有效 JSON，包装成 JSON 字符串
          correctAnswer = JSON.stringify(correctAnswer);
        }
      } else {
        correctAnswer = JSON.stringify(correctAnswer || '');
      }
      const tags = typeof q.tags === 'string' ? q.tags : JSON.stringify(q.tags || []);
      
      await connection.query(
        `INSERT INTO questions (id, deck_id, content, type, options, correct_answer, explanation, tags, difficulty, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newQuestionId, newDeckId, q.content, q.type, options, correctAnswer, q.explanation || '', tags, q.difficulty || 3, now, now]
      );
      
      await connection.query(
        `INSERT INTO cards (id, user_id, deck_id, question_id, state, due, stability, difficulty_factor, elapsed_days, scheduled_days, reps, lapses, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'new', ?, 0, 0, 0, 0, 0, 0, ?, ?)`,
        [newCardId, userId, newDeckId, newQuestionId, now, now, now]
      );
      
      importedCount++;
    }
    
    await connection.commit();
    
    res.status(201).json({
      success: true,
      deckId: newDeckId,
      deckName: sourceDeck.name,
      importedCount
    });
  } catch (error) {
    await connection.rollback();
    console.error('导入公共题库失败:', error.message, error.stack);
    res.status(500).json({ error: '导入公共题库失败: ' + error.message });
  } finally {
    connection.release();
  }
});

// ============ 用户题库 API ============

// 获取所有题库（仅当前用户的）
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [rows] = await pool.query(
      'SELECT * FROM decks WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    
    const decks = rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isPublic: !!row.is_public,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(decks);
  } catch (error) {
    console.error('获取题库失败:', error);
    res.status(500).json({ error: '获取题库失败' });
  }
});

// 创建题库（关联当前用户）
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, description = '' } = req.body;
    const id = uuidv4();
    const now = Date.now();
    
    await pool.query(
      'INSERT INTO decks (id, user_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, name, description, now, now]
    );
    
    res.status(201).json({
      id,
      name,
      description,
      createdAt: now,
      updatedAt: now
    });
  } catch (error) {
    console.error('创建题库失败:', error);
    res.status(500).json({ error: '创建题库失败' });
  }
});

// 获取单个题库（验证所有权）
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [rows] = await pool.query(
      'SELECT * FROM decks WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '题库不存在' });
    }
    
    const row = rows[0];
    res.json({
      id: row.id,
      name: row.name,
      description: row.description,
      isPublic: !!row.is_public,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('获取题库失败:', error);
    res.status(500).json({ error: '获取题库失败' });
  }
});

// 更新题库（验证所有权）
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, description } = req.body;
    const now = Date.now();
    
    const [result] = await pool.query(
      'UPDATE decks SET name = ?, description = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [name, description, now, req.params.id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '题库不存在或无权限' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('更新题库失败:', error);
    res.status(500).json({ error: '更新题库失败' });
  }
});

// 将自己的题库设为公共/私有
router.patch('/:id/public', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deckId = req.params.id;
    const { isPublic } = req.body;
    
    const [result] = await pool.query(
      'UPDATE decks SET is_public = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [isPublic, Date.now(), deckId, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '题库不存在或无权限' });
    }
    
    res.json({ success: true, isPublic });
  } catch (error) {
    console.error('更新题库公开状态失败:', error);
    res.status(500).json({ error: '更新题库公开状态失败' });
  }
});

// 删除题库（验证所有权）
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [result] = await pool.query(
      'DELETE FROM decks WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '题库不存在或无权限' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除题库失败:', error);
    res.status(500).json({ error: '删除题库失败' });
  }
});

// 获取题库统计（验证所有权）
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deckId = req.params.id;
    const now = Date.now();
    
    const [deckCheck] = await pool.query(
      'SELECT id FROM decks WHERE id = ? AND user_id = ?',
      [deckId, userId]
    );
    if (deckCheck.length === 0) {
      return res.status(404).json({ error: '题库不存在或无权限' });
    }
    
    // 获取题目总数
    const [totalResult] = await pool.query(
      'SELECT COUNT(*) as total FROM questions WHERE deck_id = ?',
      [deckId]
    );
    const total = totalResult[0].total;
    
    // 获取所有卡片数据进行统计
    const [cards] = await pool.query(
      'SELECT question_id, state, due, reps, lapses FROM cards WHERE deck_id = ? AND user_id = ?',
      [deckId, userId]
    );
    
    // 创建卡片映射
    const cardMap = new Map();
    cards.forEach(c => cardMap.set(c.question_id, c));
    
    // 获取所有题目ID
    const [questions] = await pool.query(
      'SELECT id FROM questions WHERE deck_id = ?',
      [deckId]
    );
    
    let newCount = 0;
    let learningCount = 0;
    let reviewCount = 0;
    let masteredCount = 0;
    let dueCount = 0;
    
    questions.forEach(q => {
      const card = cardMap.get(q.id);
      
      if (!card || card.state === 'new') {
        // 没有卡片或新题
        newCount++;
        dueCount++;
      } else if (card.state === 'learning' || card.state === 'relearning') {
        learningCount++;
        if (card.due <= now) dueCount++;
      } else if (card.state === 'review') {
        const isDue = card.due <= now;
        if (isDue) {
          // 待复习
          reviewCount++;
          dueCount++;
        } else {
          // 检查是否已掌握（复习次数 >= 10 且正确率 >= 90%）
          const reps = card.reps || 0;
          const lapses = card.lapses || 0;
          const totalAttempts = reps + lapses;
          const accuracy = totalAttempts > 0 ? reps / totalAttempts : 0;
          if (reps >= 10 && accuracy >= 0.9) {
            masteredCount++;
          } else {
            learningCount++;
          }
        }
      }
    });
    
    res.json({
      total,
      due: dueCount,
      new: newCount,
      learning: learningCount,
      review: reviewCount,
      mastered: masteredCount
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({ error: '获取统计失败' });
  }
});

module.exports = router;
