/**
 * 学习卡片 API 路由
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

// 获取题库的所有卡片（验证所有权）
router.get('/deck/:deckId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deckId = req.params.deckId;
    
    // 验证题库所有权
    if (!await verifyDeckOwnership(deckId, userId)) {
      return res.status(404).json({ error: '题库不存在或无权限' });
    }
    
    const [rows] = await pool.query(
      'SELECT * FROM cards WHERE deck_id = ?',
      [deckId]
    );
    
    const cards = rows.map(row => ({
      id: row.id,
      deckId: row.deck_id,
      questionId: row.question_id,
      state: row.state,
      due: row.due,
      stability: row.stability,
      difficulty: row.difficulty_factor,
      elapsedDays: row.elapsed_days,
      scheduledDays: row.scheduled_days,
      reps: row.reps,
      lapses: row.lapses,
      lastReview: row.last_review,
      errorCount: row.error_count,
      correctCount: row.correct_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(cards);
  } catch (error) {
    console.error('获取卡片失败:', error);
    res.status(500).json({ error: '获取卡片失败' });
  }
});

// 获取到期卡片（验证所有权）
router.get('/deck/:deckId/due', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deckId = req.params.deckId;
    const { limit = 50 } = req.query;
    const now = Date.now();
    
    // 验证题库所有权
    if (!await verifyDeckOwnership(deckId, userId)) {
      return res.status(404).json({ error: '题库不存在或无权限' });
    }
    
    const [rows] = await pool.query(
      `SELECT c.*, q.content, q.type, q.options, q.correct_answer, q.explanation, q.tags, q.difficulty as question_difficulty
       FROM cards c 
       JOIN questions q ON c.question_id = q.id 
       WHERE c.deck_id = ? AND c.state != 'new' AND c.due <= ?
       ORDER BY c.due ASC
       LIMIT ?`,
      [deckId, now, parseInt(limit)]
    );
    
    const cards = rows.map(row => ({
      id: row.id,
      deckId: row.deck_id,
      questionId: row.question_id,
      state: row.state,
      due: row.due,
      stability: row.stability,
      difficulty: row.difficulty_factor,
      elapsedDays: row.elapsed_days,
      scheduledDays: row.scheduled_days,
      reps: row.reps,
      lapses: row.lapses,
      lastReview: row.last_review,
      errorCount: row.error_count,
      correctCount: row.correct_count,
      question: {
        id: row.question_id,
        content: row.content,
        type: row.type,
        options: safeJsonParse(row.options, []),
        correctAnswer: safeJsonParse(row.correct_answer, '', true),
        explanation: row.explanation,
        tags: safeJsonParse(row.tags, []),
        difficulty: row.question_difficulty
      }
    }));
    
    res.json(cards);
  } catch (error) {
    console.error('获取到期卡片失败:', error);
    res.status(500).json({ error: '获取到期卡片失败' });
  }
});

// 获取新卡片（验证所有权）
router.get('/deck/:deckId/new', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deckId = req.params.deckId;
    const { limit = 20 } = req.query;
    
    // 验证题库所有权
    if (!await verifyDeckOwnership(deckId, userId)) {
      return res.status(404).json({ error: '题库不存在或无权限' });
    }
    
    const [rows] = await pool.query(
      `SELECT c.*, q.content, q.type, q.options, q.correct_answer, q.explanation, q.tags, q.difficulty as question_difficulty
       FROM cards c 
       JOIN questions q ON c.question_id = q.id 
       WHERE c.deck_id = ? AND c.state = 'new'
       ORDER BY c.created_at ASC
       LIMIT ?`,
      [deckId, parseInt(limit)]
    );
    
    const cards = rows.map(row => ({
      id: row.id,
      deckId: row.deck_id,
      questionId: row.question_id,
      state: row.state,
      due: row.due,
      stability: row.stability,
      difficulty: row.difficulty_factor,
      errorCount: row.error_count,
      correctCount: row.correct_count,
      question: {
        id: row.question_id,
        content: row.content,
        type: row.type,
        options: safeJsonParse(row.options, []),
        correctAnswer: safeJsonParse(row.correct_answer, '', true),
        explanation: row.explanation,
        tags: safeJsonParse(row.tags, []),
        difficulty: row.question_difficulty
      }
    }));
    
    res.json(cards);
  } catch (error) {
    console.error('获取新卡片失败:', error);
    res.status(500).json({ error: '获取新卡片失败' });
  }
});

// 更新卡片 (复习后，验证所有权)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      state,
      due,
      stability,
      difficulty,
      elapsedDays,
      scheduledDays,
      reps,
      lapses,
      lastReview,
      errorCount,
      correctCount
    } = req.body;
    const now = Date.now();
    
    // 验证卡片所有权（通过题库）
    const [cardCheck] = await pool.query(
      `SELECT c.id FROM cards c
       JOIN decks d ON c.deck_id = d.id
       WHERE c.id = ? AND d.user_id = ?`,
      [req.params.id, userId]
    );
    if (cardCheck.length === 0) {
      return res.status(404).json({ error: '卡片不存在或无权限' });
    }
    
    await pool.query(
      `UPDATE cards SET 
        state = ?, due = ?, stability = ?, difficulty_factor = ?,
        elapsed_days = ?, scheduled_days = ?, reps = ?, lapses = ?,
        last_review = ?, error_count = ?, correct_count = ?, updated_at = ?
       WHERE id = ?`,
      [
        state, due, stability, difficulty,
        elapsedDays, scheduledDays, reps, lapses,
        lastReview, errorCount, correctCount, now,
        req.params.id
      ]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('更新卡片失败:', error);
    res.status(500).json({ error: '更新卡片失败' });
  }
});

// 记录复习日志
router.post('/review-log', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      cardId,
      deckId,
      rating,
      state,
      due,
      stability,
      difficulty,
      elapsedDays,
      lastElapsedDays,
      scheduledDays,
      reviewDuration
    } = req.body;
    
    const id = uuidv4();
    const reviewTime = Date.now();
    
    await pool.query(
      `INSERT INTO review_logs (id, user_id, card_id, deck_id, rating, state, due, stability, difficulty_factor, 
        elapsed_days, last_elapsed_days, scheduled_days, review_time, review_duration)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, userId, cardId, deckId, rating, state, due, stability, difficulty,
        elapsedDays, lastElapsedDays, scheduledDays, reviewTime, reviewDuration || 0
      ]
    );
    
    res.status(201).json({ id, reviewTime });
  } catch (error) {
    console.error('记录复习日志失败:', error);
    res.status(500).json({ error: '记录复习日志失败' });
  }
});

// 获取卡片详情（带题目信息，验证所有权）
router.get('/:id/detail', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [rows] = await pool.query(
      `SELECT c.*, q.content, q.type, q.options, q.correct_answer, q.explanation, q.tags, q.difficulty as question_difficulty
       FROM cards c 
       JOIN questions q ON c.question_id = q.id
       JOIN decks d ON c.deck_id = d.id
       WHERE c.id = ? AND d.user_id = ?`,
      [req.params.id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '卡片不存在' });
    }
    
    const row = rows[0];
    res.json({
      id: row.id,
      deckId: row.deck_id,
      questionId: row.question_id,
      state: row.state,
      due: row.due,
      stability: row.stability,
      difficulty: row.difficulty_factor,
      elapsedDays: row.elapsed_days,
      scheduledDays: row.scheduled_days,
      reps: row.reps,
      lapses: row.lapses,
      lastReview: row.last_review,
      errorCount: row.error_count,
      correctCount: row.correct_count,
      question: {
        id: row.question_id,
        content: row.content,
        type: row.type,
        options: JSON.parse(row.options || '[]'),
        correctAnswer: JSON.parse(row.correct_answer || '""'),
        explanation: row.explanation,
        tags: JSON.parse(row.tags || '[]'),
        difficulty: row.question_difficulty
      }
    });
  } catch (error) {
    console.error('获取卡片详情失败:', error);
    res.status(500).json({ error: '获取卡片详情失败' });
  }
});

// 按题目ID删除卡片（验证所有权）
router.delete('/question/:questionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 验证题目所有权（通过题库）
    const [result] = await pool.query(
      `DELETE c FROM cards c
       JOIN decks d ON c.deck_id = d.id
       WHERE c.question_id = ? AND d.user_id = ?`,
      [req.params.questionId, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除卡片失败:', error);
    res.status(500).json({ error: '删除卡片失败' });
  }
});

module.exports = router;
