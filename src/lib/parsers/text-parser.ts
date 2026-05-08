/**
 * 纯文本和 Markdown 解析器
 * 支持 Aiken 格式和自定义文本格式
 */

import { v4 as uuidv4 } from 'uuid';
import type { Question, Option, ImportResult, ImportError, QuestionType } from '../../types';

/**
 * Aiken 格式解析器
 * 
 * Aiken 格式示例:
 * ```
 * What is the capital of France?
 * A. London
 * B. Paris
 * C. Berlin
 * D. Madrid
 * ANSWER: B
 * 
 * Which planet is known as the Red Planet?
 * A) Earth
 * B) Mars
 * C) Jupiter
 * ANSWER: B
 * ```
 */
export function parseAikenFormat(content: string, deckId: string): ImportResult {
  const result: ImportResult = {
    success: true,
    totalRows: 0,
    importedCount: 0,
    skippedCount: 0,
    errors: [],
    questions: []
  };

  // 按空行分割题目块
  const blocks = content.trim().split(/\n\s*\n+/);
  result.totalRows = blocks.length;

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex].trim();
    if (!block) continue;

    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    
    if (lines.length < 3) {
      result.errors.push({
        row: blockIndex + 1,
        message: '题目格式不完整，至少需要题干、选项和答案'
      });
      result.skippedCount++;
      continue;
    }

    // 查找 ANSWER 行
    const answerLineIndex = lines.findIndex(l => /^ANSWER\s*[:：]\s*/i.test(l));
    
    if (answerLineIndex === -1) {
      result.errors.push({
        row: blockIndex + 1,
        message: '未找到 ANSWER 行'
      });
      result.skippedCount++;
      continue;
    }

    // 提取答案
    const answerLine = lines[answerLineIndex];
    const answerMatch = answerLine.match(/^ANSWER\s*[:：]\s*([A-E]+)/i);
    const correctAnswers = answerMatch ? answerMatch[1].toUpperCase().split('') : [];

    if (correctAnswers.length === 0) {
      result.errors.push({
        row: blockIndex + 1,
        field: 'answer',
        message: '无法解析答案'
      });
      result.skippedCount++;
      continue;
    }

    // 提取选项
    const options: Option[] = [];
    let questionEndIndex = answerLineIndex;
    
    // 选项模式: A. 或 A) 或 A、
    const optionRegex = /^([A-E])[.）\)、]\s*(.+)$/i;
    
    for (let i = 1; i < answerLineIndex; i++) {
      const match = lines[i].match(optionRegex);
      if (match) {
        if (questionEndIndex === answerLineIndex) {
          questionEndIndex = i;
        }
        const optionId = match[1].toUpperCase();
        options.push({
          id: optionId,
          content: { text: match[2] },
          isCorrect: correctAnswers.includes(optionId)
        });
      }
    }

    // 题干是第一行到第一个选项之间的内容
    const questionText = lines.slice(0, questionEndIndex).join(' ');

    if (!questionText) {
      result.errors.push({
        row: blockIndex + 1,
        field: 'question',
        message: '题目内容为空'
      });
      result.skippedCount++;
      continue;
    }

    const question: Question = {
      id: uuidv4(),
      deckId,
      type: correctAnswers.length > 1 ? 'MULTI' : 'MCQ',
      content: { text: questionText },
      options,
      answer: correctAnswers,
      tags: [],
      difficulty: 3,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    result.questions.push(question);
    result.importedCount++;
  }

  result.success = result.importedCount > 0;
  return result;
}

/**
 * 简单编号格式解析器
 * 
 * 格式示例:
 * ```
 * 1. 以下哪个是正确的？
 * A. 选项一
 * B. 选项二
 * C. 选项三
 * D. 选项四
 * 答案：B
 * 解析：这里是解析内容
 * 
 * 2. 第二道题...
 * ```
 */
