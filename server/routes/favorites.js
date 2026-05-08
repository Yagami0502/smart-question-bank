/**
 * 收藏 API 路由
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// 安全解析 JSON
function safeJsonParse(str, defaultValue = null) {
  if (str === null || str === undefined) return defaultValue;
  if (typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

// 获取所有收藏（仅当前用户）
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [rows] = await pool.query(
      `SELECT f.*, q.content, q.type, q.options, q.tags, q.difficulty, d.name as deck_name
       FROM favorites f
       JOIN questions q ON f.question_id = q.id
       JOIN decks d ON f.deck_id = d.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [userId]
    );
    
    const favorites = rows.map(row => ({
      id: row.id,
      questionId: row.question_id,
      deckId: row.deck_id,
      deckName: row.deck_name,
      content: row.content,
      type: row.type,
      options: safeJsonParse(row.options, []),
      tags: safeJsonParse(row.tags, []),
      difficulty: row.difficulty,
      createdAt: row.created_at
    }));
    
    res.json(favorites);
  } catch (error) {
    console.error('获取收藏失败:', error);
    res.status(500).json({ error: '获取收藏失败' });
  }
});

// 获取题库的收藏（验证所有权）
router.get('/deck/:deckId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deckId = req.params.deckId;
    
    const [rows] = await pool.query(
      `SELECT f.*, q.content, q.type, q.options, q.tags, q.difficulty
       FROM favorites f
       JOIN questions q ON f.question_id = q.id
       WHERE f.deck_id = ? AND f.user_id = ?
       ORDER BY f.created_at DESC`,
      [deckId, userId]
    );
    
    const favorites = rows.map(row => ({
      id: row.id,
      questionId: row.question_id,
      deckId: row.deck_id,
      content: row.content,
      type: row.type,
      options: safeJsonParse(row.options, []),
      tags: safeJsonParse(row.tags, []),
      difficulty: row.difficulty,
      createdAt: row.created_at
    }));
    
    res.json(favorites);
  } catch (error) {
    console.error('获取收藏失败:', error);
    res.status(500).json({ error: '获取收藏失败' });
  }
});

// 检查是否已收藏（验证所有权）
router.get('/check/:questionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [rows] = await pool.query(
      'SELECT id FROM favorites WHERE question_id = ? AND user_id = ?',
      [req.params.questionId, userId]
    );
    res.json({ isFavorite: rows.length > 0 });
  } catch (error) {
    console.error('检查收藏失败:', error);
    res.status(500).json({ error: '检查收藏失败' });
  }
});

// 添加收藏（验证所有权）
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { questionId, deckId } = req.body;
    
    // 检查是否已存在（同一用户对同一题目）
    const [existing] = await pool.query(
      'SELECT id FROM favorites WHERE question_id = ? AND user_id = ?',
      [questionId, userId]
    );
    
    if (existing.length > 0) {
      return res.json({ id: existing[0].id, exists: true });
    }
    
    const id = uuidv4();
    const now = Date.now();
    
    await pool.query(
      'INSERT INTO favorites (id, user_id, question_id, deck_id, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, userId, questionId, deckId, now]
    );
    
    res.status(201).json({ id, exists: false });
  } catch (error) {
    console.error('添加收藏失败:', error);
    res.status(500).json({ error: '添加收藏失败' });
  }
});

// 删除收藏（按收藏ID，验证所有权）
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [result] = await pool.query(
      'DELETE FROM favorites WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '收藏不存在或无权限' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除收藏失败:', error);
    res.status(500).json({ error: '删除收藏失败' });
  }
});

// 删除收藏（按题目ID，验证所有权）
router.delete('/question/:questionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await pool.query(
      'DELETE FROM favorites WHERE question_id = ? AND user_id = ?',
      [req.params.questionId, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除收藏失败:', error);
    res.status(500).json({ error: '删除收藏失败' });
  }
});

module.exports = router;
