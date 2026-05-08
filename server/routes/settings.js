/**
 * 设置 API 路由
 */

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { pool } = require('../db/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const DEFAULT_SETTINGS = {
  dailyNewCards: 20,
  dailyReviewCards: 100,
  showAnswerTimer: true,
  autoPlayAudio: false,
  darkMode: false,
  fsrsWeights: null,
  errorWeightMultiplier: 2.0,
  decayWeightMultiplier: 1.5
};

function parseFsrsWeights(rawValue) {
  if (!rawValue) {
    return DEFAULT_SETTINGS.fsrsWeights;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    console.error('解析 fsrs_weights 失败:', error);
    return DEFAULT_SETTINGS.fsrsWeights;
  }
}

const SETTINGS_SCHEMA = z.object({
  dailyNewCards: z.number().int().min(1).max(1000).optional(),
  dailyReviewCards: z.number().int().min(1).max(5000).optional(),
  showAnswerTimer: z.boolean().optional(),
  autoPlayAudio: z.boolean().optional(),
  darkMode: z.boolean().optional(),
  fsrsWeights: z.array(z.number().finite()).max(32).nullable().optional(),
  errorWeightMultiplier: z.number().finite().min(0).max(10).optional(),
  decayWeightMultiplier: z.number().finite().min(0).max(10).optional()
});

function hasOwnProperty(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function getNextSettingValue(body, key, fallback) {
  return hasOwnProperty(body, key) ? body[key] : fallback;
}

// 获取设置
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM settings WHERE id = 1');
    
    if (rows.length === 0) {
      return res.json(DEFAULT_SETTINGS);
    }

    const row = rows[0];
    res.json(normalizeSettingsRow(row));
  } catch (error) {
    console.error('获取设置失败:', error);
    res.status(500).json({ error: '获取设置失败' });
  }
});

// 更新设置
router.put('/', authenticateToken, requireAdmin, validateBody(SETTINGS_SCHEMA), async (req, res) => {
  try {
    const {
      dailyNewCards,
      dailyReviewCards,
      showAnswerTimer,
      autoPlayAudio,
      darkMode,
      fsrsWeights,
      errorWeightMultiplier,
      decayWeightMultiplier
    } = req.body;
    const now = Date.now();
    const [rows] = await pool.query('SELECT * FROM settings WHERE id = 1');
    const currentSettings = rows.length > 0
      ? normalizeSettingsRow(rows[0])
      : DEFAULT_SETTINGS;

    const nextSettings = {
      dailyNewCards: getNextSettingValue(req.body, 'dailyNewCards', currentSettings.dailyNewCards),
      dailyReviewCards: getNextSettingValue(req.body, 'dailyReviewCards', currentSettings.dailyReviewCards),
      showAnswerTimer: getNextSettingValue(req.body, 'showAnswerTimer', currentSettings.showAnswerTimer),
      autoPlayAudio: getNextSettingValue(req.body, 'autoPlayAudio', currentSettings.autoPlayAudio),
      darkMode: getNextSettingValue(req.body, 'darkMode', currentSettings.darkMode),
      fsrsWeights: getNextSettingValue(req.body, 'fsrsWeights', currentSettings.fsrsWeights),
      errorWeightMultiplier: getNextSettingValue(req.body, 'errorWeightMultiplier', currentSettings.errorWeightMultiplier),
      decayWeightMultiplier: getNextSettingValue(req.body, 'decayWeightMultiplier', currentSettings.decayWeightMultiplier)
    };

    await pool.query(
      `INSERT INTO settings (id, daily_new_cards, daily_review_cards, show_answer_timer, 
        auto_play_audio, dark_mode, fsrs_weights, error_weight_multiplier, decay_weight_multiplier, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        daily_new_cards = VALUES(daily_new_cards),
        daily_review_cards = VALUES(daily_review_cards),
        show_answer_timer = VALUES(show_answer_timer),
        auto_play_audio = VALUES(auto_play_audio),
        dark_mode = VALUES(dark_mode),
        fsrs_weights = VALUES(fsrs_weights),
        error_weight_multiplier = VALUES(error_weight_multiplier),
        decay_weight_multiplier = VALUES(decay_weight_multiplier),
        updated_at = VALUES(updated_at)`,
      [
        nextSettings.dailyNewCards,
        nextSettings.dailyReviewCards,
        nextSettings.showAnswerTimer,
        nextSettings.autoPlayAudio,
        nextSettings.darkMode,
        nextSettings.fsrsWeights == null ? null : JSON.stringify(nextSettings.fsrsWeights),
        nextSettings.errorWeightMultiplier,
        nextSettings.decayWeightMultiplier,
        now
      ]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('更新设置失败:', error);
    res.status(500).json({ error: '更新设置失败' });
  }
});

module.exports = router;