export function parseNumberedFormat(content: string, deckId: string): ImportResult {
  const result: ImportResult = {
    success: true,
    totalRows: 0,
    importedCount: 0,
    skippedCount: 0,
    errors: [],
    questions: []
  };

  // 按题号分割
  const questionBlocks = content.split(/(?=^\d+[.、．]\s*)/m).filter(b => b.trim());
  result.totalRows = questionBlocks.length;

  for (let i = 0; i < questionBlocks.length; i++) {
    const block = questionBlocks[i].trim();
    if (!block) continue;

    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    
    // 提取题干 (移除题号)
    let questionText = lines[0].replace(/^\d+[.、．]\s*/, '');
    
    const options: Option[] = [];
    let answer: string[] = [];
    let explanation: string | undefined;
    
    // 解析剩余行
    const optionRegex = /^([A-E])[.）\)、．]\s*(.+)$/i;
    const answerRegex = /^(答案|正确答案|ANSWER)\s*[:：]\s*([A-E,，]+)/i;
    const explanationRegex = /^(解析|解答|解释)\s*[:：]\s*(.+)$/i;
    
    for (let j = 1; j < lines.length; j++) {
      const line = lines[j];
      
      const optionMatch = line.match(optionRegex);
      if (optionMatch) {
        const optionId = optionMatch[1].toUpperCase();
        options.push({
          id: optionId,
          content: { text: optionMatch[2] },
          isCorrect: false
        });
        continue;
      }
      
      const answerMatch = line.match(answerRegex);
      if (answerMatch) {
        answer = answerMatch[2].toUpperCase().split(/[,，]/).map(a => a.trim());
        continue;
      }
      
      const explainMatch = line.match(explanationRegex);
      if (explainMatch) {
        explanation = explainMatch[2];
        continue;
      }
      
      // 可能是题干的延续
      if (options.length === 0) {
        questionText += ' ' + line;
      }
    }

    // 标记正确答案
    for (const option of options) {
      option.isCorrect = answer.includes(option.id);
    }

    if (!questionText) {
      result.errors.push({ row: i + 1, message: '题目内容为空' });
      result.skippedCount++;
      continue;
    }

    const question: Question = {
      id: uuidv4(),
      deckId,
      type: determineQuestionType(options, answer),
      content: { text: questionText },
      options,
      answer,
      explanation,
      tags: [],
      difficulty: 3,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    result.questions.push(question);
    result.importedCount++;
  }

  result.success = result.importedCount > 0;
  return result;
}

/**
 * Markdown 格式解析器
 * 
 * 格式示例:
 * ```markdown
 * ## 题目1
 * 
 * 以下哪个是正确的？
 * 
 * - [ ] A. 选项一
 * - [x] B. 选项二 (正确答案)
 * - [ ] C. 选项三
 * 
 * > 解析：这是解析内容
 * 
 * ---
 * 
 * ## 题目2
 * ...
 * ```
 */
