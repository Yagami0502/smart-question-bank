/**
 * 导入辅助 API
 */
const express = require('express');
const { extractWordText } = require('../lib/word-extractor');
const { runQuestionAgent } = require('../lib/question-agents');

const router = express.Router();

router.post('/word/extract', express.raw({ type: '*/*', limit: '20mb' }), async (req, res) => {
  try {
    const filename = req.headers['x-file-name'] || '';
    const mimeType = req.headers['content-type'] || '';
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');

    const result = await extractWordText(buffer, filename, mimeType);
    if (!result.text) {
      return res.status(400).json({ error: '未能从 Word 文件中提取到有效文本' });
    }

    res.json(result);
  } catch (error) {
    console.error('Word 文本抽取失败:', error);
    res.status(400).json({ error: error.message || 'Word 文本抽取失败' });
  }
});

router.post('/agents/run', async (req, res, next) => {
  try {
    const { stage, payload, model, baseURL } = req.body || {};
    if (!stage || !payload) return res.status(400).json({ error: '缺少智能体阶段或输入数据' });
    const output = await runQuestionAgent({
      stage,
      payload,
      model,
      baseURL,
      apiKey: req.headers['x-openai-api-key'],
    });
    res.json(output);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
