/**
 * 成就 API 路由
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// 获取所有已解锁成就（仅当前用户）
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [rows] = await pool.query(
      'SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC',
      [userId]
    );
    
    const achievements = rows.map(row => ({
      id: row.id,
      achievementId: row.achievement_id,
      unlockedAt: row.unlocked_at
    }));
    
    res.json(achievements);
  } catch (error) {
    console.error('获取成就失败:', error);
    res.status(500).json({ error: '获取成就失败' });
  }
});

// 检查成就是否已解锁（仅当前用户）
router.get('/check/:achievementId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [rows] = await pool.query(
      'SELECT id FROM achievements WHERE achievement_id = ? AND user_id = ?',
      [req.params.achievementId, userId]
    );
    res.json({ unlocked: rows.length > 0 });
  } catch (error) {
    console.error('检查成就失败:', error);
    res.status(500).json({ error: '检查成就失败' });
  }
});

// 解锁成就（关联当前用户）
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { achievementId } = req.body;
    
    // 检查是否已解锁
    const [existing] = await pool.query(
      'SELECT id FROM achievements WHERE achievement_id = ? AND user_id = ?',
      [achievementId, userId]
    );
    
    if (existing.length > 0) {
      return res.json({ id: existing[0].id, alreadyUnlocked: true });
    }
    
    const id = uuidv4();
    const now = Date.now();
    
    await pool.query(
      'INSERT INTO achievements (id, user_id, achievement_id, unlocked_at) VALUES (?, ?, ?, ?)',
      [id, userId, achievementId, now]
    );
    
    res.status(201).json({ id, alreadyUnlocked: false });
  } catch (error) {
    console.error('解锁成就失败:', error);
    res.status(500).json({ error: '解锁成就失败' });
  }
});

// 重置所有成就（仅当前用户，用于测试）
router.delete('/reset', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await pool.query('DELETE FROM achievements WHERE user_id = ?', [userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('重置成就失败:', error);
    res.status(500).json({ error: '重置成就失败' });
  }
});

module.exports = router;
