/**
 * Word 文本抽取工具
 */
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');

function detectWordFileType(filename = '', mimeType = '') {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.docx') || mimeType.includes('wordprocessingml')) {
    return 'docx';
  }
  if (lowerName.endsWith('.doc') || mimeType === 'application/msword') {
    return 'doc';
  }
  return null;
}

function normalizeExtractedText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u0007/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractWordText(buffer, filename, mimeType) {
  const fileType = detectWordFileType(filename, mimeType);
  if (!fileType) {
    throw new Error('仅支持 .docx 或 .doc 文件');
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('文件内容为空');
  }

  if (fileType === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return {
      fileType,
      text: normalizeExtractedText(result.value),
      warnings: Array.isArray(result.messages)
        ? result.messages.map(message => message.message)
        : [],
    };
  }

  const extractor = new WordExtractor();
  const document = await extractor.extract(buffer);
  return {
    fileType,
    text: normalizeExtractedText(document.getBody()),
    warnings: ['.doc 为兼容导入，建议优先转换为 .docx 以获得更稳定的解析结果'],
  };
}

module.exports = {
  detectWordFileType,
  normalizeExtractedText,
  extractWordText,
};
