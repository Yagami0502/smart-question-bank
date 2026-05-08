/**
 * 速率限制中间件
 */

const rateLimit = require('express-rate-limit');

// 通用 API 限流：每个 IP 每分钟 100 次
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});

// 认证接口限流：每个 IP 每 15 分钟 20 次
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登录/注册尝试过于频繁，请 15 分钟后再试' },
});

// 严格限流（密码重置等敏感操作）：每个 IP 每小时 5 次
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '操作过于频繁，请 1 小时后再试' },
});

module.exports = { apiLimiter, authLimiter, strictLimiter };
