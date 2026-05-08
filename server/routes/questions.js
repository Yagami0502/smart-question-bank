/**
 * 题目 API 路由
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// 安全解析 JSON（如果解析失败，返回原字符串而非默认值）
function safeJsonParse(str, defaultValue = null, returnOriginalOnFail = false) {
  if (str === null || str === undefined) return defaultValue;
  if (typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch {
    return returnOriginalOnFail ? str : defaultValue;
  }
}

// 验证用户对题库的所有权
async function verifyDeckOwnership(deckId, userId) {
  const [rows] = await pool.query(
    'SELECT id FROM decks WHERE id = ? AND user_id = ?',
    [deckId, userId]
  );
  return rows.length > 0;
}

// 获取题库的所有题目（验证所有权）
router.get('/deck/:deckId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deckId = req.params.deckId;
    
    // 验证题库所有权
    if (!await verifyDeckOwnership(deckId, userId)) {
      return res.status(404).json({ error: '题库不存在或无权限' });
    }
    
    const [rows] = await pool.query(
      'SELECT * FROM questions WHERE deck_id = ? ORDER BY created_at DESC',
      [deckId]
    );
    
    const questions = rows.map(row => ({
      id: row.id,
      deckId: row.deck_id,
      content: row.content,
      type: row.type,
      options: safeJsonParse(row.options, []),
      correctAnswer: safeJsonParse(row.correct_answer, '', true),
      explanation: row.explanation,
      tags: safeJsonParse(row.tags, []),
      difficulty: row.difficulty,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(questions);
  } catch (error) {
    console.error('获取题目失败:', error);
    res.status(500).json({ error: '获取题目失败' });
  }
});

// 获取单个题目（验证所有权）
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [rows] = await pool.query(
      `SELECT q.* FROM questions q
       JOIN decks d ON q.deck_id = d.id
       WHERE q.id = ? AND d.user_id = ?`,
      [req.params.id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '题目不存在' });
    }
    
    const row = rows[0];
    res.json({
      id: row.id,
      deckId: row.deck_id,
      content: row.content,
      type: row.type,
      options: safeJsonParse(row.options, []),
      correctAnswer: safeJsonParse(row.correct_answer, '', true),
      explanation: row.explanation,
      tags: safeJsonParse(row.tags, []),
      difficulty: row.difficulty,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('获取题目失败:', error);
    res.status(500).json({ error: '获取题目失败' });
  }
});

// 批量创建题目（验证所有权）
router.post('/batch', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.userId;
    const { deckId, questions } = req.body;
    
    // 验证题库所有权
    if (!await verifyDeckOwnership(deckId, userId)) {
      return res.status(404).json({ error: '题库不存在或无权限' });
    }
    
    await connection.beginTransaction();
    
    const now = Date.now();
    const createdQuestions = [];
    const createdCards = [];
    
    for (const q of questions) {
      const questionId = uuidv4();
      const cardId = uuidv4();
      
      // 处理 content 字段 - 可能是对象 {text: ...} 或字符串
      const contentText = typeof q.content === 'object' ? (q.content.text || JSON.stringify(q.content)) : q.content;
      
      // 插入题目
      await connection.query(
        `INSERT INTO questions (id, deck_id, content, type, options, correct_answer, explanation, tags, difficulty, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          questionId,
          deckId,
          contentText,
          q.type || 'MCQ',
          JSON.stringify(q.options || []),
          JSON.stringify(q.correctAnswer || ''),
          q.explanation || '',
          JSON.stringify(q.tags || []),
          q.difficulty || 3,
          now,
          now
        ]
      );
      
      // 插入学习卡片
      await connection.query(
        `INSERT INTO cards (id, user_id, deck_id, question_id, state, due, created_at, updated_at) 
         VALUES (?, ?, ?, ?, 'new', ?, ?, ?)`,
        [cardId, userId, deckId, questionId, now, now, now]
      );
      
      createdQuestions.push({
        id: questionId,
        deckId,
        content: q.content,
        type: q.type || 'MCQ',
        options: q.options || [],
        correctAnswer: q.correctAnswer || '',
        explanation: q.explanation || '',
        tags: q.tags || [],
        difficulty: q.difficulty || 3,
        createdAt: now,
        updatedAt: now
      });
      
      createdCards.push({
        id: cardId,
        deckId,
        questionId,
        state: 'new',
        due: now,
        createdAt: now,
        updatedAt: now
      });
    }
    
    await connection.commit();
    res.status(201).json({ questions: createdQuestions, cards: createdCards });
  } catch (error) {
    await connection.rollback();
    console.error('批量创建题目失败:', error);
    res.status(500).json({ error: '批量创建题目失败' });
  } finally {
    connection.release();
  }
});

// 创建单个题目（验证所有权）
router.post('/', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.userId;
    const { deckId, content, type, options, correctAnswer, explanation, tags, difficulty } = req.body;
    
    // 验证题库所有权
    if (!await verifyDeckOwnership(deckId, userId)) {
      return res.status(404).json({ error: '题库不存在或无权限' });
    }
    
    await connection.beginTransaction();
    
    const questionId = uuidv4();
    const cardId = uuidv4();
    const now = Date.now();
    
    // 处理 content 字段 - 可能是对象 {text: ...} 或字符串
    const contentText = typeof content === 'object' ? (content.text || JSON.stringify(content)) : content;
    
    // 插入题目
    await connection.query(
      `INSERT INTO questions (id, deck_id, content, type, options, correct_answer, explanation, tags, difficulty, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        questionId,
        deckId,
        contentText,
        type || 'MCQ',
        JSON.stringify(options || []),
        JSON.stringify(correctAnswer || ''),
        explanation || '',
        JSON.stringify(tags || []),
        difficulty || 3,
        now,
        now
      ]
    );
    
    // 插入学习卡片
    await connection.query(
      `INSERT INTO cards (id, user_id, deck_id, question_id, state, due, created_at, updated_at) 
       VALUES (?, ?, ?, ?, 'new', ?, ?, ?)`,
      [cardId, userId, deckId, questionId, now, now, now]
    );
    
    await connection.commit();
    
    res.status(201).json({
      question: {
        id: questionId,
        deckId,
        content,
        type: type || 'MCQ',
        options: options || [],
        correctAnswer: correctAnswer || '',
        explanation: explanation || '',
        tags: tags || [],
        difficulty: difficulty || 3,
        createdAt: now,
        updatedAt: now
      },
      card: {
        id: cardId,
        deckId,
        questionId,
        state: 'new',
        due: now,
        createdAt: now,
        updatedAt: now
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('创建题目失败:', error);
    res.status(500).json({ error: '创建题目失败' });
  } finally {
    connection.release();
  }
});

// 更新题目（验证所有权）
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { content, type, options, correctAnswer, explanation, tags, difficulty } = req.body;
    const now = Date.now();
    
    // 验证题目所有权（通过题库）
    const [questionCheck] = await pool.query(
      `SELECT q.id FROM questions q
       JOIN decks d ON q.deck_id = d.id
       WHERE q.id = ? AND d.user_id = ?`,
      [req.params.id, userId]
    );
    if (questionCheck.length === 0) {
      return res.status(404).json({ error: '题目不存在或无权限' });
    }
    
    await pool.query(
      `UPDATE questions SET content = ?, type = ?, options = ?, correct_answer = ?, 
       explanation = ?, tags = ?, difficulty = ?, updated_at = ? WHERE id = ?`,
      [
        content,
        type,
        JSON.stringify(options || []),
        JSON.stringify(correctAnswer || ''),
        explanation || '',
        JSON.stringify(tags || []),
        difficulty || 3,
        now,
        req.params.id
      ]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('更新题目失败:', error);
    res.status(500).json({ error: '更新题目失败' });
  }
});

// 删除题目（验证所有权）
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 验证题目所有权（通过题库）
    const [result] = await pool.query(
      `DELETE q FROM questions q
       JOIN decks d ON q.deck_id = d.id
       WHERE q.id = ? AND d.user_id = ?`,
      [req.params.id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '题目不存在或无权限' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除题目失败:', error);
    res.status(500).json({ error: '删除题目失败' });
  }
});

// 按标签搜索（仅搜索用户自己的题库）
router.get('/search/tags', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { deckId, tags } = req.query;
    const tagList = tags ? tags.split(',') : [];
    
    if (tagList.length === 0) {
      return res.json([]);
    }
    
    // 使用 JSON_CONTAINS 搜索标签，并验证题库所有权
    const placeholders = tagList.map(() => 'JSON_CONTAINS(q.tags, ?)').join(' OR ');
    const params = tagList.map(tag => JSON.stringify(tag));
    
    let query = `SELECT q.* FROM questions q
                 JOIN decks d ON q.deck_id = d.id
                 WHERE (${placeholders}) AND d.user_id = ?`;
    params.push(userId);
    
    if (deckId) {
      query += ' AND q.deck_id = ?';
      params.push(deckId);
    }
    
    query += ' ORDER BY q.created_at DESC';
    
    const [rows] = await pool.query(query, params);
    
    const questions = rows.map(row => ({
      id: row.id,
      deckId: row.deck_id,
      content: row.content,
      type: row.type,
      options: JSON.parse(row.options || '[]'),
      correctAnswer: JSON.parse(row.correct_answer || '""'),
      explanation: row.explanation,
      tags: JSON.parse(row.tags || '[]'),
      difficulty: row.difficulty,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(questions);
  } catch (error) {
    console.error('搜索题目失败:', error);
    res.status(500).json({ error: '搜索题目失败' });
  }
});

module.exports = router;
