/**
 * 错题本 API 路由
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

// 获取所有错题（跨题库，仅当前用户）
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [rows] = await pool.query(
      `SELECT wq.*, q.content, q.type, q.options, q.correct_answer, q.explanation, q.tags, q.difficulty, d.name as deck_name
       FROM wrong_questions wq
       JOIN questions q ON wq.question_id = q.id
       JOIN decks d ON wq.deck_id = d.id
       WHERE wq.user_id = ?
       ORDER BY wq.wrong_count DESC, wq.last_wrong_time DESC`,
      [userId]
    );
    
    const wrongQuestions = rows.map(row => ({
      id: row.id,
      questionId: row.question_id,
      deckId: row.deck_id,
      deckName: row.deck_name,
      wrongCount: row.wrong_count,
      lastWrongTime: row.last_wrong_time,
      firstWrongTime: row.first_wrong_time,
      userAnswer: safeJsonParse(row.user_answer, []),
      correctAnswer: safeJsonParse(row.correct_answer, ''),
      question: {
        id: row.question_id,
        content: row.content,
        type: row.type,
        options: safeJsonParse(row.options, []),
        correctAnswer: safeJsonParse(row.correct_answer, ''),
        explanation: row.explanation,
        tags: safeJsonParse(row.tags, []),
        difficulty: row.difficulty
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(wrongQuestions);
  } catch (error) {
    console.error('获取所有错题失败:', error);
    res.status(500).json({ error: '获取所有错题失败' });
  }
});

// 获取所有错题统计（跨题库，仅当前用户）
router.get('/all/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 总错题数
    const [totalResult] = await pool.query(
      'SELECT COUNT(*) as total FROM wrong_questions WHERE user_id = ?',
      [userId]
    );
    
    // 困难题数 (错误次数 >= 3)
    const [hardResult] = await pool.query(
      'SELECT COUNT(*) as hard FROM wrong_questions WHERE user_id = ? AND wrong_count >= 3',
      [userId]
    );
    
    // 一般题数 (错误次数 1-2)
    const [mediumResult] = await pool.query(
      'SELECT COUNT(*) as medium FROM wrong_questions WHERE user_id = ? AND wrong_count < 3',
      [userId]
    );
    
    // 总错误次数
    const [totalWrongResult] = await pool.query(
      'SELECT COALESCE(SUM(wrong_count), 0) as total_wrong FROM wrong_questions WHERE user_id = ?',
      [userId]
    );
    
    // 计算平均正确率
    const [accuracyResult] = await pool.query(
      `SELECT 
        COALESCE(SUM(c.reps), 0) as total_reps,
        COALESCE(SUM(c.lapses), 0) as total_lapses
       FROM wrong_questions wq
       JOIN cards c ON wq.question_id = c.question_id AND wq.user_id = c.user_id
       WHERE wq.user_id = ?`,
      [userId]
    );
    
    const totalReps = accuracyResult[0].total_reps || 0;
    const totalLapses = accuracyResult[0].total_lapses || 0;
    const avgAccuracy = totalReps + totalLapses > 0 
      ? Math.round((totalReps / (totalReps + totalLapses)) * 100) 
      : 0;
    
    res.json({
      totalWrong: totalResult[0].total,
      hardCount: hardResult[0].hard,
      mediumCount: mediumResult[0].medium,
      totalLapses: totalWrongResult[0].total_wrong,
      avgAccuracy
    });
  } catch (error) {
    console.error('获取所有错题统计失败:', error);
    res.status(500).json({ error: '获取所有错题统计失败' });
  }
});

// 获取题库的所有错题（验证所有权）
router.get('/deck/:deckId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deckId = req.params.deckId;
    
    const [rows] = await pool.query(
      `SELECT wq.*, q.content, q.type, q.options, q.correct_answer, q.explanation, q.tags, q.difficulty
       FROM wrong_questions wq
       JOIN questions q ON wq.question_id = q.id
       WHERE wq.user_id = ? AND wq.deck_id = ?
       ORDER BY wq.wrong_count DESC, wq.last_wrong_time DESC`,
      [userId, deckId]
    );
    
    const wrongQuestions = rows.map(row => ({
      id: row.id,
      questionId: row.question_id,
      deckId: row.deck_id,
      wrongCount: row.wrong_count,
      lastWrongTime: row.last_wrong_time,
      firstWrongTime: row.first_wrong_time,
      userAnswer: safeJsonParse(row.user_answer, []),
      correctAnswer: safeJsonParse(row.correct_answer, ''),
      question: {
        id: row.question_id,
        content: row.content,
        type: row.type,
        options: safeJsonParse(row.options, []),
        correctAnswer: safeJsonParse(row.correct_answer, ''),
        explanation: row.explanation,
        tags: safeJsonParse(row.tags, []),
        difficulty: row.difficulty
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(wrongQuestions);
  } catch (error) {
    console.error('获取错题失败:', error);
    res.status(500).json({ error: '获取错题失败' });
  }
});

// 获取错题统计（验证所有权）
router.get('/deck/:deckId/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const deckId = req.params.deckId;
    
    // 总错题数
    const [totalResult] = await pool.query(
      'SELECT COUNT(*) as total FROM wrong_questions WHERE user_id = ? AND deck_id = ?',
      [userId, deckId]
    );
    
    // 困难题数 (错误次数 >= 3)
    const [hardResult] = await pool.query(
      'SELECT COUNT(*) as hard FROM wrong_questions WHERE user_id = ? AND deck_id = ? AND wrong_count >= 3',
      [userId, deckId]
    );
    
    // 一般题数 (错误次数 1-2)
    const [mediumResult] = await pool.query(
      'SELECT COUNT(*) as medium FROM wrong_questions WHERE user_id = ? AND deck_id = ? AND wrong_count < 3',
      [userId, deckId]
    );
    
    // 总错误次数
    const [totalWrongResult] = await pool.query(
      'SELECT COALESCE(SUM(wrong_count), 0) as total_wrong FROM wrong_questions WHERE user_id = ? AND deck_id = ?',
      [userId, deckId]
    );
    
    // 计算平均正确率（基于卡片的 reps 和 lapses）
    const [accuracyResult] = await pool.query(
      `SELECT 
        COALESCE(SUM(c.reps), 0) as total_reps,
        COALESCE(SUM(c.lapses), 0) as total_lapses
       FROM wrong_questions wq
       JOIN cards c ON wq.question_id = c.question_id AND wq.user_id = c.user_id
       WHERE wq.user_id = ? AND wq.deck_id = ?`,
      [userId, deckId]
    );
    
    const totalReps = accuracyResult[0].total_reps || 0;
    const totalLapses = accuracyResult[0].total_lapses || 0;
    const avgAccuracy = totalReps + totalLapses > 0 
      ? Math.round((totalReps / (totalReps + totalLapses)) * 100) 
      : 0;
    
    res.json({
      totalWrong: totalResult[0].total,
      hardCount: hardResult[0].hard,
      mediumCount: mediumResult[0].medium,
      totalLapses: totalWrongResult[0].total_wrong,
      avgAccuracy
    });
  } catch (error) {
    console.error('获取错题统计失败:', error);
    res.status(500).json({ error: '获取错题统计失败' });
  }
});

// 添加错题记录
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { questionId, deckId, userAnswer, correctAnswer } = req.body;
    
    const now = Date.now();
    
    // 检查是否已存在该用户的该错题
    const [existing] = await pool.query(
      'SELECT id, wrong_count FROM wrong_questions WHERE user_id = ? AND question_id = ?',
      [userId, questionId]
    );
    
    if (existing.length > 0) {
      // 更新错误次数
      await pool.query(
        `UPDATE wrong_questions SET 
          wrong_count = wrong_count + 1,
          last_wrong_time = ?,
          user_answer = ?,
          updated_at = ?
         WHERE id = ?`,
        [now, JSON.stringify(userAnswer), now, existing[0].id]
      );
      
      res.json({ id: existing[0].id, wrongCount: existing[0].wrong_count + 1 });
    } else {
      // 新增错题记录
      const id = uuidv4();
      await pool.query(
        `INSERT INTO wrong_questions 
          (id, user_id, question_id, deck_id, wrong_count, last_wrong_time, first_wrong_time, user_answer, correct_answer, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
        [id, userId, questionId, deckId, now, now, JSON.stringify(userAnswer), JSON.stringify(correctAnswer), now, now]
      );
      
      res.status(201).json({ id, wrongCount: 1 });
    }
  } catch (error) {
    console.error('添加错题失败:', error);
    res.status(500).json({ error: '添加错题失败' });
  }
});

// 删除错题记录
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [result] = await pool.query(
      'DELETE FROM wrong_questions WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '错题不存在或无权限' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除错题失败:', error);
    res.status(500).json({ error: '删除错题失败' });
  }
});

// 重置错题记录（按题目ID）
router.delete('/question/:questionId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await pool.query(
      'DELETE FROM wrong_questions WHERE question_id = ? AND user_id = ?',
      [req.params.questionId, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('重置错题失败:', error);
    res.status(500).json({ error: '重置错题失败' });
  }
});

module.exports = router;
