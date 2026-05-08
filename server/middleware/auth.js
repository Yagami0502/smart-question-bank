/**
 * 认证中间件 - 从 auth 路由中抽取，供所有路由复用
 */

const { pool } = require('../db/connection');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// 启动时校验必要环境变量
function validateAuthEnv() {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET 环境变量未设置，服务器无法启动');
  }
  if (!JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET 环境变量未设置，服务器无法启动');
  }
}

const ACCESS_TOKEN_EXPIRES = '15m';
const REFRESH_TOKEN_EXPIRES = '7d';

// 验证访问令牌中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: '令牌已过期', code: 'TOKEN_EXPIRED' });
      }
      return res.status(403).json({ error: '无效的令牌' });
    }
    req.user = user;
    next();
  });
};

// 可选认证 - 有 token 就解析，没有也放行
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    req.user = err ? null : user;
    next();
  });
};

// 管理员权限中间件
const requireAdmin = async (req, res, next) => {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const [users] = await pool.query(
      'SELECT role, status FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0 || users[0].status !== 'active') {
      return res.status(403).json({ error: '账号不可用' });
    }

    if (users[0].role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    req.user.role = users[0].role;
    next();
  } catch (error) {
    console.error('管理员权限检查失败:', error);
    res.status(500).json({ error: '权限检查失败' });
  }
};

// 生成访问令牌
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
}

// 生成刷新令牌
function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );
}

module.exports = {
  validateAuthEnv,
  authenticateToken,
  optionalAuth,
  requireAdmin,
  generateAccessToken,
  generateRefreshToken,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES,
};
