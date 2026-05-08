-- 智能题库 MySQL 数据库表结构
-- 创建数据库
CREATE DATABASE IF NOT EXISTS smart_question_bank 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE smart_question_bank;

-- ============================================
-- 用户认证相关表
-- ============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(100),
  bio VARCHAR(500),
  avatar VARCHAR(500),
  avatar_status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved',
  avatar_reject_reason VARCHAR(255),
  role ENUM('user', 'admin') DEFAULT 'user',
  status ENUM('active', 'inactive', 'banned') DEFAULT 'active',
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  last_login_at BIGINT,
  last_login_ip VARCHAR(45),
  login_count INT DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_phone (phone),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户资料修改记录表（用于冷却期检测）
CREATE TABLE IF NOT EXISTS user_profile_changes (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  field_name VARCHAR(50) NOT NULL,
  old_value VARCHAR(500),
  new_value VARCHAR(500),
  changed_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_field (user_id, field_name),
  INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户会话表 (用于JWT刷新令牌)
CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  refresh_token VARCHAR(500) NOT NULL,
  device_info VARCHAR(255),
  ip_address VARCHAR(45),
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_refresh_token (refresh_token(255)),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 密码重置令牌表
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 邮箱验证令牌表
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户学习统计表
CREATE TABLE IF NOT EXISTS user_stats (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  total_study_days INT DEFAULT 0,
  total_study_time BIGINT DEFAULT 0,
  total_questions_answered INT DEFAULT 0,
  total_correct_answers INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_study_date DATE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 题库相关表
-- ============================================

-- 题库表
CREATE TABLE IF NOT EXISTS decks (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  is_built_in BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_is_public (is_public),
  INDEX idx_is_built_in (is_built_in)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 题目表
CREATE TABLE IF NOT EXISTS questions (
  id VARCHAR(36) PRIMARY KEY,
  deck_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  type ENUM('MCQ', 'MULTI', 'TRUE_FALSE', 'FILL', 'SHORT_ANSWER') DEFAULT 'MCQ',
  options JSON,
  correct_answer JSON,
  explanation TEXT,
  tags JSON,
  difficulty INT DEFAULT 3,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  INDEX idx_deck_id (deck_id),
  INDEX idx_type (type),
  INDEX idx_difficulty (difficulty),
  FULLTEXT INDEX idx_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 学习卡片表 (记录学习进度)
CREATE TABLE IF NOT EXISTS cards (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  deck_id VARCHAR(36) NOT NULL,
  question_id VARCHAR(36) NOT NULL,
  state ENUM('new', 'learning', 'review', 'relearning') DEFAULT 'new',
  due BIGINT NOT NULL,
  stability FLOAT DEFAULT 0,
  difficulty_factor FLOAT DEFAULT 0,
  elapsed_days INT DEFAULT 0,
  scheduled_days INT DEFAULT 0,
  reps INT DEFAULT 0,
  lapses INT DEFAULT 0,
  last_review BIGINT,
  error_count INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  INDEX idx_cards_user_id (user_id),
  INDEX idx_cards_deck_id (deck_id),
  INDEX idx_state (state),
  INDEX idx_due (due)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 学习记录表
CREATE TABLE IF NOT EXISTS review_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  card_id VARCHAR(36) NOT NULL,
  deck_id VARCHAR(36) NOT NULL,
  rating ENUM('again', 'hard', 'good', 'easy') NOT NULL,
  state ENUM('new', 'learning', 'review', 'relearning') NOT NULL,
  due BIGINT NOT NULL,
  stability FLOAT,
  difficulty_factor FLOAT,
  elapsed_days INT,
  last_elapsed_days INT,
  scheduled_days INT,
  review_time BIGINT NOT NULL,
  review_duration INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  INDEX idx_review_logs_user_id (user_id),
  INDEX idx_card_id (card_id),
  INDEX idx_deck_id (deck_id),
  INDEX idx_review_time (review_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户设置表
CREATE TABLE IF NOT EXISTS settings (
  id INT PRIMARY KEY DEFAULT 1,
  daily_new_cards INT DEFAULT 20,
  daily_review_cards INT DEFAULT 100,
  show_answer_timer BOOLEAN DEFAULT TRUE,
  auto_play_audio BOOLEAN DEFAULT FALSE,
  dark_mode BOOLEAN DEFAULT FALSE,
  fsrs_weights JSON,
  error_weight_multiplier FLOAT DEFAULT 2.0,
  decay_weight_multiplier FLOAT DEFAULT 1.5,
  updated_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 收藏表
CREATE TABLE IF NOT EXISTS favorites (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  question_id VARCHAR(36) NOT NULL,
  deck_id VARCHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_favorite (user_id, question_id),
  INDEX idx_favorites_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 笔记表
CREATE TABLE IF NOT EXISTS notes (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  question_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_note (user_id, question_id),
  INDEX idx_notes_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 成就表
CREATE TABLE IF NOT EXISTS achievements (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  achievement_id VARCHAR(100) NOT NULL,
  unlocked_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_achievement (user_id, achievement_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 学习计划表
CREATE TABLE IF NOT EXISTS study_plans (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  target_questions INT DEFAULT 0,
  completed_questions INT DEFAULT 0,
  start_date BIGINT NOT NULL,
  end_date BIGINT NOT NULL,
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  status ENUM('active', 'completed', 'paused') DEFAULT 'active',
  deck_ids JSON,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 学习提醒表
CREATE TABLE IF NOT EXISTS reminders (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  time VARCHAR(5) NOT NULL,
  days JSON NOT NULL,
  message VARCHAR(255),
  enabled BOOLEAN DEFAULT TRUE,
  sound BOOLEAN DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 错题本表
CREATE TABLE IF NOT EXISTS wrong_questions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  question_id VARCHAR(36) NOT NULL,
  deck_id VARCHAR(36) NOT NULL,
  wrong_count INT DEFAULT 1,
  last_wrong_time BIGINT NOT NULL,
  first_wrong_time BIGINT NOT NULL,
  user_answer JSON,
  correct_answer JSON,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_wrong (user_id, question_id),
  INDEX idx_wrong_user_id (user_id),
  INDEX idx_wrong_deck_id (deck_id),
  INDEX idx_wrong_count (wrong_count),
  INDEX idx_last_wrong_time (last_wrong_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户设置表（每个用户独立的设置）
CREATE TABLE IF NOT EXISTS user_settings (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  daily_new_cards INT DEFAULT 20,
  daily_reviews INT DEFAULT 100,
  show_timer BOOLEAN DEFAULT TRUE,
  auto_play_audio BOOLEAN DEFAULT FALSE,
  dark_mode BOOLEAN DEFAULT FALSE,
  error_weight_multiplier FLOAT DEFAULT 2.0,
  decay_weight_multiplier FLOAT DEFAULT 1.0,
  -- AI 转换设置
  conversion_mode VARCHAR(20) DEFAULT 'local',
  ai_base_url VARCHAR(500),
  ai_model VARCHAR(100),
  ai_api_key VARCHAR(500),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认设置
INSERT INTO settings (id, updated_at) VALUES (1, UNIX_TIMESTAMP() * 1000)
ON DUPLICATE KEY UPDATE id = 1;


-- ============================================
-- 词库相关表
-- ============================================

-- 词库表（支持用户创建和公开分享）
CREATE TABLE IF NOT EXISTS vocabulary_books (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  word_count INT DEFAULT 0,
  is_built_in BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT TRUE,
  user_id VARCHAR(36),
  cover_image VARCHAR(500),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_is_public (is_public),
  INDEX idx_is_built_in (is_built_in),
  INDEX idx_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 单词表
CREATE TABLE IF NOT EXISTS words (
  id VARCHAR(36) PRIMARY KEY,
  book_id VARCHAR(36) NOT NULL,
  word VARCHAR(255) NOT NULL,
  phonetic_us VARCHAR(255),
  phonetic_uk VARCHAR(255),
  translations JSON NOT NULL,
  phrases JSON,
  sentences JSON,
  synonyms JSON,
  antonyms JSON,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES vocabulary_books(id) ON DELETE CASCADE,
  INDEX idx_book_id (book_id),
  INDEX idx_word (word),
  FULLTEXT INDEX idx_word_fulltext (word)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户词库关联表（用户添加的词库）
CREATE TABLE IF NOT EXISTS user_vocabularies (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  book_id VARCHAR(36) NOT NULL,
  learned_count INT DEFAULT 0,
  mastered_count INT DEFAULT 0,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES vocabulary_books(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_book (user_id, book_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 单词学习进度表
CREATE TABLE IF NOT EXISTS word_progress (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  word_id VARCHAR(36) NOT NULL,
  book_id VARCHAR(36) NOT NULL,
  state ENUM('new', 'learning', 'review', 'mastered') DEFAULT 'new',
  due_date BIGINT NOT NULL,
  interval_days INT DEFAULT 0,
  ease_factor FLOAT DEFAULT 2.5,
  reps INT DEFAULT 0,
  lapses INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  wrong_count INT DEFAULT 0,
  last_review BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES vocabulary_books(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_word (user_id, word_id),
  INDEX idx_user_book (user_id, book_id),
  INDEX idx_state (state),
  INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 错词表
CREATE TABLE IF NOT EXISTS wrong_words (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  word_id VARCHAR(36) NOT NULL,
  book_id VARCHAR(36) NOT NULL,
  word VARCHAR(255) NOT NULL,
  wrong_count INT DEFAULT 1,
  last_wrong_time BIGINT NOT NULL,
  user_inputs JSON,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES vocabulary_books(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_wrong_word (user_id, word_id),
  INDEX idx_user_id (user_id),
  INDEX idx_book_id (book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 收藏单词表
CREATE TABLE IF NOT EXISTS favorite_words (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  word_id VARCHAR(36) NOT NULL,
  book_id VARCHAR(36) NOT NULL,
  word VARCHAR(255) NOT NULL,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES vocabulary_books(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_favorite_word (user_id, word_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 已掌握单词表
CREATE TABLE IF NOT EXISTS mastered_words (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  word_id VARCHAR(36) NOT NULL,
  book_id VARCHAR(36) NOT NULL,
  word VARCHAR(255) NOT NULL,
  mastered_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES vocabulary_books(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_mastered_word (user_id, word_id),
  INDEX idx_user_id (user_id),
  INDEX idx_book_id (book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 词库设置表
CREATE TABLE IF NOT EXISTS vocabulary_settings (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  daily_new_words INT DEFAULT 20,
  daily_review_words INT DEFAULT 50,
  auto_play_audio BOOLEAN DEFAULT TRUE,
  voice_type ENUM('us', 'uk') DEFAULT 'us',
  speech_rate FLOAT DEFAULT 1.0,
  show_phonetic BOOLEAN DEFAULT TRUE,
  show_example BOOLEAN DEFAULT TRUE,
  keyboard_sound BOOLEAN DEFAULT FALSE,
  keyboard_sound_type VARCHAR(20) DEFAULT 'mechanical',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 文章表
CREATE TABLE IF NOT EXISTS articles (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  translation TEXT,
  category VARCHAR(100),
  difficulty INT DEFAULT 3,
  word_count INT DEFAULT 0,
  is_built_in BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT TRUE,
  user_id VARCHAR(36),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_category (category),
  INDEX idx_difficulty (difficulty),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
