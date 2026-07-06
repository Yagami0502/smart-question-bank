import React, { useState, useCallback } from 'react';
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  FileSpreadsheet, 
  File,
  Check,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Loader2,
  Brain
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { dialog } from '../components/ui/ConfirmDialog';
import { useAppStore } from '../stores/appStore';
import { parseCSV, parseExcel, suggestColumnMapping, importFromSpreadsheet } from '../lib/parsers/csv-parser';
import { autoParseText } from '../lib/parsers/text-parser';
import { parseImageWithAI, parseWithAIBatch } from '../lib/ai-service';
import { readFileContent, readFileAsArrayBuffer, readFileAsDataURL, cn } from '../lib/utils';
import type { Deck, ColumnMapping, Question } from '../types';

// 定义 ParsedRow 类型
type ParsedRow = Record<string, string | undefined>;

interface ImportPageProps {
  deck: Deck;
  onBack: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'complete' | 'ai-input';

export default function ImportPage({ deck, onBack }: ImportPageProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: ParsedRow[] } | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [questions, setQuestions] = useState<Question[]>([]);
  const [importErrors, setImportErrors] = useState<{ row: number; message: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });
  const [aiError, setAiError] = useState<string | null>(null);
  
  const { importQuestions } = useAppStore();

  const getFileType = (fileName: string): 'csv' | 'excel' | 'text' | 'image' | null => {
    const ext = fileName.toLowerCase().split('.').pop();
    if (ext === 'csv') return 'csv';
    if (ext === 'xlsx' || ext === 'xls') return 'excel';
    if (ext === 'txt' || ext === 'md') return 'text';
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) return 'image';
    return null;
  };

  const convertAIQuestions = (aiQuestions: Awaited<ReturnType<typeof parseWithAIBatch>>['questions']): Question[] => (
    aiQuestions.map((q, index) => ({
      id: `ai-${Date.now()}-${index}`,
      deckId: deck.id,
      type: q.type,
      content: { text: q.content },
      options: q.options.map((opt, i) => ({
        id: String.fromCharCode(65 + i),
        content: { text: opt },
        isCorrect: Array.isArray(q.correctAnswer) 
          ? q.correctAnswer.includes(String.fromCharCode(65 + i))
          : q.correctAnswer === String.fromCharCode(65 + i)
      })),
      answer: q.correctAnswer,
      explanation: q.explanation,
      tags: q.tags || [],
      difficulty: q.difficulty || 3,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))
  );

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    const type = getFileType(selectedFile.name);
    if (!type) {
      dialog.warning('不支持的文件格式。请上传 CSV、Excel、文本或图片文件。');
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
        const data = parseExcel(buffer);
        setParsedData(data);
        const suggested = suggestColumnMapping(data.headers);
        setColumnMapping(suggested);
        setStep('mapping');
      } else if (type === 'text') {
        const content = await readFileContent(selectedFile);
        const result = autoParseText(content, deck.id);
        setQuestions(result.questions);
        setImportErrors(result.errors);
        setStep('preview');
      } else if (type === 'image') {
        setAiProgress({ current: 1, total: 1 });
        const imageDataUrl = await readFileAsDataURL(selectedFile);
        const result = await parseImageWithAI(imageDataUrl);
        if (result.error) {
          setAiError(result.error);
          dialog.error(result.error);
          return;
        }
        if (result.questions.length === 0) {
          dialog.warning('未能从图片中识别出题目，请上传更清晰的截图或照片。');
          return;
        }
        setQuestions(convertAIQuestions(result.questions));
        setImportErrors([]);
        setStep('preview');
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      dialog.error('文件解析失败，请检查文件格式。');
    } finally {
      setIsProcessing(false);
    }
  }, [deck.id]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value || undefined
    }));
  };

  const handleProcessMapping = () => {
    if (!parsedData) return;
    
    setIsProcessing(true);
    try {
      const result = importFromSpreadsheet(parsedData, deck.id, {
        hasHeader: true,
        columnMapping
      });
      setQuestions(result.questions);
      setImportErrors(result.errors);
      setStep('preview');
    } catch (error) {
      console.error('Error processing mapping:', error);
      dialog.error('处理失败，请检查映射配置。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (questions.length === 0) return;
    
    setIsProcessing(true);
    try {
      await importQuestions(deck.id, questions);
      setStep('complete');
    } catch (error) {
      console.error('Error importing:', error);
      dialog.error('导入失败，请重试。');
    } finally {
      setIsProcessing(false);
    }
  };

  // AI解析题目
  const handleAIParse = async () => {
    if (!aiText.trim()) {
      setAiError('请输入要解析的题目内容');
      return;
    }

    setIsProcessing(true);
    setAiError(null);
    setAiProgress({ current: 0, total: 1 });

    try {
      const result = await parseWithAIBatch(aiText, (current, total) => {
        setAiProgress({ current, total });
      });

      if (result.error) {
        setAiError(result.error);
      }

      if (result.questions.length > 0) {
        setQuestions(convertAIQuestions(result.questions));
        setStep('preview');
      } else if (!result.error) {
        setAiError('未能解析出任何题目，请检查输入内容格式');
      }
    } catch (error) {
      console.error('AI parsing error:', error);
      setAiError(error instanceof Error ? error.message : 'AI解析失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // AI输入界面
  const renderAIInputStep = () => (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">AI 智能识别</h2>
              <p className="text-gray-500 mt-1">粘贴任意格式的题目文本，AI 自动解析为结构化题目</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder={`粘贴题目内容，支持各种格式，例如：

1. 以下哪个是中国的首都？
A. 上海
B. 北京
C. 广州
D. 深圳
答案：B

2. React是由哪家公司开发的？
A. Google
B. Microsoft
C. Facebook
D. Apple
答案：C
解析：React由Facebook（现Meta）于2013年开源。`}
            className="w-full h-80 px-4 py-3 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none font-mono text-sm"
          />
          
          {aiError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{aiError}</div>
            </div>
          )}

          {isProcessing && aiProgress.total > 0 && (
            <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                <span className="text-sm text-purple-700">
                  正在解析... ({aiProgress.current}/{aiProgress.total})
                </span>
              </div>
              <div className="mt-2 h-2 bg-purple-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${(aiProgress.current / aiProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              支持的格式
            </h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 编号题目（1. 2. 3. 或 一、二、三、）</li>
              <li>• 选项格式（A. B. C. 或 A) B) C)）</li>
              <li>• 答案标记（答案：、正确答案：、Answer:）</li>
              <li>• 解析说明（解析：、说明：）</li>
              <li>• 判断题（对/错、正确/错误、T/F）</li>
              <li>• 填空题（使用___或括号表示空格）</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between mt-6">
        <Button variant="ghost" onClick={() => setStep('upload')}>
          <ArrowLeft size={18} className="mr-2" />
          返回
        </Button>
        <Button 
          onClick={handleAIParse}
          isLoading={isProcessing}
          disabled={!aiText.trim()}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
        >
          <Sparkles size={18} className="mr-2" />
          AI 解析
        </Button>
      </div>
    </div>
  );

  const renderUploadStep = () => (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">上传题目文件</h2>
          <p className="text-gray-500 mt-1">支持 CSV、Excel、纯文本和截图/照片格式</p>
        </CardHeader>
        <CardContent>
          {/* Drop Zone */}
          <div
            className={cn(
              'drop-zone cursor-pointer',
              dragOver && 'drag-over'
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".csv,.xlsx,.xls,.txt,.md,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">拖拽文件到这里，或点击选择文件</p>
            <p className="text-sm text-gray-400">支持 .csv, .xlsx, .txt, .md, .png, .jpg, .webp 格式</p>
          </div>

          {/* Format Examples */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                <span className="font-medium">CSV/Excel</span>
              </div>
              <p className="text-xs text-gray-500">
                表格格式，每行一道题目。需要设置列映射。
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Aiken 格式</span>
              </div>
              <p className="text-xs text-gray-500">
                标准考试格式，支持 A/B/C/D 选项和 ANSWER: 行。
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <File className="w-5 h-5 text-purple-600" />
                <span className="font-medium">截图/照片</span>
              </div>
              <p className="text-xs text-gray-500">
                上传老师发的题目截图，AI 先识别文字，再整理成可练习题库。
              </p>
            </div>
          </div>

          {/* AI Parse Button */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={() => setStep('ai-input')}
              className="w-full p-4 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border border-purple-200 rounded-xl transition-colors group"
            >
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-800 flex items-center gap-2">
                    AI 智能识别
                    <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">NEW</span>
                  </div>
                  <div className="text-sm text-gray-500">粘贴任意格式文本，AI 自动解析题目</div>
                </div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderMappingStep = () => (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">配置列映射</h2>
          <p className="text-gray-500 mt-1">
            将文件中的列映射到对应的题目字段
          </p>
        </CardHeader>
        <CardContent>
          {/* File info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-6">
            <FileSpreadsheet className="w-5 h-5 text-gray-500" />
            <span className="text-sm text-gray-700">{file?.name}</span>
            <span className="text-xs text-gray-400">
              {parsedData?.rows.length} 行数据
            </span>
          </div>

          {/* Mapping Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {[
              { key: 'question', label: '题目内容', required: true },
              { key: 'optionA', label: '选项 A' },
              { key: 'optionB', label: '选项 B' },
              { key: 'optionC', label: '选项 C' },
              { key: 'optionD', label: '选项 D' },
              { key: 'answer', label: '正确答案' },
              { key: 'explanation', label: '解析' },
              { key: 'tags', label: '标签' }
            ].map(({ key, label, required }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {label} {required && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <select
                    value={columnMapping[key as keyof ColumnMapping] as string || ''}
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

          {/* Preview */}
          {parsedData && parsedData.rows.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">数据预览（前3行）</h4>
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
                    {parsedData.rows.slice(0, 3).map((row, i) => (
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
          disabled={!columnMapping.question}
        >
          下一步
        </Button>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">确认导入</h2>
              <p className="text-gray-500 mt-1">
                共解析 {questions.length} 道题目
                {importErrors.length > 0 && (
                  <span className="text-amber-600 ml-2">
                    ({importErrors.length} 个警告)
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <Check size={14} className="inline mr-1" />
                {questions.length} 有效
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
          {/* Error List */}
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
                  <p className="text-sm text-amber-600">
                    还有 {importErrors.length - 10} 个警告...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Question Preview */}
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {questions.slice(0, 10).map((q, i) => (
              <div key={q.id} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs font-medium flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 mb-2">{q.content.text}</p>
                    {q.options.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map(opt => (
                          <div 
                            key={opt.id}
                            className={cn(
                              'text-sm px-3 py-1 rounded-lg',
                              opt.isCorrect 
                                ? 'bg-green-100 text-green-700 font-medium'
                                : 'bg-white text-gray-600 border'
                            )}
                          >
                            {opt.id}. {opt.content.text}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.explanation && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-xs font-medium text-blue-700 mb-1">解析</p>
                        <p className="text-sm text-blue-900 whitespace-pre-line">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {questions.length > 10 && (
              <p className="text-center text-gray-500 py-2">
                还有 {questions.length - 10} 道题目...
              </p>
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
          disabled={questions.length === 0}
        >
          确认导入 {questions.length} 道题目
        </Button>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">导入成功！</h2>
      <p className="text-gray-500 mb-8">
        已成功导入 {questions.length} 道题目到「{deck.name}」
      </p>
      <div className="flex gap-4 justify-center">
        <Button variant="secondary" onClick={() => {
          setStep('upload');
          setFile(null);
          setQuestions([]);
        }}>
          继续导入
        </Button>
        <Button onClick={onBack}>
          返回题库
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Header - 液态玻璃效果 */}
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
              <h1 className="text-lg font-semibold text-gray-800">导入题目</h1>
              <p className="text-sm text-gray-600">{deck.name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
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

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 pb-12">
        {step === 'upload' && renderUploadStep()}
        {step === 'ai-input' && renderAIInputStep()}
        {step === 'mapping' && renderMappingStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'complete' && renderCompleteStep()}
      </main>
    </div>
  );
}
