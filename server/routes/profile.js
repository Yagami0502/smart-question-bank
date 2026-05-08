/**
 * 用户资料 API 路由
 * 包含：资料编辑、敏感词检测、修改冷却期、头像审核
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');

// 敏感词列表（实际项目中应该从数据库或配置文件加载）
const SENSITIVE_WORDS = [
  '傻逼', '操你', '妈的', '草泥马', '尼玛', '狗日', '王八蛋', '混蛋',
  '白痴', '智障', '脑残', '废物', '垃圾', '贱人', '婊子', '妓女',
  '赌博', '色情', '毒品', '枪支', '暴力', '恐怖', '邪教', '法轮功',
  'admin', 'administrator', 'root', 'system', 'test', 'null', 'undefined',
  '官方', '客服', '管理员', '系统', '运营'
];

// 修改冷却期配置
const COOLDOWN_CONFIG = {
  nickname: { maxChanges: 3, periodHours: 24 },
  username: { maxChanges: 1, periodHours: 168 }, // 7天
  email: { maxChanges: 2, periodHours: 24 },
  phone: { maxChanges: 2, periodHours: 24 },
  bio: { maxChanges: 10, periodHours: 24 },
};

/**
 * 检测敏感词
 */
function containsSensitiveWord(text) {
  if (!text) return { hasSensitive: false, words: [] };
  const lowerText = text.toLowerCase();
  const foundWords = SENSITIVE_WORDS.filter(word => 
    lowerText.includes(word.toLowerCase())
  );
  return {
    hasSensitive: foundWords.length > 0,
    words: foundWords
  };
}

/**
 * 检查修改冷却期
 */
async function checkCooldown(userId, fieldName, executor = pool) {
  const config = COOLDOWN_CONFIG[fieldName];
  if (!config) return { allowed: true };

  const periodStart = Date.now() - (config.periodHours * 60 * 60 * 1000);
  
  const [rows] = await executor.query(
    `SELECT COUNT(*) as count FROM user_profile_changes
     WHERE user_id = ? AND field_name = ? AND changed_at > ?`,
    [userId, fieldName, periodStart]
  );
  const changeCount = rows[0].count;
  const remaining = config.maxChanges - changeCount;

  return {
    allowed: remaining > 0,
    remaining,
    maxChanges: config.maxChanges,
    periodHours: config.periodHours,
    message: remaining > 0 
      ? `今日还可修改 ${remaining} 次` 
      : `已达到修改上限，请 ${config.periodHours} 小时后再试`
  };
}

async function getCooldownLimits(userId, executor = pool) {
  const fields = Object.keys(COOLDOWN_CONFIG);
  if (fields.length === 0) {
    return {};
  }

  const now = Date.now();
  const maxPeriodHours = Math.max(...fields.map(field => COOLDOWN_CONFIG[field].periodHours));
  const periodStart = now - (maxPeriodHours * 60 * 60 * 1000);
  const placeholders = fields.map(() => '?').join(', ');
  const [rows] = await executor.query(
    `SELECT field_name, changed_at
     FROM user_profile_changes
     WHERE user_id = ? AND changed_at > ? AND field_name IN (${placeholders})`,
    [userId, periodStart, ...fields]
  );

  return fields.reduce((result, fieldName) => {
    const config = COOLDOWN_CONFIG[fieldName];
    const fieldPeriodStart = now - (config.periodHours * 60 * 60 * 1000);
    const count = rows.filter(row => row.field_name === fieldName && row.changed_at > fieldPeriodStart).length;
    const remaining = config.maxChanges - count;

    result[fieldName] = {
      allowed: remaining > 0,
      remaining,
      maxChanges: config.maxChanges,
      periodHours: config.periodHours,
      message: remaining > 0
        ? `今日还可修改 ${remaining} 次`
        : `已达到修改上限，请 ${config.periodHours} 小时后再试`
    };
    return result;
  }, {});
}

/**
 * 记录资料修改
 */
function queueChange(changeRecords, fieldName, oldValue, newValue) {
  changeRecords.push({ fieldName, oldValue, newValue });
}

