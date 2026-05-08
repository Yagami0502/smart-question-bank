/**
 * 笔记 API 路由
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// 获取题目的笔记（验证所有权）
router.get('/question/:questionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [rows] = await pool.query(
      'SELECT * FROM notes WHERE question_id = ? AND user_id = ?',
      [req.params.questionId, userId]
    );
    
    if (rows.length === 0) {
      return res.json(null);
    }
    
    const row = rows[0];
    res.json({
      id: row.id,
      questionId: row.question_id,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('获取笔记失败:', error);
    res.status(500).json({ error: '获取笔记失败' });
  }
});

// 获取所有笔记（仅当前用户）
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [rows] = await pool.query(
      `SELECT n.*, q.content as question_content, q.deck_id
       FROM notes n
       JOIN questions q ON n.question_id = q.id
       WHERE n.user_id = ?
       ORDER BY n.updated_at DESC`,
      [userId]
    );
    
    const notes = rows.map(row => ({
      id: row.id,
      questionId: row.question_id,
      deckId: row.deck_id,
      content: row.content,
      questionContent: row.question_content,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(notes);
  } catch (error) {
    console.error('获取笔记列表失败:', error);
    res.status(500).json({ error: '获取笔记列表失败' });
  }
});

// 创建或更新笔记（验证所有权）
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { questionId, content } = req.body;
    
    const now = Date.now();
    
    // 检查是否已存在（同一用户对同一题目）
    const [existing] = await pool.query(
      'SELECT id FROM notes WHERE question_id = ? AND user_id = ?',
      [questionId, userId]
    );
    
    if (existing.length > 0) {
      // 更新
      await pool.query(
        'UPDATE notes SET content = ?, updated_at = ? WHERE question_id = ? AND user_id = ?',
        [content, now, questionId, userId]
      );
      res.json({ id: existing[0].id, updated: true });
    } else {
      // 创建
      const id = uuidv4();
      await pool.query(
        'INSERT INTO notes (id, user_id, question_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, userId, questionId, content, now, now]
      );
      res.status(201).json({ id, updated: false });
    }
  } catch (error) {
    console.error('保存笔记失败:', error);
    res.status(500).json({ error: '保存笔记失败' });
  }
});

// 删除笔记（验证所有权）
router.delete('/question/:questionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await pool.query(
      'DELETE FROM notes WHERE question_id = ? AND user_id = ?',
      [req.params.questionId, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除笔记失败:', error);
    res.status(500).json({ error: '删除笔记失败' });
  }
});

module.exports = router;
