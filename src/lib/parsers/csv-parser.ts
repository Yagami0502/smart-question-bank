/**
 * CSV/Excel 解析器
 * 支持 CSV 和 XLSX 格式的题目导入
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import type { Question, ImportConfig, ImportResult, ImportError, ColumnMapping, Option } from '../../types';

export interface ParsedRow {
  [key: string]: string | undefined;
}

/**
 * 解析 CSV 文件内容
 */
export function parseCSV(content: string): { headers: string[]; rows: ParsedRow[] } {
  const result = Papa.parse<ParsedRow>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim()
  });

  return {
    headers: result.meta.fields || [],
    rows: result.data
  };
}

/**
 * 解析 Excel 文件 (ArrayBuffer)
 */
export function parseExcel(buffer: ArrayBuffer): { headers: string[]; rows: ParsedRow[] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // 转换为 JSON
  const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    defval: ''
  });
  
  if (jsonData.length === 0) {
    return { headers: [], rows: [] };
  }
  
  // 第一行作为表头
  const headers = jsonData[0].map(h => String(h).trim());
  
  // 转换剩余行为对象
  const rows: ParsedRow[] = [];
  for (let i = 1; i < jsonData.length; i++) {
    const row: ParsedRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = String(jsonData[i][j] || '').trim();
    }
    rows.push(row);
  }
  
  return { headers, rows };
}

/**
 * 智能列名匹配
 * 根据常见的列名模式自动推荐映射
 */
export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  
  const patterns: Record<keyof ColumnMapping, RegExp[]> = {
    question: [/^(题目|问题|题干|question|q|content|题|内容)$/i],
    optionA: [/^(选项?a|a选?项?|option\s*a|a\.?|答案?a)$/i],
    optionB: [/^(选项?b|b选?项?|option\s*b|b\.?|答案?b)$/i],
    optionC: [/^(选项?c|c选?项?|option\s*c|c\.?|答案?c)$/i],
    optionD: [/^(选项?d|d选?项?|option\s*d|d\.?|答案?d)$/i],
    optionE: [/^(选项?e|e选?项?|option\s*e|e\.?|答案?e)$/i],
    answer: [/^(答案|正确答案|answer|correct|key|标准答案)$/i],
    explanation: [/^(解析|解答|解释|explanation|解题思路|详解|analysis)$/i],
    tags: [/^(标签|分类|类型|tags?|category|类别|知识点)$/i],
    difficulty: [/^(难度|difficulty|level|难易度|等级)$/i]
  };
  
  for (const header of headers) {
    for (const [field, regexList] of Object.entries(patterns)) {
      if (regexList.some(regex => regex.test(header))) {
        mapping[field as keyof ColumnMapping] = header;
        break;
      }
    }
  }
  
  return mapping;
}

/**
 * 从行数据中提取字段值
 */
function getFieldValue(row: ParsedRow, field: number | string | undefined): string {
  if (field === undefined) return '';
  
  if (typeof field === 'number') {
    const keys = Object.keys(row);
    return row[keys[field]] || '';
  }
  
  return row[field] || '';
}

/**
 * 解析答案字符串
 * 支持格式: "A", "A,B,C", "ABC", "1,2,3"
 */
function parseAnswerString(answerStr: string): string[] {
  const normalized = answerStr.toUpperCase().trim();
  
  // 检查是否是逗号分隔
  if (normalized.includes(',')) {
    return normalized.split(',').map(a => a.trim()).filter(a => a);
  }
  
  // 检查是否是连续字母 (如 "ABC")
  if (/^[A-E]+$/.test(normalized)) {
    return normalized.split('');
  }
  
  // 单个答案
  return [normalized];
}

/**
 * 将解析的行数据转换为题目对象
 */