export function parseMarkdownFormat(content: string, deckId: string): ImportResult {
  const result: ImportResult = {
    success: true,
    totalRows: 0,
    importedCount: 0,
    skippedCount: 0,
    errors: [],
    questions: []
  };

  // 按标题或分隔线分割
  const blocks = content.split(/(?=^##\s+|^---$)/m).filter(b => b.trim() && !b.match(/^---\s*$/));
  result.totalRows = blocks.length;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    const lines = block.split('\n').map(l => l.trimEnd()).filter(l => l.trim());
    
    // 移除标题行
    let startIndex = 0;
    if (lines[0].startsWith('##')) {
      startIndex = 1;
    }

    // 查找题干
    let questionText = '';
    const options: Option[] = [];
    const answer: string[] = [];
    let explanation: string | undefined;

    // Checkbox 列表项模式
    const checkboxRegex = /^[-*]\s+\[([ xX])\]\s*([A-E])?[.、）\)]?\s*(.+)$/;
    // 普通列表项模式
    const listRegex = /^[-*]\s+([A-E])[.、）\)]\s*(.+)$/;
    // 引用模式 (解析)
    const quoteRegex = /^>\s*(解析|解答|解释)?\s*[:：]?\s*(.+)$/;

    let optionIndex = 0;
    const optionLabels = ['A', 'B', 'C', 'D', 'E'];

    for (let j = startIndex; j < lines.length; j++) {
      const line = lines[j];
      
      // Checkbox 模式
      const checkboxMatch = line.match(checkboxRegex);
      if (checkboxMatch) {
        const isChecked = checkboxMatch[1].toLowerCase() === 'x';
        const optionId = checkboxMatch[2]?.toUpperCase() || optionLabels[optionIndex];
        const optionText = checkboxMatch[3];
        
        options.push({
          id: optionId,
          content: { text: optionText },
          isCorrect: isChecked
        });
        
        if (isChecked) {
          answer.push(optionId);
        }
        
        optionIndex++;
        continue;
      }
      
      // 普通列表模式
      const listMatch = line.match(listRegex);
      if (listMatch) {
        const optionId = listMatch[1].toUpperCase();
        options.push({
          id: optionId,
          content: { text: listMatch[2] },
          isCorrect: false
        });
        continue;
      }
      
      // 引用模式
      const quoteMatch = line.match(quoteRegex);
      if (quoteMatch) {
        explanation = (explanation || '') + quoteMatch[2] + ' ';
        continue;
      }
      
      // 普通文本作为题干
      if (options.length === 0 && !line.startsWith('>')) {
        questionText += (questionText ? ' ' : '') + line;
      }
    }

    if (!questionText) {
      result.skippedCount++;
      continue;
    }

    const question: Question = {
      id: uuidv4(),
      deckId,
      type: determineQuestionType(options, answer),
      content: { text: questionText, html: questionText },
      options,
      answer,
      explanation: explanation?.trim(),
      tags: [],
      difficulty: 3,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    result.questions.push(question);
    result.importedCount++;
  }

  result.success = result.importedCount > 0;
  return result;
}

/**
 * 自动检测文本格式并解析
 */
export function autoParseText(content: string, deckId: string): ImportResult {
  const trimmedContent = content.trim();
  
  // 1. 检测 Aiken 格式 (包含 ANSWER: 行)
  if (/^ANSWER\s*[:：]/im.test(trimmedContent)) {
    return parseAikenFormat(trimmedContent, deckId);
  }
  
  // 2. 检测括号编号格式 **(1)** 或 (1) - 常见于中文习题集
  if (/\*{0,2}\s*[（\(]\s*\d+\s*[）\)]\s*\*{0,2}/m.test(trimmedContent)) {
    return parseParenthesisNumberFormat(trimmedContent, deckId);
  }
  
  // 3. 检测中文 Markdown 题库格式 (### 数字. 题目 + 正确答案：)
  if (/^###\s*\d+[.、．]/m.test(trimmedContent) && /正确答案\s*[:：]/m.test(trimmedContent)) {
    return parseChineseMarkdownFormat(trimmedContent, deckId);
  }
  
  // 4. 检测 Markdown checkbox 格式
  if (/^[-*]\s+\[[ xX]\]/m.test(trimmedContent)) {
    return parseMarkdownFormat(trimmedContent, deckId);
  }
  
  // 5. 检测通用中文题库格式 (有选项 + 有答案标记)
  const hasOptions = /^[A-E][.、．）\)]\s*.+/m.test(trimmedContent) || /^[-*]\s*[A-E][.、．）\)]/m.test(trimmedContent);
  const hasAnswer = /(?:正确答案|答案|参考答案)\s*[:：]/m.test(trimmedContent);
  if (hasOptions && hasAnswer) {
    return parseUniversalChineseFormat(trimmedContent, deckId);
  }
  
  // 6. 检测纯编号格式 (1. 或 1、 或 一、)
  if (/^(?:\d+|[一二三四五六七八九十]+)[.、．]\s*/m.test(trimmedContent)) {
    return parseUniversalChineseFormat(trimmedContent, deckId);
  }
  
  // 7. 检测 Markdown 标题格式
  if (/^##\s+/m.test(trimmedContent)) {
    return parseMarkdownFormat(trimmedContent, deckId);
  }
  
  // 8. 默认使用通用解析器
  return parseUniversalChineseFormat(trimmedContent, deckId);
}

