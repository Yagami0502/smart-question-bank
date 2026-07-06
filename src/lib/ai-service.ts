/**
 * AI服务模块 - 智能题目识别
 * 使用GPT API解析各种格式的题目文本
 */

import type { QuestionType } from '../types';

// AI 转换模式
export type ConversionMode = 'local' | 'ai';

// AI 配置接口
export interface AIConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  maxRetries: number;
  retryDelay: number;
}

// 用户 AI 设置接口
export interface UserAISettings {
  conversionMode: ConversionMode;
  aiConfig: {
    baseUrl: string;
    model: string;
    apiKey: string;
  };
}

// 默认 AI 配置
const DEFAULT_AI_CONFIG: AIConfig = {
  baseUrl: (import.meta.env.VITE_AI_BASE_URL as string | undefined) || 'https://api.openai.com',
  model: (import.meta.env.VITE_AI_MODEL as string | undefined) || 'gpt-4o-mini',
  apiKey: '',
  maxRetries: 3,
  retryDelay: 2000,
};

// 当前使用的配置（可被用户设置覆盖）
let AI_CONFIG: AIConfig = { ...DEFAULT_AI_CONFIG };

// 本地存储键名
const AI_SETTINGS_KEY = 'smart-question-bank-ai-settings';

/**
 * 获取用户 AI 设置
 */
