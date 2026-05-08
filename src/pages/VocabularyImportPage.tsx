/**
 * 词库导入页面 - 支持多种格式导入单词
 */
import React, { useState, useCallback } from 'react';
import {
  ArrowLeft,
  Upload,
  FileText,
  FileSpreadsheet,
  Check,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { dialog } from '../components/ui/ConfirmDialog';
import {
  wordOperations,
  userVocabularyOperations,
} from '../lib/vocabulary-db';
import { cn, readFileContent, readFileAsArrayBuffer } from '../lib/utils';
import type { Word } from '../types/vocabulary';

interface VocabularyImportPageProps {
  bookId: string;
  bookName: string;
  onBack: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'complete';

// 列映射配置
interface ColumnMapping {
  word?: string;
  phoneticUs?: string;
  phoneticUk?: string;
  translation?: string;
  type?: string;
  phrases?: string;
  sentences?: string;
}

// 解析后的行数据
type ParsedRow = Record<string, string | undefined>;

export default function VocabularyImportPage({ bookId, bookName, onBack }: VocabularyImportPageProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: ParsedRow[] } | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [words, setWords] = useState<Word[]>([]);
  const [importErrors, setImportErrors] = useState<{ row: number; message: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // 获取文件类型
  const getFileType = (fileName: string): 'csv' | 'excel' | 'json' | 'text' | null => {
    const ext = fileName.toLowerCase().split('.').pop();
    if (ext === 'csv') return 'csv';
    if (ext === 'xlsx' || ext === 'xls') return 'excel';
    if (ext === 'json') return 'json';
    if (ext === 'txt') return 'text';
    return null;
  };

  // 解析CSV内容
  const parseCSV = (content: string): { headers: string[]; rows: ParsedRow[] } => {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      const row: ParsedRow = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      rows.push(row);
    }

    return { headers, rows };
  };

  // 解析Excel文件
  const parseExcel = async (buffer: ArrayBuffer): Promise<{ headers: string[]; rows: ParsedRow[] }> => {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 });

    if (data.length === 0) return { headers: [], rows: [] };

    const headers = (data[0] as string[]).map(h => String(h || '').trim());
    const rows: ParsedRow[] = [];

    for (let i = 1; i < data.length; i++) {
      const rowData = data[i] as string[];
      if (!rowData || rowData.length === 0) continue;
      const row: ParsedRow = {};
      headers.forEach((h, idx) => {
        row[h] = rowData[idx] !== undefined ? String(rowData[idx]).trim() : '';
      });
      rows.push(row);
    }

    return { headers, rows };
  };

  // 标准化翻译格式（兼容多种格式）
  const normalizeTranslations = (translations: any[]): { type: string; translation: string }[] => {
    if (!Array.isArray(translations)) return [];
    return translations.map(t => {
      if (typeof t === 'string') {
        return { type: '', translation: t };
      }
      return {
        type: String(t.type || t.pos || ''),
        translation: String(t.translation || t.cn || t.trans || t.meaning || ''),
      };
    }).filter(t => t.translation);
  };

  // 解析JSON文件
  const parseJSON = (content: string): Word[] => {
    const data = JSON.parse(content);
    const wordsData = Array.isArray(data) ? data : data.words || [];

    return wordsData.map((item: any, index: number) => {
      // 兼容 translations 和 trans 两种字段名
      const rawTranslations = item.translations || item.trans || [];
      
      return {
        id: `${bookId}-import-${Date.now()}-${index}`,
        bookId,
        word: item.word || item.name || '',
        phonetic: item.phonetic ? {
          us: item.phonetic.us || item.phonetic,
          uk: item.phonetic.uk,
        } : item.phonetic0 || item.phonetic1 ? {
          us: item.phonetic0,
          uk: item.phonetic1,
        } : undefined,
        translations: Array.isArray(rawTranslations)
          ? normalizeTranslations(rawTranslations)
          : [{ type: item.type || item.pos || 'n.', translation: item.translation || item.trans || item.cn || item.meaning || '' }],
        phrases: item.phrases?.map((p: any) => ({
          phrase: p.phrase || p.c || '',
          translation: p.translation || p.cn || '',
        })),
        sentences: item.sentences?.map((s: any) => ({
          sentence: s.sentence || s.c || '',
          translation: s.translation || s.cn || '',
        })),
        synonyms: item.synonyms || item.synos?.flatMap((s: any) => s.ws || []),
        antonyms: item.antonyms,
      };
    }).filter((w: Word) => w.word);
  };

  // 解析纯文本文件（每行一个单词，格式：word - translation）
  const parseText = (content: string): Word[] => {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    const words: Word[] = [];

    lines.forEach((line, index) => {
      // 支持多种分隔符：- / : / tab
      const match = line.match(/^([a-zA-Z\s'-]+)[\s]*[-/:|\t][\s]*(.+)$/);
      if (match) {
        const word = match[1].trim();
        const translation = match[2].trim();
        if (word && translation) {
          words.push({
            id: `${bookId}-import-${Date.now()}-${index}`,
            bookId,
            word,
            translations: [{ type: '', translation }],
          });
        }
      }
    });

    return words;
  };

  // 智能推荐列映射
  const suggestColumnMapping = (headers: string[]): ColumnMapping => {
    const mapping: ColumnMapping = {};
    const lowerHeaders = headers.map(h => h.toLowerCase());

    // 单词列
    const wordPatterns = ['word', 'english', '单词', '英文', 'vocabulary', 'term'];
    const wordIdx = lowerHeaders.findIndex(h => wordPatterns.some(p => h.includes(p)));
    if (wordIdx >= 0) mapping.word = headers[wordIdx];

    // 音标列
    const phoneticUsPatterns = ['phonetic_us', 'us_phonetic', '美式音标', 'american'];
    const phoneticUkPatterns = ['phonetic_uk', 'uk_phonetic', '英式音标', 'british'];
    const phoneticPatterns = ['phonetic', '音标', 'pronunciation'];
    
    const usIdx = lowerHeaders.findIndex(h => phoneticUsPatterns.some(p => h.includes(p)));
    if (usIdx >= 0) mapping.phoneticUs = headers[usIdx];
    
    const ukIdx = lowerHeaders.findIndex(h => phoneticUkPatterns.some(p => h.includes(p)));
    if (ukIdx >= 0) mapping.phoneticUk = headers[ukIdx];
    
    if (!mapping.phoneticUs && !mapping.phoneticUk) {
      const pIdx = lowerHeaders.findIndex(h => phoneticPatterns.some(p => h.includes(p)));
      if (pIdx >= 0) mapping.phoneticUs = headers[pIdx];
    }

    // 释义列
    const transPatterns = ['translation', 'meaning', 'definition', '释义', '翻译', '中文', 'chinese', 'trans'];
    const transIdx = lowerHeaders.findIndex(h => transPatterns.some(p => h.includes(p)));
    if (transIdx >= 0) mapping.translation = headers[transIdx];

    // 词性列
    const typePatterns = ['type', 'pos', 'part_of_speech', '词性'];
    const typeIdx = lowerHeaders.findIndex(h => typePatterns.some(p => h.includes(p)));
    if (typeIdx >= 0) mapping.type = headers[typeIdx];

    return mapping;
  };

  // 处理文件选择
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    const type = getFileType(selectedFile.name);
    if (!type) {
      dialog.warning('不支持的文件格式。请上传 CSV、Excel、JSON 或 TXT 文件。');
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      if (type === 'csv') {
        const content = await readFileContent(selectedFile);
        const data = parseCSV(content);
        setParsedData(data);
        const suggested = suggestColumnMapping(data.headers);
        setColumnMapping(suggested);
        setStep('mapping');
      } else if (type === 'excel') {
        const buffer = await readFileAsArrayBuffer(selectedFile);
        const data = await parseExcel(buffer);
        setParsedData(data);
        const suggested = suggestColumnMapping(data.headers);
        setColumnMapping(suggested);
        setStep('mapping');
      } else if (type === 'json') {
        const content = await readFileContent(selectedFile);
        const parsedWords = parseJSON(content);
        setWords(parsedWords);
        setStep('preview');
      } else if (type === 'text') {
        const content = await readFileContent(selectedFile);
        const parsedWords = parseText(content);
        if (parsedWords.length === 0) {
          dialog.warning('未能解析出任何单词，请检查文件格式。');
        } else {
          setWords(parsedWords);
          setStep('preview');
        }
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      dialog.error('文件解析失败，请检查文件格式。');
    } finally {
      setIsProcessing(false);
    }
  }, [bookId]);

  // 处理拖放
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  // 更新列映射
  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value || undefined
    }));
  };

  // 处理映射并生成单词
  const handleProcessMapping = () => {
    if (!parsedData || !columnMapping.word) return;

    setIsProcessing(true);
    const errors: { row: number; message: string }[] = [];
    const parsedWords: Word[] = [];

    try {
      parsedData.rows.forEach((row, index) => {
        const wordText = row[columnMapping.word!]?.trim();
        if (!wordText) {
          errors.push({ row: index + 2, message: '单词为空' });
          return;
        }

        const translation = row[columnMapping.translation || '']?.trim() || '';
        const type = row[columnMapping.type || '']?.trim() || '';

        const word: Word = {
          id: `${bookId}-import-${Date.now()}-${index}`,
          bookId,
          word: wordText,
          translations: translation ? [{ type, translation }] : [],
        };

        // 音标
        const phoneticUs = row[columnMapping.phoneticUs || '']?.trim();
        const phoneticUk = row[columnMapping.phoneticUk || '']?.trim();
        if (phoneticUs || phoneticUk) {
          word.phonetic = { us: phoneticUs, uk: phoneticUk };
        }

        parsedWords.push(word);
      });

      setWords(parsedWords);
      setImportErrors(errors);
      setStep('preview');
    } catch (error) {
      console.error('Error processing mapping:', error);
      dialog.error('处理失败，请检查映射配置。');
    } finally {
      setIsProcessing(false);
    }
  };

  // 执行导入
  const handleImport = async () => {
    if (words.length === 0) return;

    setIsProcessing(true);
    try {
      // 获取现有单词数量以生成唯一ID
      const existingWords = await wordOperations.getByBookId(bookId);
      const startIndex = existingWords.length;

      // 重新生成ID确保唯一
      const wordsToImport = words.map((w, i) => ({
        ...w,
        id: `${bookId}-${startIndex + i}`,
      }));

      await wordOperations.bulkAdd(wordsToImport);

      // 更新用户词库记录
      const userVocabs = await userVocabularyOperations.getAll();
      const userVocab = userVocabs.find(v => v.bookId === bookId);
      if (userVocab) {
        await userVocabularyOperations.updateProgress(bookId);
      }

      setStep('complete');
    } catch (error) {
      console.error('Error importing:', error);
      dialog.error('导入失败，请重试。');
    } finally {
      setIsProcessing(false);
    }
  };

  // 上传步骤
  const renderUploadStep = () => (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">上传词库文件</h2>
          <p className="text-gray-500 mt-1">支持 CSV、Excel、JSON 和纯文本格式</p>
        </CardHeader>
        <CardContent>
          {/* 拖放区域 */}
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
              dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('vocab-file-input')?.click()}
          >
            <input
              id="vocab-file-input"
              type="file"
              accept=".csv,.xlsx,.xls,.json,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">拖拽文件到这里，或点击选择文件</p>
            <p className="text-sm text-gray-400">支持 .csv, .xlsx, .json, .txt 格式</p>
          </div>

          {/* 格式说明 */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                <span className="font-medium">CSV/Excel</span>
              </div>
              <p className="text-xs text-gray-500">
                表格格式，包含单词、音标、释义等列。支持自定义列映射。
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-medium">JSON</span>
              </div>
              <p className="text-xs text-gray-500">
                结构化数据，支持完整的单词信息（音标、短语、例句等）。
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <span className="font-medium">纯文本</span>
              </div>
              <p className="text-xs text-gray-500">
                每行一个单词，格式：word - translation 或 word: translation
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-700">提示</span>
              </div>
              <p className="text-xs text-blue-600">
                推荐使用 JSON 格式导入，可保留更完整的单词信息。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // 映射步骤
  const renderMappingStep = () => (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">配置列映射</h2>
          <p className="text-gray-500 mt-1">将文件中的列映射到对应的单词字段</p>
        </CardHeader>
        <CardContent>
          {/* 文件信息 */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-6">
            <FileSpreadsheet className="w-5 h-5 text-gray-500" />
            <span className="text-sm text-gray-700">{file?.name}</span>
            <span className="text-xs text-gray-400">{parsedData?.rows.length} 行数据</span>
          </div>

          {/* 映射表单 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {[
              { key: 'word', label: '单词', required: true },
              { key: 'translation', label: '释义' },
              { key: 'type', label: '词性' },
              { key: 'phoneticUs', label: '美式音标' },
              { key: 'phoneticUk', label: '英式音标' },
            ].map(({ key, label, required }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {label} {required && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <select
                    value={columnMapping[key as keyof ColumnMapping] || ''}
                    onChange={(e) => handleMappingChange(key as keyof ColumnMapping, e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl appearance-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    <option value="">-- 选择列 --</option>
                    {parsedData?.headers.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            ))}
          </div>

          {/* 数据预览 */}
          {parsedData && parsedData.rows.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">数据预览（前5行）</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {parsedData.headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-gray-600 border-b">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b">
                        {parsedData.headers.map(h => (
                          <td key={h} className="px-3 py-2 text-gray-700 max-w-[200px] truncate">
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between mt-6">
        <Button variant="ghost" onClick={() => setStep('upload')}>
          <ArrowLeft size={18} className="mr-2" />
          返回
        </Button>
        <Button
          onClick={handleProcessMapping}
          isLoading={isProcessing}
          disabled={!columnMapping.word}
        >
          下一步
        </Button>
      </div>
    </div>
  );

  // 预览步骤
  const renderPreviewStep = () => (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">确认导入</h2>
              <p className="text-gray-500 mt-1">
                共解析 {words.length} 个单词
                {importErrors.length > 0 && (
                  <span className="text-amber-600 ml-2">({importErrors.length} 个警告)</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <Check size={14} className="inline mr-1" />
                {words.length} 有效
              </div>
              {importErrors.length > 0 && (
                <div className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                  <AlertCircle size={14} className="inline mr-1" />
                  {importErrors.length} 跳过
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 错误列表 */}
          {importErrors.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <h4 className="font-medium text-amber-800 mb-2">解析警告</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {importErrors.slice(0, 10).map((err, i) => (
                  <p key={i} className="text-sm text-amber-700">
                    第 {err.row} 行: {err.message}
                  </p>
                ))}
                {importErrors.length > 10 && (
                  <p className="text-sm text-amber-600">还有 {importErrors.length - 10} 个警告...</p>
                )}
              </div>
            </div>
          )}

          {/* 单词预览 */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {words.slice(0, 20).map((w, i) => (
              <div key={w.id} className="p-3 bg-gray-50 rounded-xl flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs font-medium flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{w.word}</span>
                    {w.phonetic?.us && (
                      <span className="text-xs text-gray-500">/{w.phonetic.us}/</span>
                    )}
                  </div>
                  {w.translations.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      {w.translations.map((t: any, idx) => {
                        // 确保获取正确的字段值（兼容多种格式）
                        const typeStr = String(t.type || t.pos || '');
                        const transStr = String(t.translation || t.cn || t.trans || t.meaning || '');
                        return (
                          <span key={idx}>
                            {typeStr && <span className="text-primary-600">{typeStr} </span>}
                            {transStr}
                            {idx < w.translations.length - 1 && '；'}
                          </span>
                        );
                      })}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {words.length > 20 && (
              <p className="text-center text-gray-500 py-2">还有 {words.length - 20} 个单词...</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between mt-6">
        <Button variant="ghost" onClick={() => setStep('upload')}>
          <ArrowLeft size={18} className="mr-2" />
          重新上传
        </Button>
        <Button
          onClick={handleImport}
          isLoading={isProcessing}
          disabled={words.length === 0}
        >
          确认导入 {words.length} 个单词
        </Button>
      </div>
    </div>
  );

  // 完成步骤
  const renderCompleteStep = () => (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">导入成功！</h2>
      <p className="text-gray-500 mb-8">
        已成功导入 {words.length} 个单词到「{bookName}」
      </p>
      <div className="flex gap-4 justify-center">
        <Button
          variant="secondary"
          onClick={() => {
            setStep('upload');
            setFile(null);
            setWords([]);
            setParsedData(null);
            setColumnMapping({});
            setImportErrors([]);
          }}
        >
          继续导入
        </Button>
        <Button onClick={onBack}>返回词库</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header
        className="liquid-glass-wrapper liquid-glass-header sticky top-0 z-10"
        style={{ '--border-radius': '0' } as React.CSSProperties}
      >
        <div className="liquid-glass-outer" />
        <div className="liquid-glass-cover" />
        <div className="liquid-glass-sharp" />
        <div className="liquid-glass-reflect" />
        <div className="liquid-glass-content">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/30 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-800">导入单词</h1>
              <p className="text-sm text-gray-600">{bookName}</p>
            </div>
          </div>
        </div>
      </header>

      {/* 进度步骤 */}
      <div className="max-w-2xl mx-auto px-6 py-6">
        <div className="flex items-center justify-center gap-2">
          {[
            { key: 'upload', label: '上传文件' },
            { key: 'mapping', label: '配置映射' },
            { key: 'preview', label: '预览确认' },
            { key: 'complete', label: '完成' }
          ].map((s, i) => (
            <React.Fragment key={s.key}>
              {i > 0 && <div className="w-8 h-0.5 bg-gray-200" />}
              <div className={cn(
                'flex items-center gap-2 px-3 py-1 rounded-full text-sm',
                step === s.key
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'text-gray-400'
              )}>
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-xs',
                  step === s.key ? 'bg-primary-500 text-white' : 'bg-gray-200'
                )}>
                  {i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 内容 */}
      <main className="max-w-6xl mx-auto px-6 pb-12">
        {isProcessing && step === 'upload' && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-4" />
            <p className="text-gray-600">正在解析文件...</p>
          </div>
        )}
        {step === 'upload' && !isProcessing && renderUploadStep()}
        {step === 'mapping' && renderMappingStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'complete' && renderCompleteStep()}
      </main>
    </div>
  );
}