/**
 * 通用中文题库格式解析器
 * 支持多种常见格式：
 * - 数字编号: 1. 或 1、 或 1）
 * - 中文编号: 一、 二、
 * - 括号编号: (1) 或 （1）
 * - 选项格式: A. 或 A、 或 A) 或 (A)
 * - 答案格式: 答案：A 或 正确答案：A 或 【答案】A
 */
export function parseUniversalChineseFormat(content: string, deckId: string): ImportResult {
  const result: ImportResult = {
    success: true,
    totalRows: 0,
    importedCount: 0,
    skippedCount: 0,
    errors: [],
    questions: []
  };

  // 多种题目分隔模式
  const questionPatterns = [
    /(?=^###\s*\d+[.、．])/m,                          // ### 1.
    /(?=^##\s*\d+[.、．])/m,                           // ## 1.
    /(?=^\d+[.、．）\)]\s*[^\d])/m,                     // 1. 或 1、 或 1）
    /(?=^[一二三四五六七八九十]+[.、．]\s*)/m,           // 一、
    /(?=^[（\(]\d+[）\)]\s*)/m,                        // (1) 或 （1）
    /(?=^第\s*\d+\s*题)/m,                             // 第1题
    /(?=^题目\s*\d+)/m,                                // 题目1
  ];

  // 尝试找到最佳分隔模式
  let blocks: string[] = [];
  for (const pattern of questionPatterns) {
    const tempBlocks = content.split(pattern).filter(b => b.trim());
    if (tempBlocks.length > blocks.length) {
      blocks = tempBlocks;
    }
  }

  // 如果没有找到分隔，尝试按空行+选项模式分割
  if (blocks.length <= 1) {
    blocks = content.split(/\n\s*\n+(?=.*[A-E][.、．）\)])/m).filter(b => b.trim());
  }

  result.totalRows = blocks.length;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    try {
      const question = parseQuestionBlock(block, deckId, i + 1);
      if (question) {
        result.questions.push(question);
        result.importedCount++;
      } else {
        result.skippedCount++;
      }
    } catch (error) {
      result.errors.push({ 
        row: i + 1, 
        message: error instanceof Error ? error.message : '解析错误' 
      });
      result.skippedCount++;
    }
  }

  result.success = result.importedCount > 0;
  return result;
}

/**
 * 解析单个题目块
 */