export function rowToQuestion(
  row: ParsedRow,
  deckId: string,
  mapping: ColumnMapping,
  rowIndex: number
): { question: Question | null; errors: ImportError[] } {
  const errors: ImportError[] = [];
  
  // 获取题目内容
  const questionText = getFieldValue(row, mapping.question);
  if (!questionText) {
    errors.push({ row: rowIndex, field: 'question', message: '题目内容为空' });
    return { question: null, errors };
  }
  
  // 获取选项
  const options: Option[] = [];
  const optionFields: Array<keyof ColumnMapping> = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE'];
  const optionLabels = ['A', 'B', 'C', 'D', 'E'];
  
  for (let i = 0; i < optionFields.length; i++) {
    const optionText = getFieldValue(row, mapping[optionFields[i]]);
    if (optionText) {
      options.push({
        id: optionLabels[i],
        content: { text: optionText },
        isCorrect: false
      });
    }
  }
  
  // 获取答案
  const answerStr = getFieldValue(row, mapping.answer);
  const answers = parseAnswerString(answerStr);
  
  if (answers.length === 0 && options.length > 0) {
    errors.push({ row: rowIndex, field: 'answer', message: '答案为空' });
  }
  
  // 标记正确选项
  for (const option of options) {
    option.isCorrect = answers.includes(option.id);
  }
  
  // 确定题目类型
  const questionType = answers.length > 1 ? 'MULTI' : (options.length > 0 ? 'MCQ' : 'SHORT_ANSWER');
  
  // 获取其他字段
  const explanation = getFieldValue(row, mapping.explanation);
  const tagsStr = getFieldValue(row, mapping.tags);
  const tags = tagsStr ? tagsStr.split(/[,，;；]/).map(t => t.trim()).filter(t => t) : [];
  
  const difficultyStr = getFieldValue(row, mapping.difficulty);
  const difficulty = parseInt(difficultyStr) || 3;
  
  const question: Question = {
    id: uuidv4(),
    deckId,
    type: questionType,
    content: { text: questionText },
    options,
    answer: answers,
    explanation: explanation || undefined,
    tags,
    difficulty: Math.min(5, Math.max(1, difficulty)),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  return { question, errors };
}

/**
 * 执行完整的 CSV/Excel 导入
 */
export function importFromSpreadsheet(
  data: { headers: string[]; rows: ParsedRow[] },
  deckId: string,
  config: ImportConfig
): ImportResult {
  const result: ImportResult = {
    success: true,
    totalRows: data.rows.length,
    importedCount: 0,
    skippedCount: 0,
    errors: [],
    questions: []
  };
  
  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    const { question, errors } = rowToQuestion(row, deckId, config.columnMapping, i + 2); // +2 for 1-indexed and header row
    
    if (errors.length > 0) {
      result.errors.push(...errors);
    }
    
    if (question) {
      result.questions.push(question);
      result.importedCount++;
    } else {
      result.skippedCount++;
    }
  }
  
  result.success = result.importedCount > 0;
  
  return result;
}

/**
 * 预览导入数据 (前N行)
 */
export function previewImport(
  data: { headers: string[]; rows: ParsedRow[] },
  mapping: ColumnMapping,
  limit: number = 5
): Array<{
  rowIndex: number;
  question: string;
  options: string[];
  answer: string;
  valid: boolean;
}> {
  const preview: Array<{
    rowIndex: number;
    question: string;
    options: string[];
    answer: string;
    valid: boolean;
  }> = [];
  
  const rows = data.rows.slice(0, limit);
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const question = getFieldValue(row, mapping.question);
    const options = [
      getFieldValue(row, mapping.optionA),
      getFieldValue(row, mapping.optionB),
      getFieldValue(row, mapping.optionC),
      getFieldValue(row, mapping.optionD)
    ].filter(o => o);
    const answer = getFieldValue(row, mapping.answer);
    
    preview.push({
      rowIndex: i + 2,
      question: question.substring(0, 100) + (question.length > 100 ? '...' : ''),
      options,
      answer,
      valid: !!question && (options.length === 0 || !!answer)
    });
  }
  
  return preview;
}