export function getUserAISettings(): UserAISettings {
  try {
    const saved = localStorage.getItem(AI_SETTINGS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('读取 AI 设置失败:', e);
  }
  // 返回默认设置
  return {
    conversionMode: 'local',
    aiConfig: {
      baseUrl: DEFAULT_AI_CONFIG.baseUrl,
      model: DEFAULT_AI_CONFIG.model,
      apiKey: '',
    },
  };
}

/**
 * 保存用户 AI 设置
 */
export function saveUserAISettings(settings: UserAISettings): void {
  try {
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
    // 更新当前配置
    if (settings.conversionMode === 'ai' && settings.aiConfig.apiKey) {
      AI_CONFIG = {
        ...DEFAULT_AI_CONFIG,
        baseUrl: settings.aiConfig.baseUrl || DEFAULT_AI_CONFIG.baseUrl,
        model: settings.aiConfig.model || DEFAULT_AI_CONFIG.model,
        apiKey: settings.aiConfig.apiKey,
      };
    } else {
      AI_CONFIG = { ...DEFAULT_AI_CONFIG };
    }
  } catch (e) {
    console.error('保存 AI 设置失败:', e);
  }
}

/**
 * 获取当前转换模式
 */
export function getConversionMode(): ConversionMode {
  return getUserAISettings().conversionMode;
}

/**
 * 初始化 AI 配置（应用启动时调用）
 */
export function initAIConfig(): void {
  const settings = getUserAISettings();
  if (settings.conversionMode === 'ai' && settings.aiConfig.apiKey) {
    AI_CONFIG = {
      ...DEFAULT_AI_CONFIG,
      baseUrl: settings.aiConfig.baseUrl || DEFAULT_AI_CONFIG.baseUrl,
      model: settings.aiConfig.model || DEFAULT_AI_CONFIG.model,
      apiKey: settings.aiConfig.apiKey,
    };
  }
}

// 初始化配置
initAIConfig();

function hasAIKey(): boolean {
  return Boolean(AI_CONFIG.apiKey?.trim());
}

function assertAIConfigured(): void {
  if (!hasAIKey()) {
    throw new Error('请先在“设置 > AI 设置”中配置 API Key，再使用 AI 解析。');
  }
}

// AI解析后的题目结构
export interface AIParseResult {
  questions: AIQuestion[];
  rawResponse?: string;
  error?: string;
}

export interface AIQuestion {
  content: string;
  type: QuestionType;
  options: string[];
  correctAnswer: string | string[];
  explanation?: string;
  tags?: string[];
  difficulty?: number;
}

// 系统提示词
const SYSTEM_PROMPT = `你是一个专业的题目解析助手。你的任务是将用户提供的文本内容解析为结构化的题目数据。

请严格按照以下JSON格式输出，不要输出任何其他内容：
{
  "questions": [
    {
      "content": "题目内容（仅题干部分）",
      "type": "MCQ" | "MULTI" | "TRUE_FALSE" | "FILL" | "SHORT_ANSWER",
      "options": ["选项A内容", "选项B内容", "选项C内容", "选项D内容"],
      "correctAnswer": "A" 或 ["A", "B"] (多选题),
      "explanation": "完整的答案解析内容",
      "tags": ["标签1", "标签2"],
      "difficulty": 1-5 (难度等级)
    }
  ]
}

解析规则：
1. 单选题(MCQ): 只有一个正确答案
2. 多选题(MULTI): 有多个正确答案，correctAnswer为数组
3. 判断题(TRUE_FALSE): options为["正确", "错误"]或["对", "错"]或["T", "F"]
4. 填空题(FILL): 题目中用___或()表示空格，correctAnswer为填空答案
5. 简答题(SHORT_ANSWER): 无选项，correctAnswer为参考答案

**解析内容识别与格式化规则（非常重要）：**
- 识别以下标记后的所有内容作为explanation：
  - "解析："、"答案解析："、"深度解析："、"详解："、"分析："
  - "为什么选"、"为什么不选"、"解释："、"说明："
- 将所有解释性文字**完整保留**到explanation字段
- **排版格式要求**：使用换行符分隔不同部分，格式如下：
  【正确答案解析】
  为什么选X：...解释内容...
  
  【排除选项分析】
  为什么不选A：...
  为什么不选B：...
  为什么不选C：...
- 每个"为什么选/不选"独占一行，便于阅读
- 使用【】标记区分不同段落

注意:
- content只包含题干，不包含选项和解析
- options只包含选项内容，不包含选项字母前缀
- 正确识别答案标记（如：答案：A、正确答案：B、Answer: C等）
- 根据题目难度智能评估difficulty (1=简单, 3=中等, 5=困难)
- 从题目内容推断1-2个核心主题标签（使用通用的学科或领域名称，如：数学、物理、编程、历史等）
- 标签应该是高层次概念，避免过于具体的知识点
- 优先使用已知的学科分类，避免创造新标签`;

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 调用AI API解析题目（带重试）
 */
export async function parseWithAI(text: string, retryCount = 0): Promise<AIParseResult> {
  try {
    assertAIConfigured();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

    const response = await fetch(`${AI_CONFIG.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `请解析以下题目内容：\n\n${text}` },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      
      // 503错误时重试
      if (response.status === 503 && retryCount < AI_CONFIG.maxRetries) {
        console.warn(`⚠️ AI服务暂时不可用，${AI_CONFIG.retryDelay}ms后自动重试 (${retryCount + 1}/${AI_CONFIG.maxRetries})`);
        await delay(AI_CONFIG.retryDelay * (retryCount + 1));
        return parseWithAI(text, retryCount + 1);
      }
      
      const errorMsg = `AI API请求失败 [${response.status}]: ${errorData.substring(0, 200)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      // 空内容时重试
      if (retryCount < AI_CONFIG.maxRetries) {
        console.warn(`⚠️ AI返回空内容，${AI_CONFIG.retryDelay}ms后自动重试 (${retryCount + 1}/${AI_CONFIG.maxRetries})`);
        await delay(AI_CONFIG.retryDelay * (retryCount + 1));
        return parseWithAI(text, retryCount + 1);
      }
      const errorMsg = 'AI返回内容为空，请稍后重试';
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // 解析JSON响应
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      const errorMsg = `AI返回格式错误，无法解析为JSON格式`;
      console.error(`❌ ${errorMsg}\n返回内容: ${content.substring(0, 200)}...`);
      throw new Error(errorMsg);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // 验证和规范化结果
    const questions = (parsed.questions || []).map((q: any) => normalizeQuestion(q));

    return {
      questions,
      rawResponse: content,
    };
  } catch (error) {
    // 网络错误时重试
    if (error instanceof Error && 
        (error.name === 'AbortError' || error.message.includes('fetch')) && 
        retryCount < AI_CONFIG.maxRetries) {
      console.warn(`⚠️ 网络连接失败，${AI_CONFIG.retryDelay}ms后自动重试 (${retryCount + 1}/${AI_CONFIG.maxRetries})`);
      await delay(AI_CONFIG.retryDelay * (retryCount + 1));
      return parseWithAI(text, retryCount + 1);
    }

    const errorMsg = error instanceof Error ? error.message : '未知错误';
    console.error(`❌ AI解析失败: ${errorMsg}`);
    return {
      questions: [],
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 调用支持视觉能力的 OpenAI-compatible API，从截图/照片中提取题目并结构化。
 */
export async function parseImageWithAI(imageDataUrl: string, retryCount = 0): Promise<AIParseResult> {
  try {
    assertAIConfigured();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const response = await fetch(`${AI_CONFIG.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '请先识别图片中的题目文字，再按要求解析为结构化 JSON。若图片包含多道题，请全部提取。',
              },
              {
                type: 'image_url',
                image_url: { url: imageDataUrl },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      if (response.status === 503 && retryCount < AI_CONFIG.maxRetries) {
        await delay(AI_CONFIG.retryDelay * (retryCount + 1));
        return parseImageWithAI(imageDataUrl, retryCount + 1);
      }
      throw new Error(`AI 图片解析请求失败 [${response.status}]: ${errorData.substring(0, 200)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      if (retryCount < AI_CONFIG.maxRetries) {
        await delay(AI_CONFIG.retryDelay * (retryCount + 1));
        return parseImageWithAI(imageDataUrl, retryCount + 1);
      }
      throw new Error('AI 未返回图片解析结果，请换一张更清晰的图片或稍后重试。');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`AI 返回格式错误，无法解析为 JSON。返回内容: ${content.substring(0, 200)}...`);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      questions: (parsed.questions || []).map((q: any) => normalizeQuestion(q)),
      rawResponse: content,
    };
  } catch (error) {
    if (error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('fetch')) &&
        retryCount < AI_CONFIG.maxRetries) {
      await delay(AI_CONFIG.retryDelay * (retryCount + 1));
      return parseImageWithAI(imageDataUrl, retryCount + 1);
    }

    return {
      questions: [],
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 格式化解析文字 - 添加换行使其更易读
 */
function formatExplanation(text: string): string {
  if (!text) return '';
  
  let formatted = text.trim();
  
  // 在"为什么选"前添加换行（如果前面不是开头）
  formatted = formatted.replace(/([。！？\.])\s*(为什么选)/g, '$1\n\n$2');
  
  // 在"为什么不选"前添加换行
  formatted = formatted.replace(/([。！？\.])\s*(为什么不选)/g, '$1\n\n$2');
  
  // 在常见分段标记前添加换行
  formatted = formatted.replace(/([。！？\.])\s*(【[^】]+】)/g, '$1\n\n$2');
  
  // 处理连续的"为什么不选 A/B/C"，每个独立一行
  formatted = formatted.replace(/(为什么不选\s*[A-Z]（[^）]+）：[^为]+)/g, '$1\n');
  
  // 清理多余的空行
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  return formatted.trim();
}

/**
 * 规范化题目数据
 */
function normalizeQuestion(q: any): AIQuestion {
  // 确定题目类型
  let type: QuestionType = q.type || 'MCQ';
  if (!['MCQ', 'MULTI', 'TRUE_FALSE', 'FILL', 'SHORT_ANSWER'].includes(type)) {
    type = 'MCQ';
  }

  // 规范化选项 - 去除重复的选项字母前缀
  let options: string[] = [];
  if (Array.isArray(q.options)) {
    options = q.options.map((o: any) => {
      let text = String(o).trim();
      // 移除开头的选项字母前缀，如 "A. ", "A) ", "A、" 等
      text = text.replace(/^[A-Za-z][\.\)、\s]+/, '');
      return text.trim();
    });
  }

  // 规范化答案
  let correctAnswer: string | string[] = q.correctAnswer || '';
  if (type === 'MULTI' && !Array.isArray(correctAnswer)) {
    correctAnswer = [String(correctAnswer)];
  } else if (type !== 'MULTI' && Array.isArray(correctAnswer)) {
    correctAnswer = correctAnswer[0] || '';
  }

  // 规范化难度
  let difficulty = parseInt(q.difficulty) || 3;
  difficulty = Math.max(1, Math.min(5, difficulty));

  // 格式化解析文字
  let explanation = q.explanation ? formatExplanation(String(q.explanation)) : undefined;

  return {
    content: String(q.content || '').trim(),
    type,
    options,
    correctAnswer,
    explanation,
    tags: Array.isArray(q.tags) ? q.tags.map((t: any) => String(t).trim()) : [],
    difficulty,
  };
}

/**
 * 批量解析大量文本（分批处理）
 */
export async function parseWithAIBatch(
  text: string,
  onProgress?: (current: number, total: number) => void
): Promise<AIParseResult> {
  // 如果文本较短，直接解析
  if (text.length < 3000) {
    return parseWithAI(text);
  }

  // 按题目分隔符拆分文本
  const chunks = splitTextIntoChunks(text, 2500);
  const allQuestions: AIQuestion[] = [];
  const errors: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i + 1, chunks.length);
    
    const result = await parseWithAI(chunks[i]);
    
    if (result.error) {
      const errorMsg = `批次${i + 1}/${chunks.length}: ${result.error}`;
      errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    } else {
      allQuestions.push(...result.questions);
      console.log(`✅ 批次${i + 1}/${chunks.length} 解析成功，获得 ${result.questions.length} 道题目`);
    }

    // 添加延迟避免API限流
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return {
    questions: allQuestions,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

/**
 * 将文本按题目边界拆分成多个块
 */
function splitTextIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  
  // 尝试按题号分隔
  const questionPattern = /(?=(?:^|\n)\s*(?:\d+[\.\、\)）]|[一二三四五六七八九十]+[\.\、]))/g;
  const parts = text.split(questionPattern).filter(p => p.trim());

  let currentChunk = '';
  
  for (const part of parts) {
    if (currentChunk.length + part.length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = part;
    } else {
      currentChunk += part;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // 如果没有成功分割，按字符长度强制分割
  if (chunks.length === 0) {
    for (let i = 0; i < text.length; i += maxLength) {
      chunks.push(text.slice(i, i + maxLength));
    }
  }

  return chunks;
}

/**
 * 标签规范化映射表 - 将具体标签映射到通用类别
 */
const TAG_NORMALIZATION_MAP: Record<string, string> = {
  // 编程相关
  'JavaScript': '编程',
  'Python': '编程',
  'Java': '编程',
  'C++': '编程',
  'React': '编程',
  'Vue': '编程',
  '前端': '编程',
  '后端': '编程',
  '算法': '编程',
  '数据结构': '编程',
  '代码': '编程',
  '软件开发': '编程',
  '软件工程': '编程',
  '编程语言': '编程',
  
  // 数学相关
  '线性代数': '数学',
  '微积分': '数学',
  '概率论': '数学',
  '统计': '数学',
  '几何': '数学',
  '代数': '数学',
  '数论': '数学',
  
  // 科学相关
  '力学': '物理',
  '电磁学': '物理',
  '光学': '物理',
  '热学': '物理',
  '有机化学': '化学',
  '无机化学': '化学',
  '分析化学': '化学',
  '细胞生物学': '生物',
  '遗传学': '生物',
  '生态学': '生物',
  
  // 人文社科
  '古代史': '历史',
  '近代史': '历史',
  '世界史': '历史',
  '中国史': '历史',
  '语文语法': '语文',
  '文学': '语文',
  '阅读理解': '语文',
  '作文': '语文',
  '英语语法': '英语',
  '词汇': '英语',
  '听力': '英语',
  '英语阅读': '英语',
  
  // 其他
  '网络': '计算机',
  '数据库': '计算机',
  '操作系统': '计算机',
  '计算机网络': '计算机',
};

/**
 * 规范化标签 - 将具体标签映射到通用类别
 */
function normalizeTags(tags: string[]): string[] {
  const normalizedSet = new Set<string>();
  
  tags.forEach(tag => {
    const normalized = TAG_NORMALIZATION_MAP[tag] || tag;
    normalizedSet.add(normalized);
  });
  
  return Array.from(normalizedSet);
}

/**
 * AI智能提取题目标签（优化版）
 * 只提取1-2个核心主题标签
 */
export async function extractTags(questions: AIQuestion[]): Promise<string[]> {
  if (questions.length === 0) return [];

  const sampleContent = questions.slice(0, 5).map(q => q.content).join('\n');
  
  try {
    const response = await fetch(`${AI_CONFIG.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: `分析以下题目内容，提取1-2个核心学科标签。
要求：
1. 只输出JSON数组格式，如：["数学", "物理"]
2. 使用通用的学科名称：数学、物理、化学、生物、编程、计算机、历史、地理、语文、英语、经济、管理等
3. 避免过于具体的子领域名称
4. 最多2个标签`,
          },
          { role: 'user', content: sampleContent },
        ],
        temperature: 0.2,
        max_tokens: 100,
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      const tags = JSON.parse(match[0]);
      // 规范化标签
      return normalizeTags(tags).slice(0, 2);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    console.error(`❌ AI标签提取失败: ${errorMsg}`);
  }

  return [];
}

/**
 * AI生成题目解析
 */
export async function generateExplanation(question: AIQuestion): Promise<string> {
  try {
    const prompt = `题目：${question.content}
${question.options.length > 0 ? `选项：${question.options.join('、')}` : ''}
正确答案：${Array.isArray(question.correctAnswer) ? question.correctAnswer.join(', ') : question.correctAnswer}

请生成简洁的答案解析（不超过100字）：`;

    const response = await fetch(`${AI_CONFIG.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 200,
      }),
    });

    if (!response.ok) return '';

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    console.error(`❌ AI生成解析失败: ${errorMsg}`);
    return '';
  }
}

/**
 * 检测文本语言和格式
 */
export async function detectFormat(text: string): Promise<{
  language: 'zh' | 'en' | 'mixed';
  format: 'structured' | 'unstructured' | 'mixed';
  estimatedCount: number;
}> {
  // 简单的本地检测
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  
  const language = chineseChars > englishChars * 2 ? 'zh' : 
                   englishChars > chineseChars * 2 ? 'en' : 'mixed';

  // 检测题号模式
  const numberedPattern = /(?:^|\n)\s*(?:\d+[\.\、\)）]|[一二三四五六七八九十]+[\.\、])/g;
  const numberedMatches = text.match(numberedPattern) || [];
  
  const format = numberedMatches.length > 3 ? 'structured' : 
                 numberedMatches.length > 0 ? 'mixed' : 'unstructured';

  return {
    language,
    format,
    estimatedCount: Math.max(numberedMatches.length, 1),
  };
}


/**
 * 单选题转多选题的转换结果
 */
export interface ConvertedMultiQuestion {
  content: string;           // 反转后的题干
  options: string[];         // 选项内容不变
  correctAnswer: string[];   // 新的正确答案（原来的错误选项）
  explanation: string;       // 新的解析
  originalAnswer: string;    // 原单选题答案（用于参考）
}

/**
 * 将单选题转换为多选题（反转问法）
 * 原理：把"哪个正确"变成"哪些错误"，答案从原正确选项变成原错误选项
 */
export async function convertSingleToMulti(
  questionContent: string,
  options: string[],
  correctAnswer: string,
  _originalExplanation?: string
): Promise<ConvertedMultiQuestion | null> {
  // 计算新的正确答案（除了原正确答案以外的所有选项）
  const allLetters = options.map((_, i) => String.fromCharCode(65 + i));
  const newCorrectAnswers = allLetters.filter(letter => letter !== correctAnswer.toUpperCase());
  
  // 检查用户设置的转换模式
  const settings = getUserAISettings();
  
  // 如果是本地模式，或者 AI 模式但没有配置 API Key，直接使用本地转换
  if (settings.conversionMode === 'local' || !settings.aiConfig.apiKey) {
    return localConvert(questionContent, options, correctAnswer, newCorrectAnswers);
  }
  
  // AI 转换模式
  try {
    const prompt = `将单选题反转为多选题。只修改题干问法（如"正确的是"改成"错误的是"），选项不变。
题目：${questionContent}
原答案：${correctAnswer}
新答案：${newCorrectAnswers.join(',')}

只输出JSON：{"content":"反转后的题干"}`;

    const response = await fetch(`${AI_CONFIG.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.warn('AI请求失败，使用本地转换');
      return localConvert(questionContent, options, correctAnswer, newCorrectAnswers);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // 如果返回为空，直接使用本地转换
    if (!content || content.trim().length < 10) {
      console.warn('AI返回为空，使用本地转换');
      return localConvert(questionContent, options, correctAnswer, newCorrectAnswers);
    }
    
    // 清理 markdown 代码块
    const cleanContent = content.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
    
    // 尝试提取 content 字段的值（即使 JSON 不完整）
    let newQuestionContent: string | null = null;
    
    // 方法1: 尝试完整 JSON 解析
    const jsonMatch = cleanContent.match(/\{[^{}]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.content) {
          newQuestionContent = parsed.content;
        }
      } catch (e) {
        // JSON 解析失败，尝试其他方法
      }
    }
    
    // 方法2: 直接提取 content 字段值（处理截断的 JSON）
    if (!newQuestionContent) {
      const contentMatch = cleanContent.match(/"content"\s*:\s*"([^"]+)/);
      if (contentMatch && contentMatch[1] && contentMatch[1].length > 5) {
        let extractedContent = contentMatch[1];
        // 如果内容被截断，补全
        if (!extractedContent.endsWith('）') && !extractedContent.endsWith(')') && 
            !extractedContent.endsWith('。') && !extractedContent.endsWith('？')) {
          // 尝试从原题目中找到合适的结尾
          if (questionContent.includes('( )') || questionContent.includes('（ ）')) {
            extractedContent += questionContent.includes('( )') ? '( )' : '（ ）';
          }
        }
        newQuestionContent = extractedContent;
      }
    }
    
    // 如果成功提取到内容
    if (newQuestionContent && newQuestionContent.length > 5) {
      return {
        content: newQuestionContent,
        options: options,
        correctAnswer: newCorrectAnswers,
        explanation: `原正确答案是 ${correctAnswer}，反转后选择 ${newCorrectAnswers.join(', ')}。`,
        originalAnswer: correctAnswer,
      };
    }
    
    // 解析失败，使用本地转换
    return localConvert(questionContent, options, correctAnswer, newCorrectAnswers);
  } catch (error) {
    console.error('转换出错:', error);
    return localConvert(questionContent, options, correctAnswer, newCorrectAnswers);
  }
}

/**
 * 本地转换函数（备选方案，不依赖AI）
 * 返回 null 表示题目不适合反转
 */
function localConvert(
  questionContent: string,
  options: string[],
  correctAnswer: string,
  newCorrectAnswers: string[]
): ConvertedMultiQuestion | null {
  let newContent = questionContent;
  
  // 常见的反转模式（按优先级排序）
  const replacements: [RegExp, string][] = [
    // === 否定变肯定 ===
    [/不正确的是/g, '正确的是'],
    [/不合理的是/g, '合理的是'],
    [/不属于/g, '属于'],
    [/不包括/g, '包括'],
    [/不可以/g, '可以'],
    [/不能够/g, '能够'],
    [/不应该/g, '应该'],
    [/不被称为/g, '被称为'],
    [/错误的是/g, '正确的是'],
    [/以下哪些不是/g, '以下哪些是'],
    [/以下哪个不是/g, '以下哪些是'],
    [/下列哪个不是/g, '下列哪些是'],
    [/下列哪些不是/g, '下列哪些是'],
    [/不叫/g, '叫'],
    [/不称为/g, '称为'],
    [/不是指/g, '是指'],
    
    // === 肯定变否定 ===
    // "最XX的是" 类型 - 转换为 "不XX的是"
    [/最合理的是/g, '不合理的是'],
    [/最正确的是/g, '不正确的是'],
    [/最恰当的是/g, '不恰当的是'],
    [/最准确的是/g, '不准确的是'],
    [/最好的是/g, '不好的是'],
    [/最佳的是/g, '不佳的是'],
    
    // 一般肯定变否定
    [/正确的是/g, '错误的是'],
    [/合理的是/g, '不合理的是'],
    [/下列说法正确/g, '下列说法错误'],
    [/以下说法正确/g, '以下说法错误'],
    [/下列说法错误/g, '下列说法正确'],
    [/以下说法错误/g, '以下说法正确'],
    [/哪个是对的/g, '哪些是错的'],
    [/哪项正确/g, '哪些项错误'],
    [/正确的选项/g, '错误的选项'],
    [/被称为/g, '不被称为'],
    [/以下哪些/g, '以下哪些不是'],
    [/以下哪个/g, '以下哪些不是'],
    [/下列哪个/g, '下列哪些不是'],
    [/下列哪些/g, '下列哪些不是'],
    [/又叫/g, '不叫'],
    [/又称/g, '不称为'],
    [/也叫/g, '不叫'],
    [/也称/g, '不称为'],
    [/是指/g, '不是指'],
    [/指的是/g, '不是指'],
  ];
  
  let replaced = false;
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(newContent)) {
      newContent = newContent.replace(pattern, replacement);
      replaced = true;
      break;
    }
  }
  
  // 如果没有匹配到任何模式，尝试智能处理
  if (!replaced) {
    // 处理"是什么"类型的定义题
    if (newContent.match(/是什么[？?]?\s*[（(]\s*[)）]?$/)) {
      newContent = newContent.replace(/是什么/, '不是什么');
      replaced = true;
    }
    // 处理"适用于哪种/哪个情况"类型
    else if (newContent.match(/适用于(哪种|哪个|哪些)/)) {
      newContent = newContent.replace(/适用于(哪种|哪个|哪些)/, '不适用于哪些');
      replaced = true;
    }
    // 处理"属于哪种/哪个"类型
    else if (newContent.match(/属于(哪种|哪个|哪类)/)) {
      newContent = newContent.replace(/属于(哪种|哪个|哪类)/, '不属于哪些');
      replaced = true;
    }
    // 处理"是哪种/哪个"类型
    else if (newContent.match(/是(哪种|哪个|哪类)/)) {
      newContent = newContent.replace(/是(哪种|哪个|哪类)/, '不是哪些');
      replaced = true;
    }
    // 处理"哪个/哪项是"类型的选择题
    else if (newContent.match(/(哪个|哪项|哪种)是/)) {
      newContent = newContent.replace(/(哪个|哪项|哪种)是/, '哪些不是');
      replaced = true;
    }
    // 处理末尾的"哪个/哪项"（如"...的是哪个"）
    else if (newContent.match(/的是(哪个|哪项|哪种)/)) {
      newContent = newContent.replace(/的是(哪个|哪项|哪种)/, '的不是哪些');
      replaced = true;
    }
    // 如果题目以括号结尾（填空题形式），在前面加"不"
    else if (newContent.match(/（\s*）$/) || newContent.match(/\(\s*\)$/)) {
      // 尝试在关键动词前加"不"
      const verbPatterns = [
        { pattern: /是（/, replacement: '不是（' },
        { pattern: /为（/, replacement: '不为（' },
        { pattern: /叫（/, replacement: '不叫（' },
        { pattern: /称（/, replacement: '不称（' },
        { pattern: /有（/, replacement: '没有（' },
        { pattern: /属于（/, replacement: '不属于（' },
        { pattern: /包括（/, replacement: '不包括（' },
      ];
      
      for (const { pattern, replacement } of verbPatterns) {
        if (pattern.test(newContent)) {
          newContent = newContent.replace(pattern, replacement);
          replaced = true;
          break;
        }
      }
    }
  }
  
  // 如果仍然没有匹配，返回 null 表示这道题不适合转换
  if (!replaced) {
    return null;
  }
  
  return {
    content: newContent,
    options: options,
    correctAnswer: newCorrectAnswers,
    explanation: `这是一道反转题。原题正确答案是 ${correctAnswer}，现在选择其他选项 ${newCorrectAnswers.join(', ')}。`,
    originalAnswer: correctAnswer,
  };
}

/**
 * 批量转换单选题为多选题
 */
export async function convertBatchToMulti(
  questions: Array<{
    id: string;
    content: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
  }>,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, ConvertedMultiQuestion>> {
  const results = new Map<string, ConvertedMultiQuestion>();
  
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    onProgress?.(i + 1, questions.length);
    
    const converted = await convertSingleToMulti(
      q.content,
      q.options,
      q.correctAnswer,
      q.explanation
    );
    
    if (converted) {
      results.set(q.id, converted);
    }
    
    // 添加延迟避免API限流
    if (i < questions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  return results;
}