function parseQuestionBlock(block: string, deckId: string, _index: number): Question | null {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return null;

  // 题干提取 - 移除各种编号前缀
  let questionText = lines[0]
    .replace(/^#+\s*/, '')                              // 移除 # ## ###
    .replace(/^\d+[.、．）\)]\s*/, '')                   // 移除 1. 1、 1）
    .replace(/^[一二三四五六七八九十]+[.、．]\s*/, '')    // 移除 一、
    .replace(/^[（\(]\d+[）\)]\s*/, '')                  // 移除 (1)
    .replace(/^第\s*\d+\s*题[.、：:\s]*/, '')            // 移除 第1题
    .replace(/^题目\s*\d+[.、：:\s]*/, '')               // 移除 题目1
    .trim();

  const options: Option[] = [];
  let answer: string[] = [];
  let explanation: string | undefined;
  let explanationLines: string[] = [];

  // 选项匹配模式
  const optionPatterns = [
    /^[-*]\s*([A-E])[.、．）\)]\s*(.+)$/,              // - A. xxx
    /^([A-E])[.、．）\)]\s*(.+)$/,                      // A. xxx
    /^[（\(]([A-E])[）\)]\s*(.+)$/,                     // (A) xxx
  ];

  // 答案匹配模式
  const answerPatterns = [
    /(?:正确答案|答案|参考答案|【答案】)\s*[:：]?\s*\**([A-E,，、]+)\**/i,
    /\**答案\**\s*[:：]?\s*\**([A-E,，、]+)\**/i,
  ];

  // 解析匹配模式
  const explanationPatterns = [
    /(?:深度解析|解析|解答|详解|【解析】|【详解】)\s*[:：]?\s*(.*)/i,
  ];

  for (let j = 1; j < lines.length; j++) {
    let line = lines[j];
    const cleanLine = line.replace(/^>\s*/, '').replace(/^\*+/, '').replace(/\*+$/, '');

    // 尝试匹配选项
    let optionMatched = false;
    for (const pattern of optionPatterns) {
      const match = cleanLine.match(pattern);
      if (match) {
        const optionId = match[1].toUpperCase();
        // 避免重复添加同一选项
        if (!options.find(o => o.id === optionId)) {
          options.push({
            id: optionId,
            content: { text: match[2].trim() },
            isCorrect: false
          });
        }
        optionMatched = true;
        break;
      }
    }
    if (optionMatched) continue;

    // 尝试匹配答案
    let answerMatched = false;
    for (const pattern of answerPatterns) {
      const match = cleanLine.match(pattern);
      if (match) {
        answer = match[1].toUpperCase()
          .replace(/[,，、\s]/g, '')
          .split('')
          .filter(a => /[A-E]/.test(a));
        answerMatched = true;
        break;
      }
    }
    if (answerMatched) continue;

    // 尝试匹配解析
    for (const pattern of explanationPatterns) {
      const match = cleanLine.match(pattern);
      if (match) {
        if (match[1]) explanationLines.push(match[1]);
        continue;
      }
    }

    // 收集解析内容（引用块或解析后的内容）
    if (explanationLines.length > 0 && (line.startsWith('>') || /^[-*]/.test(line))) {
      explanationLines.push(cleanLine);
    }
    
    // 如果还没有选项，可能是多行题干
    if (options.length === 0 && !cleanLine.match(/^[>【]/)) {
      questionText += ' ' + cleanLine;
    }
  }

  // 标记正确答案
  for (const option of options) {
    option.isCorrect = answer.includes(option.id);
  }

  // 合并解析 - 清理 Markdown 符号并保持换行
  if (explanationLines.length > 0) {
    explanation = explanationLines
      .map(line => {
        return line
          .replace(/^\s*[-*]\s*/, '• ')           // 将 - 或 * 列表转为 • 
          .replace(/\*\*([^*]+)\*\*/g, '$1')      // 移除 **粗体**
          .replace(/\*([^*]+)\*/g, '$1')          // 移除 *斜体*
          .replace(/__([^_]+)__/g, '$1')          // 移除 __粗体__
          .replace(/_([^_]+)_/g, '$1')            // 移除 _斜体_
          .replace(/`([^`]+)`/g, '$1')            // 移除 `代码`
          .replace(/^>\s*/, '')                    // 移除引用符号
          .trim();
      })
      .filter(line => line.length > 0)
      .join('\n');
  }

  // 验证题目有效性
  if (!questionText || options.length < 2) {
    return null;
  }

  return {
    id: uuidv4(),
    deckId,
    type: determineQuestionType(options, answer),
    content: { text: questionText },
    options,
    answer: answer.length === 1 ? answer[0] : answer,
    explanation,
    tags: [],
    difficulty: 3,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

/**
 * 中文 Markdown 题库格式解析器
 * 
 * 格式示例:
 * ```markdown
 * ### 1. 下列造成缺陷的原因中引入缺陷最多的是（）
 * 
 * - A. 编码
 * - B. 系统设计
 * - C. 详细设计
 * - D. 规格说明书
 * 
 * > **正确答案：D**
 * > **深度解析**：...
 * ```
 */
export function parseChineseMarkdownFormat(content: string, deckId: string): ImportResult {
  const result: ImportResult = {
    success: true,
    totalRows: 0,
    importedCount: 0,
    skippedCount: 0,
    errors: [],
    questions: []
  };

  // 按 ### 数字. 分割题目
  const questionPattern = /(?=^###\s*\d+[.、．])/m;
  const blocks = content.split(questionPattern).filter(b => b.trim() && /^###\s*\d+/.test(b.trim()));
  result.totalRows = blocks.length;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    try {
      const lines = block.split('\n');
      
      // 提取题干 (第一行，移除 ### 和题号)
      let questionText = lines[0].replace(/^###\s*\d+[.、．]\s*/, '').trim();
      
      const options: Option[] = [];
      let answer: string[] = [];
      let explanation: string | undefined;
      
      // 选项模式: - A. 或 - A、 或 * A.
      const optionRegex = /^[-*]\s*([A-E])[.、．）\)]\s*(.+)$/;
      // 答案模式: 正确答案：X 或 **正确答案：X**
      const answerRegex = /\*{0,2}正确答案\s*[:：]\s*\*{0,2}\s*([A-E,，]+)/;
      // 解析模式
      const explanationStartRegex = /深度解析|解析|解答/;
      
      let inExplanation = false;
      let explanationLines: string[] = [];
      
      for (let j = 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (!line) continue;
        
        // 检查选项
        const optionMatch = line.match(optionRegex);
        if (optionMatch) {
          const optionId = optionMatch[1].toUpperCase();
          options.push({
            id: optionId,
            content: { text: optionMatch[2].trim() },
            isCorrect: false
          });
          continue;
        }
        
        // 检查答案 (可能在引用块中)
        const cleanLine = line.replace(/^>\s*/, '');
        const answerMatch = cleanLine.match(answerRegex);
        if (answerMatch) {
          answer = answerMatch[1].toUpperCase().replace(/[,，]/g, '').split('').filter(a => /[A-E]/.test(a));
          continue;
        }
        
        // 检查解析开始
        if (explanationStartRegex.test(cleanLine)) {
          inExplanation = true;
          const explainContent = cleanLine.replace(/^>\s*/, '').replace(/\*{1,2}(深度解析|解析|解答)\*{0,2}\s*[:：]?\s*/, '');
          if (explainContent) {
            explanationLines.push(explainContent);
          }
          continue;
        }
        
        // 收集解析内容
        if (inExplanation && line.startsWith('>')) {
          explanationLines.push(cleanLine.replace(/^\*{0,2}/, '').replace(/\*{0,2}$/, ''));
        }
      }
      
      // 标记正确答案
      for (const option of options) {
        option.isCorrect = answer.includes(option.id);
      }
      
      // 合并解析 - 清理 Markdown 符号并保持换行
      if (explanationLines.length > 0) {
        explanation = explanationLines
          .map(line => {
            return line
              .replace(/^\s*[-*]\s*/, '• ')           // 将 - 或 * 列表转为 • 
              .replace(/\*\*([^*]+)\*\*/g, '$1')      // 移除 **粗体**
              .replace(/\*([^*]+)\*/g, '$1')          // 移除 *斜体*
              .replace(/__([^_]+)__/g, '$1')          // 移除 __粗体__
              .replace(/_([^_]+)_/g, '$1')            // 移除 _斜体_
              .replace(/`([^`]+)`/g, '$1')            // 移除 `代码`
              .replace(/^>\s*/, '')                    // 移除引用符号
              .trim();
          })
          .filter(line => line.length > 0)
          .join('\n');
      }

      if (!questionText || options.length === 0) {
        result.errors.push({ row: i + 1, message: '题目或选项为空' });
        result.skippedCount++;
        continue;
      }

      const question: Question = {
        id: uuidv4(),
        deckId,
        type: determineQuestionType(options, answer),
        content: { text: questionText },
        options,
        answer: answer.length === 1 ? answer[0] : answer,
        explanation,
        tags: [],
        difficulty: 3,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      result.questions.push(question);
      result.importedCount++;
    } catch (error) {
      result.errors.push({ row: i + 1, message: '解析错误: ' + (error instanceof Error ? error.message : String(error)) });
      result.skippedCount++;
    }
  }

  result.success = result.importedCount > 0;
  return result;
}

