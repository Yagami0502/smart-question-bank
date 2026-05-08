/**
 * 用户认证 API 路由
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { pool } = require('../db/connection');
const {
  authenticateToken,
  generateAccessToken,
  generateRefreshToken,
  JWT_REFRESH_SECRET,
} = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

// === Zod Schemas ===

const registerSchema = z.object({
  username: z.string()
    .min(3, '用户名至少3位')
    .max(20, '用户名最多20位')
    .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字或下划线'),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少需要6位'),
  nickname: z.string().max(100).optional(),
});

const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, '请输入旧密码'),
  newPassword: z.string().min(6, '新密码至少需要6位'),
});

// === 工具函数 ===

// 获取客户端真实 IP
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = req.headers['x-real-ip'];
  if (realIP) return realIP;

  let ip = req.ip || req.connection?.remoteAddress || '';
  if (ip === '::1' || ip === '::ffff:127.0.0.1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) ip = ip.substring(7);
  return ip || '未知';
}
// 解析 User-Agent 获取设备信息
function parseUserAgent(ua) {
  if (!ua) return { deviceType: 'unknown', browser: '未知浏览器', os: '未知系统', deviceName: '未知设备' };

  let deviceType = 'desktop';
  if (/Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua)) {
    deviceType = /iPad|Tablet/i.test(ua) ? 'tablet' : 'mobile';
  }

  let browser = '未知浏览器';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua)) browser = 'Safari';
  else if (/Opera|OPR/i.test(ua)) browser = 'Opera';

  let os = '未知系统';
  if (/Windows NT 10/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) {
    const m = ua.match(/Android\s+([\d.]+)/i);
    os = m ? `Android ${m[1]}` : 'Android';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    const m = ua.match(/OS\s+([\d_]+)/i);
    os = m ? `iOS ${m[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/Linux/i.test(ua)) os = 'Linux';

  let deviceName;
  if (deviceType === 'mobile') {
    if (/iPhone/i.test(ua)) deviceName = 'iPhone';
    else if (/Android/i.test(ua)) {
      const m = ua.match(/;\s*([^;)]+)\s*Build/i);
      deviceName = m ? m[1].trim() : 'Android 手机';
    } else deviceName = '手机';
  } else if (deviceType === 'tablet') {
    deviceName = /iPad/i.test(ua) ? 'iPad' : '平板';
  } else {
    deviceName = `${os} 电脑`;
  }

  return { deviceType, browser, os, deviceName: `${deviceName} · ${browser}` };
}

// 创建会话记录
async function createSession(userId, req) {
  const now = Date.now();
  const clientIP = getClientIP(req);
  const deviceInfo = parseUserAgent(req.headers['user-agent'] || '');
  const sessionId = uuidv4();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

  await pool.query(
    `INSERT INTO user_sessions (id, user_id, refresh_token, ip_address, device_info, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, userId, '', clientIP, JSON.stringify(deviceInfo), expiresAt, now]
  );

  return { sessionId, clientIP, deviceInfo, expiresAt };
}

// === 路由 ===

// 注册
router.post('/register', validateBody(registerSchema), async (req, res) => {
  try {
    const { username, email, password, nickname } = req.body;

    // 检查用户名是否已存在
    const [existingUsername] = await pool.query(
      'SELECT id FROM users WHERE username = ?', [username]
    );
    if (existingUsername.length > 0) {
      return res.status(400).json({ error: '用户名已被使用' });
    }

    // 检查邮箱是否已存在
    const [existingEmail] = await pool.query(
      'SELECT id FROM users WHERE email = ?', [email]
    );
    if (existingEmail.length > 0) {
      return res.status(400).json({ error: '邮箱已被注册' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = uuidv4();
    const now = Date.now();

    await pool.query(
      `INSERT INTO users (id, username, email, password_hash, nickname, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, email, passwordHash, nickname || username, now, now]
    );

    await pool.query(
      `INSERT INTO user_stats (id, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
      [uuidv4(), userId, now, now]
    );

    const user = { id: userId, username, role: 'user' };
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const { sessionId, clientIP } = await createSession(userId, req);
    // 更新会话的 refresh_token
    await pool.query(
      'UPDATE user_sessions SET refresh_token = ? WHERE id = ?',
      [refreshToken, sessionId]
    );

    res.status(201).json({
      message: '注册成功',
      user: { id: userId, username, email, nickname: nickname || username, role: 'user' },
      accessToken,
      refreshToken,
      sessionId,
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 登录
router.post('/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;

    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = users[0];

    if (user.status === 'banned') {
      return res.status(403).json({ error: '账号已被禁用' });
    }
    if (user.status === 'inactive') {
      return res.status(403).json({ error: '账号未激活' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const now = Date.now();
    const clientIP = getClientIP(req);
    await pool.query(
      `UPDATE users SET last_login_at = ?, last_login_ip = ?, login_count = login_count + 1, updated_at = ? WHERE id = ?`,
      [now, clientIP, now, user.id]
    );

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const { sessionId } = await createSession(user.id, req);
    await pool.query(
      'UPDATE user_sessions SET refresh_token = ? WHERE id = ?',
      [refreshToken, sessionId]
    );

    res.json({
      message: '登录成功',
      user: {
        id: user.id, username: user.username, email: user.email,
        nickname: user.nickname, avatar: user.avatar, role: user.role,
      },
      accessToken,
      refreshToken,
      sessionId,
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 刷新令牌
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: '未提供刷新令牌' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ error: '无效的刷新令牌' });
    }

    const [sessions] = await pool.query(
      'SELECT * FROM user_sessions WHERE refresh_token = ? AND expires_at > ?',
      [refreshToken, Date.now()]
    );
    if (sessions.length === 0) {
      return res.status(401).json({ error: '刷新令牌已失效' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0) {
      return res.status(401).json({ error: '用户不存在' });
    }

    res.json({ accessToken: generateAccessToken(users[0]) });
  } catch (error) {
    console.error('刷新令牌失败:', error);
    res.status(500).json({ error: '刷新令牌失败' });
  }
});

// 登出
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await pool.query('DELETE FROM user_sessions WHERE refresh_token = ?', [refreshToken]);
    } else {
      await pool.query('DELETE FROM user_sessions WHERE user_id = ?', [req.user.userId]);
    }
    res.json({ message: '登出成功' });
  } catch (error) {
    console.error('登出失败:', error);
    res.status(500).json({ error: '登出失败' });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.*, us.total_study_days, us.total_study_time, us.total_questions_answered,
              us.total_correct_answers, us.current_streak, us.longest_streak
       FROM users u
       LEFT JOIN user_stats us ON u.id = us.user_id
       WHERE u.id = ?`,
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = users[0];
    res.json({
      id: user.id, username: user.username, email: user.email,
      nickname: user.nickname, avatar: user.avatar, role: user.role,
      emailVerified: user.email_verified, createdAt: user.created_at,
      stats: {
        totalStudyDays: user.total_study_days || 0,
        totalStudyTime: user.total_study_time || 0,
        totalQuestionsAnswered: user.total_questions_answered || 0,
        totalCorrectAnswers: user.total_correct_answers || 0,
        currentStreak: user.current_streak || 0,
        longestStreak: user.longest_streak || 0,
      },
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 更新用户信息
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { nickname, avatar } = req.body;
    await pool.query(
      'UPDATE users SET nickname = COALESCE(?, nickname), avatar = COALESCE(?, avatar), updated_at = ? WHERE id = ?',
      [nickname, avatar, Date.now(), req.user.userId]
    );
    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({ error: '更新用户信息失败' });
  }
});

// 修改密码
router.put('/password', authenticateToken, validateBody(changePasswordSchema), async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const [users] = await pool.query(
      'SELECT password_hash FROM users WHERE id = ?', [req.user.userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const isValidPassword = await bcrypt.compare(oldPassword, users[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: '旧密码错误' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await pool.query(
      'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
      [passwordHash, Date.now(), req.user.userId]
    );
    await pool.query('DELETE FROM user_sessions WHERE user_id = ?', [req.user.userId]);

    res.json({ message: '密码修改成功，请重新登录' });
  } catch (error) {
    console.error('修改密码失败:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// 获取用户所有登录会话
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const [sessions] = await pool.query(
      `SELECT id, ip_address, device_info, created_at, expires_at
       FROM user_sessions
       WHERE user_id = ? AND expires_at > ?
       ORDER BY created_at DESC`,
      [req.user.userId, Date.now()]
    );

    const currentSessionId = req.headers['x-session-id'] || '';

    const formattedSessions = sessions.map(session => {
      let deviceData = { deviceName: '未知设备', deviceType: 'unknown', browser: '', os: '' };
      try {
        if (session.device_info) {
          deviceData = typeof session.device_info === 'string'
            ? JSON.parse(session.device_info) : session.device_info;
        }
      } catch (e) {
        deviceData.deviceName = session.device_info || '未知设备';
      }
      return {
        id: session.id,
        ipAddress: session.ip_address || '未知',
        deviceName: deviceData.deviceName || '未知设备',
        deviceType: deviceData.deviceType || 'unknown',
        browser: deviceData.browser || '',
        os: deviceData.os || '',
        createdAt: session.created_at,
        expiresAt: session.expires_at,
        isCurrent: session.id === currentSessionId,
      };
    });

    res.json(formattedSessions);
  } catch (error) {
    console.error('获取会话列表失败:', error);
    res.status(500).json({ error: '获取会话列表失败' });
  }
});

// 删除指定会话（踢出设备）
router.delete('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM user_sessions WHERE id = ? AND user_id = ?',
      [req.params.sessionId, req.user.userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '会话不存在' });
    }
    res.json({ message: '已移除该设备的登录' });
  } catch (error) {
    console.error('删除会话失败:', error);
    res.status(500).json({ error: '删除会话失败' });
  }
});

// 删除所有其他会话
router.delete('/sessions', authenticateToken, async (req, res) => {
  try {
    const { currentRefreshToken } = req.body;
    if (currentRefreshToken) {
      await pool.query(
        'DELETE FROM user_sessions WHERE user_id = ? AND refresh_token != ?',
        [req.user.userId, currentRefreshToken]
      );
    } else {
      await pool.query('DELETE FROM user_sessions WHERE user_id = ?', [req.user.userId]);
    }
    res.json({ message: '已移除所有其他设备的登录' });
  } catch (error) {
    console.error('删除会话失败:', error);
    res.status(500).json({ error: '删除会话失败' });
  }
});

module.exports = router;
