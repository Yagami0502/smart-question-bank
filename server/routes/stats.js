/**
 * 统计 API 路由
 * 所有统计数据都按用户隔离
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// 获取整体统计（按用户隔离）
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 总题目数（用户的题库中的题目）
    const [totalQuestions] = await pool.query(
      `SELECT COUNT(*) as count FROM questions q 
       JOIN decks d ON q.deck_id = d.id 
       WHERE d.user_id = ?`,
      [userId]
    );
    
    // 总题库数
    const [totalDecks] = await pool.query(
      'SELECT COUNT(*) as count FROM decks WHERE user_id = ?',
      [userId]
    );
    
    // 已学习卡片数
    const [learnedCards] = await pool.query(
      `SELECT COUNT(*) as count FROM cards WHERE user_id = ? AND state != 'new'`,
      [userId]
    );
    
    // 今日复习数和今日学习时长
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [todayStats] = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(review_duration), 0) as duration 
       FROM review_logs
       WHERE user_id = ? AND review_time >= ?`,
      [userId, todayStart.getTime()]
    );
    
    // 总复习次数和总学习时长
    const [totalStats] = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(review_duration), 0) as duration 
       FROM review_logs WHERE user_id = ?`,
      [userId]
    );
    
    // 正确率
    const [correctStats] = await pool.query(
      `SELECT COUNT(*) as count FROM review_logs
       WHERE user_id = ? AND rating IN ('good', 'easy')`,
      [userId]
    );
    
    const accuracy = totalStats[0].count > 0 
      ? (correctStats[0].count / totalStats[0].count * 100).toFixed(1)
      : 0;
    
    res.json({
      totalQuestions: totalQuestions[0].count,
      totalDecks: totalDecks[0].count,
      learnedCards: learnedCards[0].count,
      todayReviews: todayStats[0].count,
      todayDuration: Math.round(todayStats[0].duration / 1000 / 60),
      totalReviews: totalStats[0].count,
      totalDuration: Math.round(totalStats[0].duration / 1000 / 60),
      accuracy: parseFloat(accuracy)
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({ error: '获取统计失败' });
  }
});

// 获取每日学习统计（按用户隔离）
router.get('/daily', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);
    
    const [rows] = await pool.query(
      `SELECT 
        DATE(FROM_UNIXTIME(review_time / 1000)) as date,
        COUNT(*) as reviews,
        SUM(CASE WHEN rating IN ('good', 'easy') THEN 1 ELSE 0 END) as correct
       FROM review_logs
       WHERE user_id = ? AND review_time >= ?
       GROUP BY DATE(FROM_UNIXTIME(review_time / 1000))
       ORDER BY date ASC`,
      [userId, startDate.getTime()]
    );
    
    res.json(rows.map(row => ({
      date: row.date,
      reviews: row.reviews,
      correct: row.correct,
      accuracy: row.reviews > 0 ? (row.correct / row.reviews * 100).toFixed(1) : 0
    })));
  } catch (error) {
    console.error('获取每日统计失败:', error);
    res.status(500).json({ error: '获取每日统计失败' });
  }
});

// 获取题库统计（验证题库所有权）
router.get('/deck/:deckId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deckId = req.params.deckId;
    const now = Date.now();
    
    // 验证题库所有权
    const [deckCheck] = await pool.query(
      'SELECT id FROM decks WHERE id = ? AND user_id = ?',
      [deckId, userId]
    );
    
    if (deckCheck.length === 0) {
      return res.status(404).json({ error: '题库不存在或无权访问' });
    }
    
    // 各状态卡片数
    const [stateStats] = await pool.query(
      `SELECT state, COUNT(*) as count FROM cards WHERE deck_id = ? GROUP BY state`,
      [deckId]
    );
    
    // 到期卡片数
    const [dueCards] = await pool.query(
      "SELECT COUNT(*) as count FROM cards WHERE deck_id = ? AND ((state != 'new' AND due <= ?) OR state = 'new')",
      [deckId, now]
    );
    
    // 错误率最高的题目
    const [difficultCards] = await pool.query(
      `SELECT c.*, q.content, q.tags
       FROM cards c
       JOIN questions q ON c.question_id = q.id
       WHERE c.deck_id = ? AND (c.error_count + c.correct_count) > 0
       ORDER BY (c.error_count / (c.error_count + c.correct_count)) DESC
       LIMIT 10`,
      [deckId]
    );
    
    const stats = {
      new: 0,
      learning: 0,
      review: 0,
      relearning: 0
    };
    
    stateStats.forEach(row => {
      stats[row.state] = row.count;
    });
    
    res.json({
      stateStats: stats,
      dueCount: dueCards[0].count,
      difficultCards: difficultCards.map(row => ({
        id: row.id,
        questionId: row.question_id,
        content: row.content,
        tags: JSON.parse(row.tags || '[]'),
        errorCount: row.error_count,
        correctCount: row.correct_count,
        errorRate: ((row.error_count / (row.error_count + row.correct_count)) * 100).toFixed(1)
      }))
    });
  } catch (error) {
    console.error('获取题库统计失败:', error);
    res.status(500).json({ error: '获取题库统计失败' });
  }
});

// 获取学习连续天数（按用户隔离）
router.get('/streak', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [rows] = await pool.query(
      `SELECT DISTINCT DATE(FROM_UNIXTIME(review_time / 1000)) as date
       FROM review_logs
       WHERE user_id = ?
       ORDER BY date DESC
       LIMIT 365`,
      [userId]
    );
    
    if (rows.length === 0) {
      return res.json({ streak: 0, totalDays: 0 });
    }
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dates = rows.map(r => new Date(r.date).getTime());
    
    // 检查今天或昨天是否有学习
    const todayTime = today.getTime();
    const yesterdayTime = todayTime - 86400000;
    
    if (dates[0] !== todayTime && dates[0] !== yesterdayTime) {
      return res.json({ streak: 0, totalDays: rows.length });
    }
    
    // 计算连续天数
    let currentDate = dates[0];
    for (let i = 0; i < dates.length; i++) {
      if (dates[i] === currentDate) {
        streak++;
        currentDate -= 86400000;
      } else if (dates[i] < currentDate) {
        break;
      }
    }
    
    res.json({ streak, totalDays: rows.length });
  } catch (error) {
    console.error('获取连续天数失败:', error);
    res.status(500).json({ error: '获取连续天数失败' });
  }
});

module.exports = router;
