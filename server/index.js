/**
 * MindForge 后端服务器
 * Express + MySQL
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { testConnection, validateDbEnv } = require('./db/connection');
const { validateAuthEnv } = require('./middleware/auth');
const { apiLimiter, authLimiter } = require('./middleware/rate-limit');

// 路由
const authRouter = require('./routes/auth');
const decksRouter = require('./routes/decks');
const questionsRouter = require('./routes/questions');
const cardsRouter = require('./routes/cards');
const settingsRouter = require('./routes/settings');
const userSettingsRouter = require('./routes/user-settings');
const profileRouter = require('./routes/profile');
const statsRouter = require('./routes/stats');
const wrongQuestionsRouter = require('./routes/wrong-questions');
const favoritesRouter = require('./routes/favorites');
const notesRouter = require('./routes/notes');
const achievementsRouter = require('./routes/achievements');
const studyPlansRouter = require('./routes/study-plans');
const remindersRouter = require('./routes/reminders');
const vocabularyRouter = require('./routes/vocabulary');
const adminRouter = require('./routes/admin');
const importRouter = require('./routes/import');

const app = express();
const PORT = process.env.PORT || 3001;

// === 安全中间件 ===
app.use(helmet());

// === CORS 配置 ===
const corsOrigins = process.env.CORS_ORIGINS;
const corsOptions = corsOrigins
  ? {
      origin: corsOrigins.split(',').map(o => o.trim()),
      credentials: true,
    }
  : {
      origin: true, // 开发环境允许所有来源
      credentials: true,
    };
app.use(cors(corsOptions));

// === 请求日志 ===
app.use(morgan(process.env.LOG_FORMAT || 'dev'));

// === 请求体解析 ===
app.use(express.json({ limit: '10mb' }));

// === 全局速率限制 ===
app.use('/api', apiLimiter);

// === 认证接口额外限流 ===
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// === API 路由 ===
app.use('/api/auth', authRouter);
app.use('/api/decks', decksRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/user-settings', userSettingsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/stats', statsRouter);
app.use('/api/wrong-questions', wrongQuestionsRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/notes', notesRouter);
app.use('/api/achievements', achievementsRouter);
app.use('/api/study-plans', studyPlansRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/vocabulary', vocabularyRouter);
app.use('/api/admin', adminRouter);
app.use('/api/import', importRouter);

// === 健康检查 ===
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// === 404 处理 ===
app.use('/api', (req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// === 全局错误处理 ===
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? '服务器内部错误' : err.message,
  });
});

// === 启动服务器 ===
async function startServer() {
  // 校验必要环境变量
  try {
    validateAuthEnv();
    validateDbEnv();
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }

  // 测试数据库连接
  const dbConnected = await testConnection();

  if (!dbConnected) {
    console.error('⚠️  数据库连接失败，请检查配置');
    console.log('提示: 请确保已创建数据库并配置 .env 文件');
    console.log('运行以下命令创建数据库:');
    console.log('  mysql -u root -p < db/schema.sql');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 MindForge 服务器运行在 http://localhost:${PORT}`);
    console.log(`📊 健康检查: http://localhost:${PORT}/api/health\n`);
  });
}

startServer();