// 获取用户资料
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, email, phone, nickname, bio, avatar, avatar_status, 
              avatar_reject_reason, role, created_at, email_verified, phone_verified
       FROM users WHERE id = ?`,
      [req.user.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = rows[0];
    const joinedDays = Math.floor((Date.now() - user.created_at) / (1000 * 60 * 60 * 24));

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone || '',
      nickname: user.nickname || user.username,
      bio: user.bio || '',
      avatar: user.avatar || '',
      avatarStatus: user.avatar_status,
      avatarRejectReason: user.avatar_reject_reason,
      role: user.role,
      emailVerified: !!user.email_verified,
      phoneVerified: !!user.phone_verified,
      joinedDays,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('获取用户资料失败:', error);
    res.status(500).json({ error: '获取用户资料失败' });
  }
});

// 获取修改限制状态
router.get('/limits', authenticateToken, async (req, res) => {
  try {
    const limits = await getCooldownLimits(req.user.userId);
    res.json(limits);
  } catch (error) {
    console.error('获取修改限制失败:', error);
    res.status(500).json({ error: '获取修改限制失败' });
  }
});

// 更新用户资料
router.put('/', authenticateToken, async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();
    const userId = req.user.userId;
    const { nickname, username, email, phone, bio } = req.body;
    const updates = [];
    const values = [];
    const errors = [];
    const warnings = [];
    const changeRecords = [];

    await connection.beginTransaction();

    const [currentUser] = await connection.query(
      'SELECT username, email, phone, nickname, bio FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    if (currentUser.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: '用户不存在' });
    }
    const current = currentUser[0];

    if (nickname !== undefined && nickname !== current.nickname) {
      const sensitiveCheck = containsSensitiveWord(nickname);
      if (sensitiveCheck.hasSensitive) {
        errors.push(`昵称包含敏感词：${sensitiveCheck.words.join(', ')}`);
      } else {
        const cooldown = await checkCooldown(userId, 'nickname', connection);
        if (!cooldown.allowed) {
          errors.push(`昵称${cooldown.message}`);
        } else if (nickname.length < 2 || nickname.length > 20) {
          errors.push('昵称长度需在 2-20 个字符之间');
        } else {
          updates.push('nickname = ?');
          values.push(nickname);
          queueChange(changeRecords, 'nickname', current.nickname, nickname);
          warnings.push(`昵称${cooldown.message}`);
        }
      }
    }

    if (username !== undefined && username !== current.username) {
      const sensitiveCheck = containsSensitiveWord(username);
      if (sensitiveCheck.hasSensitive) {
        errors.push(`用户名包含敏感词：${sensitiveCheck.words.join(', ')}`);
      } else {
        const cooldown = await checkCooldown(userId, 'username', connection);
        if (!cooldown.allowed) {
          errors.push(`用户名${cooldown.message}`);
        } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
          errors.push('用户名只能包含字母、数字和下划线，长度 3-20');
        } else {
          const [existing] = await connection.query(
            'SELECT id FROM users WHERE username = ? AND id != ?',
            [username, userId]
          );
          if (existing.length > 0) {
            errors.push('用户名已被使用');
          } else {
            updates.push('username = ?');
            values.push(username);
            queueChange(changeRecords, 'username', current.username, username);
            warnings.push(`用户名${cooldown.message}`);
          }
        }
      }
    }

    if (email !== undefined && email !== current.email) {
      const cooldown = await checkCooldown(userId, 'email', connection);
      if (!cooldown.allowed) {
        errors.push(`邮箱${cooldown.message}`);
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('邮箱格式不正确');
      } else {
        const [existing] = await connection.query(
          'SELECT id FROM users WHERE email = ? AND id != ?',
          [email, userId]
        );
        if (existing.length > 0) {
          errors.push('邮箱已被使用');
        } else {
          updates.push('email = ?');
          values.push(email);
          updates.push('email_verified = ?');
          values.push(false);
          queueChange(changeRecords, 'email', current.email, email);
          warnings.push('邮箱已更新，请重新验证');
        }
      }
    }

    if (phone !== undefined && phone !== current.phone) {
      const cooldown = await checkCooldown(userId, 'phone', connection);
      if (!cooldown.allowed) {
        errors.push(`手机号${cooldown.message}`);
      } else if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
        errors.push('手机号格式不正确');
      } else if (phone) {
        const [existing] = await connection.query(
          'SELECT id FROM users WHERE phone = ? AND id != ?',
          [phone, userId]
        );
        if (existing.length > 0) {
          errors.push('手机号已被使用');
        } else {
          updates.push('phone = ?');
          values.push(phone);
          updates.push('phone_verified = ?');
          values.push(false);
          queueChange(changeRecords, 'phone', current.phone, phone);
          warnings.push('手机号已更新，请重新验证');
        }
      } else {
        updates.push('phone = ?');
        values.push(null);
        queueChange(changeRecords, 'phone', current.phone, null);
      }
    }

    if (bio !== undefined && bio !== current.bio) {
      const sensitiveCheck = containsSensitiveWord(bio);
      if (sensitiveCheck.hasSensitive) {
        errors.push(`个性签名包含敏感词：${sensitiveCheck.words.join(', ')}`);
      } else {
        const cooldown = await checkCooldown(userId, 'bio', connection);
        if (!cooldown.allowed) {
          errors.push(`个性签名${cooldown.message}`);
        } else if (bio.length > 200) {
          errors.push('个性签名不能超过 200 个字符');
        } else {
          updates.push('bio = ?');
          values.push(bio);
          queueChange(changeRecords, 'bio', current.bio, bio);
        }
      }
    }

    if (errors.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        error: '资料更新失败',
        details: errors,
        warnings
      });
    }

    if (updates.length === 0) {
      await connection.rollback();
      return res.json({
        message: '没有需要更新的内容',
        warnings
      });
    }

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(userId);

    await connection.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    if (changeRecords.length > 0) {
      const changedAt = Date.now();
      const placeholders = changeRecords.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const insertValues = changeRecords.flatMap(change => [
        uuidv4(),
        userId,
        change.fieldName,
        change.oldValue,
        change.newValue,
        changedAt
      ]);

      await connection.query(
        `INSERT INTO user_profile_changes (id, user_id, field_name, old_value, new_value, changed_at)
         VALUES ${placeholders}`,
        insertValues
      );
    }

    await connection.commit();

    res.json({
      message: '资料更新成功',
      warnings,
      updated: updates.filter(u => !u.includes('updated_at') && !u.includes('verified')).length
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('更新用户资料失败:', error);
    res.status(500).json({ error: '更新用户资料失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// 上传头像（模拟审核）
router.post('/avatar', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({ error: '请提供头像URL' });
    }

    // 模拟头像审核（实际项目中应该调用图像审核API）
    // 这里简单检查URL格式和一些基本规则
    const isValidUrl = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(avatarUrl);
    
    if (!isValidUrl) {
      return res.status(400).json({ 
        error: '头像URL格式不正确',
        hint: '请使用 jpg、png、gif 或 webp 格式的图片链接'
      });
    }

    // 设置头像为待审核状态
    await pool.query(
      `UPDATE users SET avatar = ?, avatar_status = 'pending', 
       avatar_reject_reason = NULL, updated_at = ? WHERE id = ?`,
      [avatarUrl, Date.now(), userId]
    );

    // 模拟异步审核（实际项目中应该是后台任务）
    // 这里直接自动通过，实际应该调用内容审核服务
    setTimeout(async () => {
      try {
        // 模拟审核逻辑：90%通过，10%拒绝
        const approved = Math.random() > 0.1;
        
        if (approved) {
          await pool.query(
            `UPDATE users SET avatar_status = 'approved', updated_at = ? WHERE id = ?`,
            [Date.now(), userId]
          );
        } else {
          await pool.query(
            `UPDATE users SET avatar_status = 'rejected', 
             avatar_reject_reason = '图片内容不符合社区规范', updated_at = ? WHERE id = ?`,
            [Date.now(), userId]
          );
        }
      } catch (err) {
        console.error('头像审核更新失败:', err);
      }
    }, 2000); // 2秒后完成审核

    res.json({ 
      message: '头像已提交，正在审核中',
      status: 'pending',
      hint: '审核通常在几分钟内完成，请稍后刷新查看结果'
    });
  } catch (error) {
    console.error('上传头像失败:', error);
    res.status(500).json({ error: '上传头像失败' });
  }
});

// 检查头像审核状态
router.get('/avatar/status', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT avatar, avatar_status, avatar_reject_reason FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = rows[0];
    res.json({
      avatar: user.avatar,
      status: user.avatar_status,
      rejectReason: user.avatar_reject_reason
    });
  } catch (error) {
    console.error('获取头像状态失败:', error);
    res.status(500).json({ error: '获取头像状态失败' });
  }
});

// 检测敏感词（供前端实时检测）
router.post('/check-sensitive', authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    const result = containsSensitiveWord(text);
    res.json(result);
  } catch (error) {
    console.error('敏感词检测失败:', error);
    res.status(500).json({ error: '敏感词检测失败' });
  }
});

module.exports = router;
