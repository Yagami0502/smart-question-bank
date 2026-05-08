/**
 * 学习计划 API 路由
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

// 获取所有学习计划（仅当前用户）
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [rows] = await pool.query(
      'SELECT * FROM study_plans WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    
    const plans = rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      targetQuestions: row.target_questions,
      completedQuestions: row.completed_questions,
      startDate: row.start_date,
      endDate: row.end_date,
      priority: row.priority,
      status: row.status,
      deckIds: safeJsonParse(row.deck_ids, []),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(plans);
  } catch (error) {
    console.error('获取学习计划失败:', error);
    res.status(500).json({ error: '获取学习计划失败' });
  }
});

// 获取单个学习计划（验证所有权）
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [rows] = await pool.query(
      'SELECT * FROM study_plans WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '学习计划不存在' });
    }
    
    const row = rows[0];
    res.json({
      id: row.id,
      name: row.name,
      description: row.description,
      targetQuestions: row.target_questions,
      completedQuestions: row.completed_questions,
      startDate: row.start_date,
      endDate: row.end_date,
      priority: row.priority,
      status: row.status,
      deckIds: safeJsonParse(row.deck_ids, []),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('获取学习计划失败:', error);
    res.status(500).json({ error: '获取学习计划失败' });
  }
});

// 创建学习计划（关联当前用户）
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, description, targetQuestions, startDate, endDate, priority, deckIds } = req.body;
    const id = uuidv4();
    const now = Date.now();
    
    await pool.query(
      `INSERT INTO study_plans 
        (id, user_id, name, description, target_questions, completed_questions, start_date, end_date, priority, status, deck_ids, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 'active', ?, ?, ?)`,
      [id, userId, name, description || '', targetQuestions || 0, startDate, endDate, priority || 'medium', JSON.stringify(deckIds || []), now, now]
    );
    
    res.status(201).json({ id });
  } catch (error) {
    console.error('创建学习计划失败:', error);
    res.status(500).json({ error: '创建学习计划失败' });
  }
});

// 更新学习计划（验证所有权）
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, description, targetQuestions, completedQuestions, startDate, endDate, priority, status, deckIds } = req.body;
    const now = Date.now();
    
    const [result] = await pool.query(
      `UPDATE study_plans SET 
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        target_questions = COALESCE(?, target_questions),
        completed_questions = COALESCE(?, completed_questions),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        priority = COALESCE(?, priority),
        status = COALESCE(?, status),
        deck_ids = COALESCE(?, deck_ids),
        updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [name, description, targetQuestions, completedQuestions, startDate, endDate, priority, status, deckIds ? JSON.stringify(deckIds) : null, now, req.params.id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '学习计划不存在或无权限' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('更新学习计划失败:', error);
    res.status(500).json({ error: '更新学习计划失败' });
  }
});

// 更新完成进度（验证所有权）
router.patch('/:id/progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { increment = 1 } = req.body;
    const now = Date.now();
    
    const [result] = await pool.query(
      `UPDATE study_plans SET 
        completed_questions = completed_questions + ?,
        updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [increment, now, req.params.id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '学习计划不存在或无权限' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('更新进度失败:', error);
    res.status(500).json({ error: '更新进度失败' });
  }
});

// 删除学习计划（验证所有权）
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [result] = await pool.query(
      'DELETE FROM study_plans WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '学习计划不存在或无权限' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除学习计划失败:', error);
    res.status(500).json({ error: '删除学习计划失败' });
  }
});

module.exports = router;
