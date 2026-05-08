/**
 * 用户设置 API 路由
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/connection');

const { authenticateToken } = require('../middleware/auth');

// 获取用户设置
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user.userId]
    );

    if (rows.length === 0) {
      // 返回默认设置
      return res.json({
        dailyNewCards: 20,
        dailyReviews: 100,
        showTimer: true,
        autoPlayAudio: false,
        darkMode: false,
        errorWeightMultiplier: 2.0,
        decayWeightMultiplier: 1.0,
        conversionMode: 'local',
        aiBaseUrl: '',
        aiModel: '',
        aiApiKey: ''
      });
    }

    const settings = rows[0];
    res.json({
      dailyNewCards: settings.daily_new_cards,
      dailyReviews: settings.daily_reviews,
      showTimer: !!settings.show_timer,
      autoPlayAudio: !!settings.auto_play_audio,
      darkMode: !!settings.dark_mode,
      errorWeightMultiplier: settings.error_weight_multiplier,
      decayWeightMultiplier: settings.decay_weight_multiplier,
      conversionMode: settings.conversion_mode || 'local',
      aiBaseUrl: settings.ai_base_url || '',
      aiModel: settings.ai_model || '',
      aiApiKey: settings.ai_api_key || ''
    });
  } catch (error) {
    console.error('获取用户设置失败:', error);
    res.status(500).json({ error: '获取设置失败' });
  }
});

// 更新用户设置
router.put('/', authenticateToken, async (req, res) => {
  try {
    const {
      dailyNewCards,
      dailyReviews,
      showTimer,
      autoPlayAudio,
      darkMode,
      errorWeightMultiplier,
      decayWeightMultiplier,
      conversionMode,
      aiBaseUrl,
      aiModel,
      aiApiKey
    } = req.body;

    const now = Date.now();

    // 检查是否已有设置记录
    const [existing] = await pool.query(
      'SELECT id FROM user_settings WHERE user_id = ?',
      [req.user.userId]
    );

    if (existing.length === 0) {
      // 创建新记录
      await pool.query(
        `INSERT INTO user_settings 
         (id, user_id, daily_new_cards, daily_reviews, show_timer, auto_play_audio, 
          dark_mode, error_weight_multiplier, decay_weight_multiplier,
          conversion_mode, ai_base_url, ai_model, ai_api_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          req.user.userId,
          dailyNewCards ?? 20,
          dailyReviews ?? 100,
          showTimer ?? true,
          autoPlayAudio ?? false,
          darkMode ?? false,
          errorWeightMultiplier ?? 2.0,
          decayWeightMultiplier ?? 1.0,
          conversionMode ?? 'local',
          aiBaseUrl ?? '',
          aiModel ?? '',
          aiApiKey ?? '',
          now,
          now
        ]
      );
    } else {
      // 更新现有记录
      const updates = [];
      const values = [];

      if (dailyNewCards !== undefined) {
        updates.push('daily_new_cards = ?');
        values.push(dailyNewCards);
      }
      if (dailyReviews !== undefined) {
        updates.push('daily_reviews = ?');
        values.push(dailyReviews);
      }
      if (showTimer !== undefined) {
        updates.push('show_timer = ?');
        values.push(showTimer);
      }
      if (autoPlayAudio !== undefined) {
        updates.push('auto_play_audio = ?');
        values.push(autoPlayAudio);
      }
      if (darkMode !== undefined) {
        updates.push('dark_mode = ?');
        values.push(darkMode);
      }
      if (errorWeightMultiplier !== undefined) {
        updates.push('error_weight_multiplier = ?');
        values.push(errorWeightMultiplier);
      }
      if (decayWeightMultiplier !== undefined) {
        updates.push('decay_weight_multiplier = ?');
        values.push(decayWeightMultiplier);
      }
      if (conversionMode !== undefined) {
        updates.push('conversion_mode = ?');
        values.push(conversionMode);
      }
      if (aiBaseUrl !== undefined) {
        updates.push('ai_base_url = ?');
        values.push(aiBaseUrl);
      }
      if (aiModel !== undefined) {
        updates.push('ai_model = ?');
        values.push(aiModel);
      }
      if (aiApiKey !== undefined) {
        updates.push('ai_api_key = ?');
        values.push(aiApiKey);
      }

      updates.push('updated_at = ?');
      values.push(now);
      values.push(req.user.userId);

      await pool.query(
        `UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`,
        values
      );
    }

    res.json({ message: '设置已保存' });
  } catch (error) {
    console.error('更新用户设置失败:', error);
    res.status(500).json({ error: '保存设置失败' });
  }
});

module.exports = router;
