import { useState, useMemo, useEffect, useRef } from 'react';
import { ArrowLeft, Filter, BookOpen, Clock, CheckCircle, AlertCircle, Download, ChevronDown, FileText, FileSpreadsheet, Tag, Edit3, X, Save, Trash2, Search } from 'lucide-react';
import Button from '../components/ui/Button';
import { cn } from '../lib/utils';
import { dialog } from '../components/ui/ConfirmDialog';
import type { Deck, Question, Card as FlashCard } from '../types';

interface DeckDetailsPageProps {
  deck: Deck;
  questions: Question[];
  cards: FlashCard[];
  initialFilter?: FilterType;
  onBack: () => void;
}

type FilterType = 'all' | 'new' | 'learning' | 'review' | 'mastered';

export default function DeckDetailsPage({ deck, questions, cards, initialFilter = 'all', onBack }: DeckDetailsPageProps) {
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [searchTerm, setSearchTerm] = useState('');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editExplanation, setEditExplanation] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [editOptions, setEditOptions] = useState<{ id: string; content: string; isCorrect: boolean }[]>([]);
  const [editQuestionType, setEditQuestionType] = useState<'MCQ' | 'MULTI'>('MCQ');
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  // 同步 initialFilter prop 到 filter 状态
  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };
    if (showExportDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [showExportDropdown]);

  const cardMap = useMemo(() => {
    const map = new Map<string, FlashCard>();
    cards.forEach(card => map.set(card.questionId, card));
    return map;
  }, [cards]);

  const getCardStatus = (questionId: string): FilterType => {
    const card = cardMap.get(questionId);
    if (!card) return 'new';
    const now = Date.now();
    if (card.state === 'new') return 'new';
    if (card.state === 'learning') return 'learning';
    if (card.state === 'review') {
      if (card.dueDate <= now) return 'review';
      const reps = card.reps || 0;
      const lapses = card.lapses || 0;
      const total = reps + lapses;
      const accuracy = total > 0 ? reps / total : 0;
      if (reps >= 10 && accuracy >= 0.9) return 'mastered';
      return 'learning';
    }
    return 'learning';
  };

  const filteredQuestions = useMemo(() => {
    let filtered = questions;
    if (filter !== 'all') {
      filtered = filtered.filter(q => getCardStatus(q.id) === filter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(q => {
        const content = typeof q.content === 'string' ? q.content : q.content.text;
        return content.toLowerCase().includes(term);
      });
    }
    return filtered;
  }, [questions, filter, searchTerm]);

  const stats = useMemo(() => {
    const counts = { all: questions.length, new: 0, learning: 0, review: 0, mastered: 0 };
    questions.forEach(q => { const status = getCardStatus(q.id); counts[status]++; });
    return counts;
  }, [questions, cardMap]);

  const getContentText = (content: string | { text: string }): string => {
    return typeof content === 'string' ? content : content.text;
  };

  const openEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setEditContent(getContentText(q.content));
    setEditExplanation(q.explanation || '');
    setEditTags(Array.isArray(q.tags) ? q.tags : []);
    setEditTagInput('');
    setEditQuestionType(q.type === 'MULTI' ? 'MULTI' : 'MCQ');
    const opts = q.options.map((opt, idx) => ({
      id: opt.id || String.fromCharCode(65 + idx),
      content: getContentText(opt.content),
      isCorrect: opt.isCorrect || false,
    }));
    setEditOptions(opts);
  };

  const closeEditQuestion = () => {
    setEditingQuestion(null);
    setEditContent('');
    setEditExplanation('');
    setEditTags([]);
    setEditTagInput('');
    setEditOptions([]);
    setEditQuestionType('MCQ');
    setIsSavingQuestion(false);
  };

  const handleAddEditTag = () => {
    const t = editTagInput.trim();
    if (!t) return;
    if (editTags.includes(t)) { setEditTagInput(''); return; }
    setEditTags(prev => [...prev, t]);
    setEditTagInput('');
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    setEditTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleOptionContentChange = (index: number, content: string) => {
    setEditOptions(prev => prev.map((opt, i) => i === index ? { ...opt, content } : opt));
  };

  const handleToggleCorrect = (index: number) => {
    const isMulti = editQuestionType === 'MULTI';
    setEditOptions(prev => prev.map((opt, i) => {
      if (i === index) return { ...opt, isCorrect: !opt.isCorrect };
      if (!isMulti && !prev[index].isCorrect) return { ...opt, isCorrect: false };
      return opt;
    }));
  };

  const handleToggleQuestionType = () => {
    const newType = editQuestionType === 'MCQ' ? 'MULTI' : 'MCQ';
    setEditQuestionType(newType);
    if (newType === 'MCQ') {
      const firstCorrectIndex = editOptions.findIndex(opt => opt.isCorrect);
      setEditOptions(prev => prev.map((opt, i) => ({ ...opt, isCorrect: i === firstCorrectIndex })));
    }
  };

  const handleAddOption = () => {
    const nextId = String.fromCharCode(65 + editOptions.length);
    setEditOptions(prev => [...prev, { id: nextId, content: '', isCorrect: false }]);
  };

  const handleRemoveOption = (index: number) => {
    if (editOptions.length <= 2) return;
    setEditOptions(prev => {
      const newOpts = prev.filter((_, i) => i !== index);
      return newOpts.map((opt, i) => ({ ...opt, id: String.fromCharCode(65 + i) }));
    });
  };

  const saveEditedQuestion = async () => {
    if (!editingQuestion) return;
    setIsSavingQuestion(true);
    setSaveMessage(null);
    try {
      const { questionOperations } = await import('../lib/database');
      const { refreshQueries } = await import('../hooks/useAsyncQuery');
      const correctAnswerIds = editOptions.filter(opt => opt.isCorrect).map(opt => opt.id);
      const newAnswer = editQuestionType === 'MULTI' ? correctAnswerIds : correctAnswerIds[0] || '';
      const newOptions = editOptions.map(opt => ({ id: opt.id, content: { text: opt.content }, isCorrect: opt.isCorrect }));
      await questionOperations.update(editingQuestion.id, {
        type: editQuestionType,
        content: { text: editContent },
        explanation: editExplanation,
        tags: editTags,
        options: newOptions,
        answer: newAnswer,
      } as any);
      refreshQueries();
      setSaveMessage({ type: 'success', text: '保存成功！' });
      setIsSavingQuestion(false);
      setTimeout(() => { closeEditQuestion(); }, 1000);
    } catch (error) {
      console.error('Failed to update question:', error);
      setSaveMessage({ type: 'error', text: '保存失败：' + (error instanceof Error ? error.message : '未知错误') });
      setIsSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    const confirmed = await dialog.confirm('确定要删除这道题目吗？此操作不可撤销。', { title: '删除题目', isDanger: true });
    if (!confirmed) return;
    setDeletingQuestionId(questionId);
    try {
      const { questionOperations, cardOperations } = await import('../lib/database');
      const { refreshQueries } = await import('../hooks/useAsyncQuery');
      await cardOperations.deleteByQuestionId(questionId);
      await questionOperations.delete(questionId);
      if (selectedQuestion?.id === questionId) setSelectedQuestion(null);
      refreshQueries();
    } catch (error) {
      console.error('Failed to delete question:', error);
      dialog.error('删除失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const handleExport = (format: 'json' | 'csv' | 'txt' | 'markdown') => {
    if (filteredQuestions.length === 0) { dialog.warning('没有可导出的题目'); return; }
    const formatOptions = (options: any[]) => {
      if (!options || options.length === 0) return [];
      return options.map((opt, idx) => {
        if (typeof opt === 'string') return { id: String.fromCharCode(65 + idx), content: opt, isCorrect: false };
        return { id: opt.id || String.fromCharCode(65 + idx), content: typeof opt.content === 'string' ? opt.content : opt.content?.text || '', isCorrect: opt.isCorrect || false };
      });
    };
    const data: any = {
      deck: { id: deck.id, name: deck.name, description: deck.description, createdAt: deck.createdAt },
      questions: filteredQuestions.map(q => ({ id: q.id, type: q.type, content: getContentText(q.content), options: formatOptions(q.options), answer: q.answer, explanation: q.explanation, tags: q.tags, difficulty: q.difficulty })),
      exportDate: new Date().toISOString(),
    };
    let content: string, mimeType: string, extension: string;
    switch (format) {
      case 'csv':
        const lines: string[] = ['题目,类型,答案,解析'];
        data.questions.forEach((q: any) => { const answer = Array.isArray(q.answer) ? q.answer.join(';') : q.answer; lines.push(`"${q.content.replace(/"/g, '""')}","${q.type}","${answer}","${q.explanation || ''}"`); });
        content = lines.join('\n'); mimeType = 'text/csv;charset=utf-8'; extension = '.csv'; break;
      case 'txt':
        const txtLines: string[] = ['='.repeat(60), `${deck.name} - 题库导出`, '='.repeat(60), `导出时间: ${new Date().toLocaleString()}`, `题目总数: ${data.questions.length}`, ''];
        data.questions.forEach((q: any, index: number) => { txtLines.push(`${index + 1}. ${q.content}`, `   类型: ${q.type}`); if (q.options.length > 0) { txtLines.push('   选项:'); q.options.forEach((opt: any) => { txtLines.push(`     ${opt.id}. ${opt.content}`); }); } txtLines.push(`   答案: ${Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}`); if (q.explanation) txtLines.push(`   解析: ${q.explanation}`); txtLines.push(''); });
        txtLines.push('='.repeat(60)); content = txtLines.join('\n'); mimeType = 'text/plain;charset=utf-8'; extension = '.txt'; break;
      case 'markdown':
        const mdLines: string[] = [`# ${deck.name}`, '', `> 导出时间: ${new Date().toLocaleString()}`, `> 题目总数: ${data.questions.length}`, ''];
        data.questions.forEach((q: any) => { mdLines.push(`## ${q.content}`, ''); if (q.options.length > 0) { q.options.forEach((opt: any) => { mdLines.push(`- **${opt.id}**. ${opt.content}`); }); mdLines.push(''); } mdLines.push(`**答案**: ${Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}`, ''); if (q.explanation) mdLines.push(`**解析**: ${q.explanation}`, ''); });
        content = mdLines.join('\n'); mimeType = 'text/markdown;charset=utf-8'; extension = '.md'; break;
      default:
        content = JSON.stringify(data, null, 2); mimeType = 'application/json'; extension = '.json';
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${deck.name}-${new Date().toISOString().split('T')[0]}${extension}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setShowExportDropdown(false);
  };

  // 状态配置
  const statusConfig = {
    new: { label: '新题目', icon: AlertCircle, btnActive: 'bg-blue-100 text-blue-700 ring-2 ring-blue-500', countActive: 'bg-blue-200', badge: 'bg-blue-100 text-blue-700' },
    learning: { label: '学习中', icon: Clock, btnActive: 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-500', countActive: 'bg-yellow-200', badge: 'bg-yellow-100 text-yellow-700' },
    review: { label: '待复习', icon: AlertCircle, btnActive: 'bg-red-100 text-red-700 ring-2 ring-red-500', countActive: 'bg-red-200', badge: 'bg-red-100 text-red-700' },
    mastered: { label: '已掌握', icon: CheckCircle, btnActive: 'bg-green-100 text-green-700 ring-2 ring-green-500', countActive: 'bg-green-200', badge: 'bg-green-100 text-green-700' },
    all: { label: '全部', icon: BookOpen, btnActive: 'bg-gray-100 text-gray-700 ring-2 ring-gray-500', countActive: 'bg-gray-200', badge: 'bg-gray-100 text-gray-700' },
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'MCQ': return '单选题';
      case 'MULTI': return '多选题';
      case 'TRUE_FALSE': return '判断题';
      case 'FILL': return '填空题';
      default: return '简答题';
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* 头部 */}
      <header className="liquid-glass-wrapper liquid-glass-header flex-shrink-0" style={{ '--border-radius': '0', overflow: 'visible' } as React.CSSProperties}>
        <div className="liquid-glass-outer" />
        <div className="liquid-glass-cover" />
        <div className="liquid-glass-sharp" />
        <div className="liquid-glass-reflect" />
        <div className="liquid-glass-content">
          <div className="max-w-[1600px] mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={18} />} onClick={onBack}>返回</Button>
                <div>
                  <h1 className="text-xl font-bold text-gray-800">{deck.name}</h1>
                  {deck.description && <p className="text-xs text-gray-500">{deck.description}</p>}
                </div>
              </div>

              {/* 统计标签 */}
              <div className="hidden md:flex items-center gap-2">
                {(['all', 'new', 'learning', 'review', 'mastered'] as FilterType[]).map(f => {
                  const config = statusConfig[f];
                  const count = stats[f];
                  const isActive = filter === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                        isActive ? config.btnActive : 'bg-white/50 text-gray-600 hover:bg-white/80'
                      )}
                    >
                      <config.icon size={14} />
                      <span>{config.label}</span>
                      <span className={cn('px-1.5 py-0.5 rounded-full text-xs', isActive ? config.countActive : 'bg-gray-200')}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* 导出按钮 */}
              <div className="relative z-[60]" ref={exportDropdownRef}>
                <Button variant="secondary" size="sm" leftIcon={<Download size={16} />} onClick={() => setShowExportDropdown(!showExportDropdown)}>
                  导出<ChevronDown size={14} />
                </Button>
                {showExportDropdown && (
                  <div className="absolute right-0 mt-2 w-40 rounded-xl shadow-lg border z-[100] bg-white/95 backdrop-blur-md border-gray-200">
                    <div className="py-1">
                      <button onClick={() => handleExport('json')} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/50 text-gray-700"><FileText size={14} />JSON</button>
                      <button onClick={() => handleExport('csv')} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/50 text-gray-700"><FileSpreadsheet size={14} />CSV</button>
                      <button onClick={() => handleExport('txt')} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/50 text-gray-700"><FileText size={14} />TXT</button>
                      <button onClick={() => handleExport('markdown')} className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/50 text-gray-700"><FileText size={14} />Markdown</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 - 左右分栏 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：题目列表 */}
        <div className={cn(
          "flex flex-col bg-white/50 border-r border-gray-200 transition-all",
          selectedQuestion ? "w-1/2 lg:w-2/5" : "w-full"
        )}>
          {/* 搜索框 */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="搜索题目内容..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white border-gray-300"
              />
            </div>
          </div>

          {/* 题目列表 */}
          <div className="flex-1 overflow-y-auto">
            {filteredQuestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Filter size={48} className="mb-4 opacity-50" />
                <p className="font-medium">没有找到符合条件的题目</p>
                <p className="text-sm mt-1">试试调整筛选条件</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm">
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">题目</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">类型</th>
                    <th className="px-4 py-3 font-medium text-center">状态</th>
                    <th className="px-4 py-3 font-medium text-center hidden md:table-cell">正确率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredQuestions.map((question, index) => {
                    const status = getCardStatus(question.id);
                    const card = cardMap.get(question.id);
                    const isSelected = selectedQuestion?.id === question.id;
                    const config = statusConfig[status];
                    const accuracy = card && ((card.reps || 0) + (card.lapses || 0)) > 0
                      ? Math.round(((card.reps || 0) / ((card.reps || 0) + (card.lapses || 0))) * 100)
                      : null;

                    return (
                      <tr
                        key={question.id}
                        onClick={() => setSelectedQuestion(question)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'
                        )}
                      >
                        <td className="px-4 py-3 text-sm text-gray-400">{index + 1}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900 line-clamp-2">{getContentText(question.content)}</p>
                          {Array.isArray(question.tags) && question.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {question.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
                                  <Tag size={10} />{tag}
                                </span>
                              ))}
                              {question.tags.length > 2 && (
                                <span className="text-xs text-gray-400">+{question.tags.length - 2}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                          {getTypeLabel(question.type)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', config.badge)}>
                            {config.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {accuracy !== null ? (
                            <span className={cn(
                              'text-sm font-medium',
                              accuracy >= 80 ? 'text-green-600' : accuracy >= 50 ? 'text-yellow-600' : 'text-red-600'
                            )}>
                              {accuracy}%
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 右侧：题目详情 */}
        {selectedQuestion && (
          <div className="w-1/2 lg:w-3/5 flex flex-col bg-white overflow-hidden">
            {/* 详情头部 */}
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusConfig[getCardStatus(selectedQuestion.id)].badge)}>
                      {statusConfig[getCardStatus(selectedQuestion.id)].label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{getTypeLabel(selectedQuestion.type)}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{getContentText(selectedQuestion.content)}</h2>
                  {Array.isArray(selectedQuestion.tags) && selectedQuestion.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedQuestion.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border bg-white border-gray-200 text-gray-600">
                          <Tag size={12} />{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button variant="ghost" size="sm" leftIcon={<Edit3 size={14} />} onClick={() => openEditQuestion(selectedQuestion)}>编辑</Button>
                  <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => handleDeleteQuestion(selectedQuestion.id)} disabled={deletingQuestionId === selectedQuestion.id}>
                    {deletingQuestionId === selectedQuestion.id ? '删除中...' : '删除'}
                  </Button>
                  <button onClick={() => setSelectedQuestion(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
                </div>
              </div>
            </div>

            {/* 详情内容 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 选项 */}
              {selectedQuestion.options && selectedQuestion.options.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">选项</h3>
                  <div className="space-y-2">
                    {selectedQuestion.options.map((option, idx) => {
                      const optionId = option.id || String.fromCharCode(65 + idx);
                      const optionContent = typeof option === 'string' ? option : getContentText(option.content);
                      const isCorrect = (typeof option === 'object' && option.isCorrect) || selectedQuestion.answer === optionId || (Array.isArray(selectedQuestion.answer) && selectedQuestion.answer.includes(optionId));
                      return (
                        <div key={idx} className={cn('flex items-start gap-3 p-4 rounded-xl border transition-all', isCorrect ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200')}>
                          <span className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0', isCorrect ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600')}>{optionId}</span>
                          <span className={cn('flex-1 pt-1', isCorrect ? 'text-green-700 font-medium' : 'text-gray-700')}>{optionContent}</span>
                          {isCorrect && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 解析 */}
              {selectedQuestion.explanation && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">解析</h3>
                  <div className="p-4 rounded-xl bg-blue-50 border-l-4 border-blue-400">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedQuestion.explanation}</p>
                  </div>
                </div>
              )}

              {/* 学习进度 */}
              {(() => {
                const card = cardMap.get(selectedQuestion.id);
                if (!card) return null;
                const accuracy = ((card.reps || 0) + (card.lapses || 0)) > 0
                  ? Math.round(((card.reps || 0) / ((card.reps || 0) + (card.lapses || 0))) * 100)
                  : 0;

                return (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">学习进度</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-blue-50">
                        <div className="text-sm text-blue-600 mb-1">复习次数</div>
                        <p className="text-2xl font-bold text-blue-700">{card.reps || 0}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-green-50">
                        <div className="text-sm text-green-600 mb-1">正确率</div>
                        <p className="text-2xl font-bold text-green-700">{accuracy}%</p>
                      </div>
                      <div className="p-4 rounded-xl bg-red-50">
                        <div className="text-sm text-red-600 mb-1">错误次数</div>
                        <p className="text-2xl font-bold text-red-700">{card.lapses || 0}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-purple-50">
                        <div className="text-sm text-purple-600 mb-1">复习间隔</div>
                        <p className="text-2xl font-bold text-purple-700">{Math.round((card.interval || 0) / (24 * 60 * 60 * 1000))}天</p>
                      </div>
                    </div>
                    {card.dueDate && (
                      <p className="mt-3 text-sm text-gray-500">下次复习：{new Date(card.dueDate).toLocaleDateString()}</p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* 编辑题目弹窗 */}
      {editingQuestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeEditQuestion}>
          <div className="rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between border-gray-200 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">编辑题目</h3>
              <button onClick={closeEditQuestion} className="p-2 rounded-lg transition-colors hover:bg-gray-100"><X size={20} className="text-gray-600" /></button>
            </div>
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-sm font-medium mb-2 block text-gray-700">题目类型</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { if (editQuestionType !== 'MCQ') handleToggleQuestionType(); }}
                    className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', editQuestionType === 'MCQ' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>单选题</button>
                  <button type="button" onClick={() => { if (editQuestionType !== 'MULTI') handleToggleQuestionType(); }}
                    className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', editQuestionType === 'MULTI' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>多选题</button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block text-gray-700">题干</label>
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-28 p-3 rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all bg-white border-gray-300 text-gray-900 placeholder-gray-400" />
              </div>
              {editOptions.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block text-gray-700">选项 <span className="text-xs text-gray-500">（点击左侧圆圈设置正确答案{editQuestionType === 'MULTI' ? '，可多选' : ''}）</span></label>
                  <div className="space-y-2">
                    {editOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <button type="button" onClick={() => handleToggleCorrect(idx)}
                          className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all', opt.isCorrect ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-gray-500 hover:border-green-500')}
                          title={opt.isCorrect ? '点击取消正确答案' : '点击设为正确答案'}>
                          {opt.isCorrect ? <CheckCircle size={16} /> : opt.id}
                        </button>
                        <input type="text" value={opt.content} onChange={(e) => handleOptionContentChange(idx, e.target.value)} placeholder={`选项 ${opt.id} 内容`}
                          className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white border-gray-300 text-gray-900 placeholder-gray-400" />
                        {editOptions.length > 2 && (
                          <button type="button" onClick={() => handleRemoveOption(idx)} className="p-2 rounded-lg transition-colors hover:bg-gray-100 text-gray-500" title="删除选项"><X size={16} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  {editOptions.length < 6 && (<Button variant="ghost" size="sm" className="mt-2" onClick={handleAddOption}>+ 添加选项</Button>)}
                  <div className="mt-2 text-xs text-gray-400">当前正确答案：{editOptions.filter(o => o.isCorrect).map(o => o.id).join(', ') || '未设置'}</div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-2 block text-gray-700">解析</label>
                <textarea value={editExplanation} onChange={(e) => setEditExplanation(e.target.value)}
                  className="w-full h-28 p-3 rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all bg-white border-gray-300 text-gray-900 placeholder-gray-400" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block text-gray-700"><Tag size={14} className="inline mr-1" />标签</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editTags.map(tag => (
                    <span key={tag} className="px-2 py-1 rounded-full text-xs flex items-center gap-1 bg-gray-100 text-gray-700">
                      {tag}<button onClick={() => handleRemoveEditTag(tag)} className="hover:text-red-500"><X size={12} /></button>
                    </span>
                  ))}
                  {editTags.length === 0 && (<span className="text-xs text-gray-400">暂无标签</span>)}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={editTagInput} onChange={(e) => setEditTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddEditTag(); } }} placeholder="输入标签后回车添加"
                    className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white border-gray-300 text-gray-900 placeholder-gray-400" />
                  <Button size="sm" onClick={handleAddEditTag}>添加</Button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-between gap-2 border-gray-200 bg-gray-50">
              {saveMessage && (
                <div className={cn('flex items-center gap-2 text-sm', saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600')}>
                  {saveMessage.type === 'success' ? (<CheckCircle size={16} />) : (<AlertCircle size={16} />)}{saveMessage.text}
                </div>
              )}
              {!saveMessage && <div />}
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={closeEditQuestion} disabled={isSavingQuestion}>取消</Button>
                <Button onClick={saveEditedQuestion} leftIcon={<Save size={16} />} disabled={isSavingQuestion}>{isSavingQuestion ? '保存中...' : '保存'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