/**
 * 确定题目类型
 */
function determineQuestionType(options: Option[], answer: string[]): QuestionType {
  if (options.length === 0) {
    return 'SHORT_ANSWER';
  }
  
  if (options.length === 2 && 
      options.some(o => /^(是|对|正确|true|yes)$/i.test(o.content.text)) &&
      options.some(o => /^(否|错|错误|false|no)$/i.test(o.content.text))) {
    return 'TRUE_FALSE';
  }
  
  if (answer.length > 1) {
    return 'MULTI';
  }
  
  return 'MCQ';
}

/**
 * 括号编号格式解析器
 * 
 * 支持格式：
 * **(1) 题目内容 ( )。**
 * A. 选项一
 * B. 选项二
 * **C. 正确答案**  <- 加粗表示正确答案
 * D. 选项四
 * 
 * 或者带有 参考答案：X 的格式
 */
export function parseParenthesisNumberFormat(content: string, deckId: string): ImportResult {
  const result: ImportResult = {
    success: true,
    totalRows: 0,
    importedCount: 0,
    skippedCount: 0,
    errors: [],
    questions: []
  };

  // 按 **(数字)** 或 (数字) 分割题目
  // 匹配模式: \*{0,2}\s*[（(]\s*\d+\s*[）)]\s*\*{0,2}
  const questionSplitPattern = /(?=\*{0,2}\s*[（\(]\s*\d+\s*[）\)]\s*\*{0,2}\s*[^）\)A-E])/;
  
  const blocks = content.split(questionSplitPattern).filter(b => {
    const trimmed = b.trim();
    // 过滤掉空块和纯标题块（如 ### 1. 选择题）
    return trimmed && /[（\(]\s*\d+\s*[）\)]/.test(trimmed);
  });

  result.totalRows = blocks.length;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    try {
      const question = parseParenthesisQuestionBlock(block, deckId, i + 1);
      if (question) {
        result.questions.push(question);
        result.importedCount++;
      } else {
        result.skippedCount++;
      }
    } catch (error) {
      result.errors.push({
        row: i + 1,
        message: error instanceof Error ? error.message : '解析错误'
      });
      result.skippedCount++;
    }
  }

  result.success = result.importedCount > 0;
  return result;
}

