/**
 * 学习提醒 API 路由
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

// 获取所有提醒（仅当前用户）
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [rows] = await pool.query(
      'SELECT * FROM reminders WHERE user_id = ? ORDER BY time ASC',
      [userId]
    );
    
    const reminders = rows.map(row => ({
      id: row.id,
      time: row.time,
      days: safeJsonParse(row.days, []),
      message: row.message,
      enabled: Boolean(row.enabled),
      sound: Boolean(row.sound),
      createdAt: row.created_at
    }));
    
    res.json(reminders);
  } catch (error) {
    console.error('获取提醒失败:', error);
    res.status(500).json({ error: '获取提醒失败' });
  }
});

// 创建提醒（关联当前用户）
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { time, days, message, enabled = true, sound = true } = req.body;
    const id = uuidv4();
    const now = Date.now();
    
    await pool.query(
      'INSERT INTO reminders (id, user_id, time, days, message, enabled, sound, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, userId, time, JSON.stringify(days || []), message || '', enabled, sound, now]
    );
    
    res.status(201).json({ id });
  } catch (error) {
    console.error('创建提醒失败:', error);
    res.status(500).json({ error: '创建提醒失败' });
  }
});

// 更新提醒（验证所有权）
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { time, days, message, enabled, sound } = req.body;
    
    const [result] = await pool.query(
      `UPDATE reminders SET 
        time = COALESCE(?, time),
        days = COALESCE(?, days),
        message = COALESCE(?, message),
        enabled = COALESCE(?, enabled),
        sound = COALESCE(?, sound)
       WHERE id = ? AND user_id = ?`,
      [time, days ? JSON.stringify(days) : null, message, enabled, sound, req.params.id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '提醒不存在或无权限' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('更新提醒失败:', error);
    res.status(500).json({ error: '更新提醒失败' });
  }
});

// 切换提醒启用状态（验证所有权）
router.patch('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [result] = await pool.query(
      'UPDATE reminders SET enabled = NOT enabled WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '提醒不存在或无权限' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('切换提醒状态失败:', error);
    res.status(500).json({ error: '切换提醒状态失败' });
  }
});

// 删除提醒（验证所有权）
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [result] = await pool.query(
      'DELETE FROM reminders WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '提醒不存在或无权限' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除提醒失败:', error);
    res.status(500).json({ error: '删除提醒失败' });
  }
});

module.exports = router;
