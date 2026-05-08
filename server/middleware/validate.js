/**
 * Zod 请求体校验中间件
 */

const { ZodError } = require('zod');

/**
 * 创建请求体校验中间件
 * @param {import('zod').ZodSchema} schema - Zod schema
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map(e => e.message);
        return res.status(400).json({
          error: '输入验证失败',
          details: messages,
        });
      }
      next(err);
    }
  };
}

/**
 * 创建查询参数校验中间件
 * @param {import('zod').ZodSchema} schema - Zod schema
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map(e => e.message);
        return res.status(400).json({
          error: '查询参数验证失败',
          details: messages,
        });
      }
      next(err);
    }
  };
}

module.exports = { validateBody, validateQuery };
