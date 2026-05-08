/**
 * 数据导出组件
 * 支持导出学习数据、统计报告、笔记等
 */
import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, X, CheckCircle, Loader2, BarChart3, StickyNote, BookOpen, Calendar } from 'lucide-react';
import AnimatedModal from './ui/AnimatedModal';
import Button from './ui/Button';
import { cn } from '../lib/utils';
import { dialog } from './ui/ConfirmDialog';
import { db } from '../lib/database';

interface DataExportProps {
  isOpen: boolean;
  onClose: () => void;
}

type ExportFormat = 'json' | 'csv' | 'txt' | 'markdown';
type ExportType = 'all' | 'statistics' | 'notes' | 'questions' | 'progress';

export default function DataExport({ isOpen, onClose }: DataExportProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [selectedTypes, setSelectedTypes] = useState<ExportType[]>(['all']);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const exportOptions = [
    { id: 'all', label: '全部数据', icon: <Download size={18} />, description: '包含所有学习数据' },
    { id: 'statistics', label: '学习统计', icon: <BarChart3 size={18} />, description: '答题记录、正确率等' },
    { id: 'notes', label: '题目笔记', icon: <StickyNote size={18} />, description: '个人笔记和标签' },
    { id: 'questions', label: '题库内容', icon: <BookOpen size={18} />, description: '题目和答案' },
    { id: 'progress', label: '学习进度', icon: <Calendar size={18} />, description: '复习计划和进度' },
  ];

  const formatOptions = [
    { id: 'json', label: 'JSON', icon: <FileText size={16} />, ext: '.json' },
    { id: 'csv', label: 'CSV', icon: <FileSpreadsheet size={16} />, ext: '.csv' },
    { id: 'txt', label: 'TXT', icon: <FileText size={16} />, ext: '.txt' },
    { id: 'markdown', label: 'Markdown', icon: <FileText size={16} />, ext: '.md' },
  ];

  const toggleType = (type: ExportType) => {
    if (type === 'all') {
      setSelectedTypes(['all']);
    } else {
      const newTypes = selectedTypes.filter(t => t !== 'all');
      if (newTypes.includes(type)) {
        setSelectedTypes(newTypes.filter(t => t !== type));
      } else {
        setSelectedTypes([...newTypes, type]);
      }
    }
  };

  const generateExportData = async () => {
    const data: any = {
      exportDate: new Date().toISOString(),
      version: '1.0.0',
    };

    const includeAll = selectedTypes.includes('all');

    if (includeAll || selectedTypes.includes('questions')) {
      const decks = await db.decks.toArray();
      const questions = await db.questions.toArray();
      data.decks = decks;
      data.questions = questions;
    }

    if (includeAll || selectedTypes.includes('statistics')) {
      const cards = await db.cards.toArray();
      const totalCards = cards.length;
      const reviewedCards = cards.filter(c => c.reps > 0).length;
      const totalReps = cards.reduce((sum, c) => sum + c.reps, 0);
      const avgEase = cards.length > 0 ? cards.reduce((sum, c) => sum + c.easeFactor, 0) / cards.length : 0;

      data.statistics = {
        totalCards,
        reviewedCards,
        totalReps,
        avgEaseFactor: avgEase.toFixed(2),
        cards: cards.map(c => ({
          id: c.id,
          state: c.state,
          reps: c.reps,
          lapses: c.lapses,
          easeFactor: c.easeFactor,
          lastReview: c.lastReview,
          dueDate: c.dueDate,
        })),
      };
    }

    if (includeAll || selectedTypes.includes('notes')) {
      const notesData = localStorage.getItem('question-notes');
      data.notes = notesData ? JSON.parse(notesData) : [];
    }

    if (includeAll || selectedTypes.includes('progress')) {
      const learningStats = localStorage.getItem('learning-stats');
      data.learningProgress = learningStats ? JSON.parse(learningStats) : {};
    }

    return data;
  };

  const formatAsCSV = (data: any): string => {
    const lines: string[] = [];

    if (data.questions) {
      lines.push('# 题目数据');
      lines.push('ID,内容,类型,难度,正确答案');
      data.questions.forEach((q: any) => {
        lines.push(`"${q.id}","${q.content.replace(/"/g, '""')}","${q.type}","${q.difficulty}","${q.correctAnswer}"`);
      });
      lines.push('');
    }

    if (data.statistics) {
      lines.push('# 学习统计');
      lines.push(`总卡片数,${data.statistics.totalCards}`);
      lines.push(`已复习,${data.statistics.reviewedCards}`);
      lines.push(`总复习次数,${data.statistics.totalReps}`);
      lines.push(`平均简易因子,${data.statistics.avgEaseFactor}`);
      lines.push('');
    }

    if (data.notes && data.notes.length > 0) {
      lines.push('# 笔记');
      lines.push('题目ID,内容,标签,创建时间');
      data.notes.forEach((n: any) => {
        lines.push(`"${n.questionId}","${n.content.replace(/"/g, '""')}","${n.tags.join(';')}","${new Date(n.createdAt).toLocaleString()}"`);
      });
    }

    return lines.join('\n');
  };

  const formatAsTXT = (data: any): string => {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('智能题库数据导出');
    lines.push('='.repeat(60));
    lines.push(`导出时间: ${new Date(data.exportDate).toLocaleString()}`);
    lines.push('');

    if (data.statistics) {
      lines.push('-'.repeat(60));
      lines.push('学习统计');
      lines.push('-'.repeat(60));
      lines.push(`总卡片数: ${data.statistics.totalCards}`);
      lines.push(`已复习: ${data.statistics.reviewedCards}`);
      lines.push(`总复习次数: ${data.statistics.totalReps}`);
      lines.push(`平均简易因子: ${data.statistics.avgEaseFactor}`);
      lines.push('');
    }

    if (data.decks) {
      lines.push('-'.repeat(60));
      lines.push('题库列表');
      lines.push('-'.repeat(60));
      data.decks.forEach((deck: any, index: number) => {
        lines.push(`${index + 1}. ${deck.name}`);
        lines.push(`   ID: ${deck.id}`);
        if (deck.description) {
          lines.push(`   描述: ${deck.description}`);
        }
        lines.push('');
      });
    }

    if (data.questions) {
      lines.push('-'.repeat(60));
      lines.push(`题目数据 (共 ${data.questions.length} 道题)`);
      lines.push('-'.repeat(60));
      data.questions.forEach((q: any, index: number) => {
        const content = typeof q.content === 'string' ? q.content : q.content.text;
        lines.push(`\n${index + 1}. ${content}`);
        lines.push(`   类型: ${q.type}`);
        lines.push(`   难度: ${q.difficulty}`);
        if (q.options && q.options.length > 0) {
          lines.push('   选项:');
          q.options.forEach((opt: any, idx: number) => {
            const optContent = typeof opt.content === 'string' ? opt.content : opt.content.text;
            const letter = String.fromCharCode(65 + idx);
            lines.push(`      ${letter}. ${optContent}`);
          });
        }
        lines.push(`   答案: ${Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}`);
        if (q.explanation) {
          lines.push(`   解析: ${q.explanation}`);
        }
        lines.push('');
      });
    }

    if (data.notes && data.notes.length > 0) {
      lines.push('-'.repeat(60));
      lines.push('学习笔记');
      lines.push('-'.repeat(60));
      data.notes.forEach((note: any, index: number) => {
        lines.push(`\n笔记 ${index + 1}`);
        lines.push(`题目 ID: ${note.questionId}`);
        lines.push(`标签: ${note.tags.join(', ') || '无'}`);
        lines.push(`内容: ${note.content}`);
        lines.push(`时间: ${new Date(note.updatedAt).toLocaleString()}`);
        lines.push('');
      });
    }

    lines.push('='.repeat(60));
    return lines.join('\n');
  };

  const formatAsMarkdown = (data: any): string => {
    const lines: string[] = [];

    lines.push('# 智能题库数据导出');
    lines.push(`> 导出时间: ${new Date(data.exportDate).toLocaleString()}`);
    lines.push('');

    if (data.statistics) {
      lines.push('## 📊 学习统计');
      lines.push(`- **总卡片数**: ${data.statistics.totalCards}`);
      lines.push(`- **已复习**: ${data.statistics.reviewedCards}`);
      lines.push(`- **总复习次数**: ${data.statistics.totalReps}`);
      lines.push(`- **平均简易因子**: ${data.statistics.avgEaseFactor}`);
      lines.push('');
    }

    if (data.decks) {
      lines.push('## 📚 题库列表');
      data.decks.forEach((deck: any) => {
        lines.push(`### ${deck.name}`);
        lines.push(`- ID: ${deck.id}`);
        lines.push(`- 描述: ${deck.description || '无'}`);
        lines.push('');
      });
    }

    if (data.notes && data.notes.length > 0) {
      lines.push('## 📝 学习笔记');
      data.notes.forEach((note: any, index: number) => {
        lines.push(`### 笔记 ${index + 1}`);
        lines.push(`- **题目ID**: ${note.questionId}`);
        lines.push(`- **标签**: ${note.tags.join(', ') || '无'}`);
        lines.push(`- **内容**: ${note.content}`);
        lines.push(`- **更新时间**: ${new Date(note.updatedAt).toLocaleString()}`);
        lines.push('');
      });
    }

    if (data.learningProgress) {
      lines.push('## 📈 学习进度');
      lines.push(`- **连续学习天数**: ${data.learningProgress.streak || 0}`);
      lines.push(`- **最高连续**: ${data.learningProgress.maxCombo || 0}`);
      lines.push(`- **总学习时长**: ${data.learningProgress.totalTime || 0} 分钟`);
      lines.push('');
    }

    return lines.join('\n');
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const data = await generateExportData();
      let content: string;
      let mimeType: string;
      let extension: string;

      switch (selectedFormat) {
        case 'csv':
          content = formatAsCSV(data);
          mimeType = 'text/csv;charset=utf-8';
          extension = '.csv';
          break;
        case 'txt':
          content = formatAsTXT(data);
          mimeType = 'text/plain;charset=utf-8';
          extension = '.txt';
          break;
        case 'markdown':
          content = formatAsMarkdown(data);
          mimeType = 'text/markdown;charset=utf-8';
          extension = '.md';
          break;
        default:
          content = JSON.stringify(data, null, 2);
          mimeType = 'application/json';
          extension = '.json';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-question-bank-export-${new Date().toISOString().split('T')[0]}${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      dialog.error('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between border-gray-200 bg-gradient-to-r from-emerald-500 to-teal-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">导出数据</h2>
              <p className="text-xs text-white/80">备份您的学习数据</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg">
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Export Type Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block text-gray-700">选择导出内容</label>
            <div className="grid grid-cols-1 gap-2">
              {exportOptions.map(option => (
                <div
                  key={option.id}
                  onClick={() => toggleType(option.id as ExportType)}
                  className={cn(
                    "p-3 rounded-xl border-2 cursor-pointer flex items-center gap-3",
                    selectedTypes.includes(option.id as ExportType) ||
                      (selectedTypes.includes('all') && option.id === 'all')
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      selectedTypes.includes(option.id as ExportType) ||
                        (selectedTypes.includes('all') && option.id === 'all')
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {option.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{option.label}</p>
                    <p className="text-xs text-gray-500">{option.description}</p>
                  </div>
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                      selectedTypes.includes(option.id as ExportType) ||
                        (selectedTypes.includes('all') && option.id === 'all')
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300"
                    )}
                  >
                    {(selectedTypes.includes(option.id as ExportType) ||
                      (selectedTypes.includes('all') && option.id === 'all')) && (
                      <CheckCircle size={12} className="text-white" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block text-gray-700">导出格式</label>
            <div className="flex gap-2">
              {formatOptions.map(format => (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format.id as ExportFormat)}
                  className={cn(
                    "flex-1 p-3 rounded-xl border-2 flex flex-col items-center gap-1",
                    selectedFormat === format.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  {format.icon}
                  <span className="text-sm font-medium text-gray-900">{format.label}</span>
                  <span className="text-xs text-gray-500">{format.ext}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between border-gray-200 bg-gray-50">
          <div>
            {exportSuccess && (
              <span className="flex items-center gap-1 text-green-500 text-sm">
                <CheckCircle size={14} />
                导出成功！
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || selectedTypes.length === 0}
              leftIcon={isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            >
              {isExporting ? '导出中...' : '开始导出'}
            </Button>
          </div>
        </div>
      </div>
    </AnimatedModal>
  );
}