/**
 * 解析单个括号编号题目块
 */
function parseParenthesisQuestionBlock(block: string, deckId: string, _index: number): Question | null {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return null;

  // 提取题干 - 移除 **(1)** 或 (1) 前缀
  let questionText = lines[0]
    .replace(/^\*{1,2}\s*[（\(]\s*\d+\s*[）\)]\s*\*{0,2}\s*/, '')  // 移除 **(1)** 或 (1)
    .replace(/\*{1,2}$/, '')  // 移除末尾的 **
    .replace(/\s*[（\(]\s*[）\)]\s*[。.]*\s*\*{0,2}$/, '')  // 移除末尾的 ( )。**
    .trim();

  const options: Option[] = [];
  let answer: string[] = [];
  let explanation: string | undefined;
  let explanationLines: string[] = [];

  // 选项匹配模式 - 支持加粗选项表示正确答案
  // **A. xxx** 或 **A. xxx 或 A. xxx**
  const boldOptionPattern = /^\*{2}\s*([A-E])[.、．）\)]\s*(.+?)\s*\*{0,2}$/;
  const normalOptionPattern = /^([A-E])[.、．）\)]\s*(.+)$/;
  
  // 答案匹配模式
  const answerPatterns = [
    /(?:正确答案|答案|参考答案|【答案】)\s*[:：]?\s*\**([A-E,，、]+)\**/i,
    /\**答案\**\s*[:：]?\s*\**([A-E,，、]+)\**/i,
  ];

  // 解析匹配模式
  const explanationPatterns = [
    /(?:深度解析|解析|解答|详解|【解析】|【详解】)\s*[:：]?\s*(.*)/i,
  ];

  let inExplanation = false;

  for (let j = 1; j < lines.length; j++) {
    let line = lines[j];
    
    // 跳过章节标题
    if (/^#{1,3}\s*\d*[.、．]?\s*(选择题|填空题|简答题|判断题)/.test(line)) {
      continue;
    }

    // 检查加粗选项（表示正确答案）
    const boldMatch = line.match(boldOptionPattern);
    if (boldMatch) {
      const optionId = boldMatch[1].toUpperCase();
      const optionText = boldMatch[2].replace(/\*+$/, '').trim();
      if (!options.find(o => o.id === optionId)) {
        options.push({
          id: optionId,
          content: { text: optionText },
          isCorrect: true  // 加粗选项为正确答案
        });
        if (!answer.includes(optionId)) {
          answer.push(optionId);
        }
      }
      continue;
    }

    // 检查普通选项
    const normalMatch = line.match(normalOptionPattern);
    if (normalMatch) {
      const optionId = normalMatch[1].toUpperCase();
      const optionText = normalMatch[2].trim();
      if (!options.find(o => o.id === optionId)) {
        options.push({
          id: optionId,
          content: { text: optionText },
          isCorrect: false
        });
      }
      continue;
    }

    // 检查答案行
    let answerMatched = false;
    for (const pattern of answerPatterns) {
      const match = line.match(pattern);
      if (match) {
        const parsedAnswers = match[1].toUpperCase()
          .replace(/[,，、\s]/g, '')
          .split('')
          .filter(a => /[A-E]/.test(a));
        // 合并答案（可能从加粗选项和答案行都获取到）
        for (const a of parsedAnswers) {
          if (!answer.includes(a)) {
            answer.push(a);
          }
        }
        answerMatched = true;
        break;
      }
    }
    if (answerMatched) continue;

    // 检查解析开始
    for (const pattern of explanationPatterns) {
      const match = line.match(pattern);
      if (match) {
        inExplanation = true;
        if (match[1]) {
          explanationLines.push(match[1].replace(/^\*+/, '').replace(/\*+$/, ''));
        }
        break;
      }
    }

    // 收集解析内容
    if (inExplanation) {
      const cleanLine = line
        .replace(/^>\s*/, '')
        .replace(/^\*+/, '')
        .replace(/\*+$/, '')
        .trim();
      if (cleanLine && !explanationPatterns.some(p => p.test(line))) {
        explanationLines.push(cleanLine);
      }
    }
  }

  // 根据答案标记正确选项
  if (answer.length > 0) {
    for (const option of options) {
      option.isCorrect = answer.includes(option.id);
    }
  }

  // 合并解析
  if (explanationLines.length > 0) {
    explanation = explanationLines
      .map(line => {
        return line
          .replace(/^\s*[-*]\s*/, '• ')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .trim();
      })
      .filter(line => line.length > 0)
      .join('\n');
  }

  // 验证题目有效性
  if (!questionText || options.length < 2) {
    return null;
  }

  return {
    id: uuidv4(),
    deckId,
    type: determineQuestionType(options, answer),
    content: { text: questionText },
    options,
    answer: answer.length === 1 ? answer[0] : answer,
    explanation,
    tags: [],
    difficulty: 3,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}
