/**
 * 错题本模态框
 * 展示用户的错题列表，支持筛选、排序和练习
 */
import { useState } from 'react';
import { useLiveQuery, refreshQueries } from '../hooks/useAsyncQuery';
import {
  BookX,
  Flame,
  Play,
  CheckCircle,
  XCircle,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Clock,
  Zap,
  AlertTriangle,
  RotateCcw,
  Search,
  X
} from 'lucide-react';
import AnimatedModal from './ui/AnimatedModal';
import Button from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { wrongQuestionOperations } from '../lib/database';
import { cn } from '../lib/utils';
import type { Deck } from '../types';
import type { WrongQuestion } from '../lib/database-mysql';

interface WrongBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck?: Deck;
  onPractice?: (cardIds: string[]) => void;
}

export default function WrongBookModal({ isOpen, onClose, deck, onPractice }: WrongBookModalProps) {
  const [sortBy, setSortBy] = useState<'lapses' | 'recent' | 'difficulty' | 'accuracy'>('lapses');
  const [filterDifficulty, setFilterDifficulty] = useState<'all' | 'hard' | 'medium'>('all');
  const [filterDeckId, setFilterDeckId] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState<string | null>(null);

  // 获取错题列表
  const wrongQuestions = useLiveQuery(async () => {
    if (!isOpen) return [];
    
    let data: WrongQuestion[];
    if (deck) {
      data = await wrongQuestionOperations.getByDeckId(deck.id);
    } else {
      data = await wrongQuestionOperations.getAll();
    }
    
    let filtered = data;
    if (filterDeckId !== 'all') {
      filtered = data.filter(wq => wq.deckId === filterDeckId);
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(wq => {
        const content = wq.question?.content;
        const text = typeof content === 'string' ? content : (content as any)?.text || '';
        return text.toLowerCase().includes(term) || wq.question?.tags?.some((tag: string) => tag.toLowerCase().includes(term));
      });
    }

    if (sortBy === 'lapses') {
      filtered.sort((a, b) => b.wrongCount - a.wrongCount);
    } else if (sortBy === 'recent') {
      filtered.sort((a, b) => b.lastWrongTime - a.lastWrongTime);
    } else if (sortBy === 'accuracy') {
      filtered.sort((a, b) => b.wrongCount - a.wrongCount);
    }

    if (filterDifficulty === 'hard') {
      return filtered.filter(wq => wq.wrongCount >= 3);
    } else if (filterDifficulty === 'medium') {
      return filtered.filter(wq => wq.wrongCount >= 1 && wq.wrongCount < 3);
    }

    return filtered;
  }, [isOpen, deck?.id, sortBy, filterDifficulty, filterDeckId, searchTerm]);

  // 获取所有题库列表
  const deckList = useLiveQuery(async () => {
    if (!isOpen || deck) return null;
    const data = await wrongQuestionOperations.getAll();
    const deckMap = new Map<string, string>();
    data.forEach(wq => {
      if (wq.deckId && (wq as any).deckName) {
        deckMap.set(wq.deckId, (wq as any).deckName);
      }
    });
    return Array.from(deckMap.entries()).map(([id, name]) => ({ id, name }));
  }, [isOpen, deck?.id]);

  // 统计数据
  const stats = useLiveQuery(async () => {
    if (!isOpen) return null;
    if (deck) {
      return wrongQuestionOperations.getStats(deck.id);
    } else {
      return wrongQuestionOperations.getAllStats();
    }
  }, [isOpen, deck?.id]);


  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (wrongQuestions) {
      setSelectedIds(new Set(wrongQuestions.map(wq => wq.questionId)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handlePracticeSelected = () => {
    if (onPractice && selectedIds.size > 0) {
      onPractice(Array.from(selectedIds));
      onClose();
    }
  };

  const handlePracticeAll = () => {
    if (onPractice && wrongQuestions && wrongQuestions.length > 0) {
      onPractice(wrongQuestions.map(wq => wq.questionId));
      onClose();
    }
  };

  const handlePracticeHard = () => {
    if (onPractice && wrongQuestions) {
      const hardQuestions = wrongQuestions.filter(wq => wq.wrongCount >= 3);
      if (hardQuestions.length > 0) {
        onPractice(hardQuestions.map(wq => wq.questionId));
        onClose();
      }
    }
  };

  const handleResetQuestion = async (questionId: string) => {
    try {
      await wrongQuestionOperations.resetByQuestionId(questionId);
      setShowResetConfirm(null);
      refreshQueries();
    } catch (error) {
      console.error('重置失败:', error);
    }
  };

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return '从未';
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const getContentText = (content: any): string => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (typeof content === 'object' && content.text) return content.text;
    return String(content);
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden bg-white flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <BookX size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold">错题本</h2>
                <p className="text-white/80 text-sm">{deck ? deck.name : '全部题库'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 ? (
                <Button variant="secondary" size="sm" leftIcon={<Play size={16} />} onClick={handlePracticeSelected} className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                  练习选中 ({selectedIds.size})
                </Button>
              ) : (
                <>
                  {stats && stats.hardCount > 0 && (
                    <Button variant="secondary" size="sm" leftIcon={<Flame size={16} />} onClick={handlePracticeHard} className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                      攻克困难题
                    </Button>
                  )}
                  {stats && stats.totalWrong > 0 && (
                    <Button variant="secondary" size="sm" leftIcon={<Zap size={16} />} onClick={handlePracticeAll} className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                      练习全部
                    </Button>
                  )}
                </>
              )}
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/20">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>


        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4 p-4 border-b bg-gray-50 border-gray-200 flex-shrink-0">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-xl font-bold text-gray-900">{stats?.totalWrong || 0}</p>
            <p className="text-xs text-gray-500">错题总数</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Flame className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-xl font-bold text-red-600">{stats?.hardCount || 0}</p>
            <p className="text-xs text-gray-500">困难题</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-xl font-bold text-orange-600">{stats?.mediumCount || 0}</p>
            <p className="text-xs text-gray-500">一般题</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <BarChart3 className="w-4 h-4 text-green-500" />
            </div>
            <p className={cn(
              "text-xl font-bold",
              (stats?.avgAccuracy || 0) >= 80 ? 'text-green-600' :
              (stats?.avgAccuracy || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
            )}>
              {stats?.avgAccuracy || 0}%
            </p>
            <p className="text-xs text-gray-500">平均正确率</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0 space-y-3">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索题目内容或标签..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white border-gray-200"
            />
          </div>

          {/* 筛选和排序 */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button onClick={selectedIds.size > 0 ? clearSelection : selectAll} className="text-sm text-primary-600 hover:text-primary-700">
                {selectedIds.size > 0 ? '取消全选' : '全选'}
              </button>
              {selectedIds.size > 0 && (
                <span className="text-sm text-gray-500">已选 {selectedIds.size} 题</span>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-lg p-1 border bg-white border-gray-200">
                <button onClick={() => setFilterDifficulty('all')} className={cn('px-3 py-1 rounded text-sm transition-colors', filterDifficulty === 'all' ? 'bg-red-100 text-red-700' : 'text-gray-600 hover:bg-gray-100')}>全部</button>
                <button onClick={() => setFilterDifficulty('hard')} className={cn('px-3 py-1 rounded text-sm transition-colors flex items-center gap-1', filterDifficulty === 'hard' ? 'bg-red-100 text-red-700' : 'text-gray-600 hover:bg-gray-100')}><Flame size={12} />困难</button>
                <button onClick={() => setFilterDifficulty('medium')} className={cn('px-3 py-1 rounded text-sm transition-colors', filterDifficulty === 'medium' ? 'bg-red-100 text-red-700' : 'text-gray-600 hover:bg-gray-100')}>一般</button>
              </div>
              
              {!deck && deckList && deckList.length > 0 && (
                <select value={filterDeckId} onChange={(e) => setFilterDeckId(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500 bg-white border-gray-200 text-gray-700">
                  <option value="all">全部题库</option>
                  {deckList.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              )}
              
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500 bg-white border-gray-200 text-gray-700">
                <option value="lapses">按错误次数</option>
                <option value="accuracy">按正确率</option>
                <option value="recent">按最近复习</option>
                <option value="difficulty">按难度系数</option>
              </select>
            </div>
          </div>
        </div>


        {/* 错题列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {(!wrongQuestions || wrongQuestions.length === 0) ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-green-100">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2 text-gray-900">
                {searchTerm ? '没有找到匹配的错题' : '太棒了！暂无错题'}
              </h2>
              <p className="mb-4 text-gray-500">
                {searchTerm ? '试试其他关键词' : '在练习中答错的题目会自动收集到这里'}
              </p>
              <div className="text-sm space-y-1 text-gray-400">
                <p>💡 提示：</p>
                <p>• 在「智能复习」或「强化突击」模式中答错题目</p>
                <p>• 错题会自动记录到错题本</p>
                <p>• 可以针对错题进行专项练习</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {wrongQuestions.map((wq: WrongQuestion) => {
                const question = wq.question;
                if (!question) return null;
                
                const isExpanded = expandedId === wq.id;
                
                return (
                  <Card key={wq.id} className={cn('transition-all overflow-hidden', selectedIds.has(wq.questionId) ? 'ring-2 ring-red-500 bg-red-50' : 'hover:shadow-md')}>
                    <CardContent className="py-4">
                      <div className="flex items-start gap-4">
                        <div 
                          className={cn('w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 cursor-pointer', selectedIds.has(wq.questionId) ? 'bg-red-500 border-red-500' : 'border-gray-300 hover:border-red-400')}
                          onClick={(e) => { e.stopPropagation(); toggleSelect(wq.questionId); }}
                        >
                          {selectedIds.has(wq.questionId) && (<CheckCircle size={12} className="text-white" />)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className={cn("mb-2 cursor-pointer text-gray-800", !isExpanded && "line-clamp-2")} onClick={() => setExpandedId(isExpanded ? null : wq.id)}>
                            {getContentText(question.content)}
                          </p>
                          
                          {isExpanded && (
                            <div className="mt-3 space-y-3">
                              <div className="space-y-2">
                                {question.options?.map((opt: any, idx: number) => {
                                  const optionContent = typeof opt === 'string' ? opt : getContentText(opt.content);
                                  const optionId = String.fromCharCode(65 + idx);
                                  const isCorrect = (typeof opt === 'object' && opt.isCorrect) || question.answer === optionId || (Array.isArray(question.answer) && question.answer.includes(optionId));
                                  
                                  return (
                                    <div key={typeof opt === 'object' ? (opt.id || idx) : idx} className={cn("flex items-start gap-2 p-2 rounded-lg text-sm border", isCorrect ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-100")}>
                                      <span className={cn("font-medium", isCorrect ? "text-green-500" : "text-gray-500")}>{optionId}.</span>
                                      <span className={isCorrect ? "text-green-500" : "text-gray-600"}>{optionContent}</span>
                                      {isCorrect && (<CheckCircle size={14} className="text-green-500 ml-auto flex-shrink-0" />)}
                                    </div>
                                  );
                                })}
                              </div>
                              
                              {question.explanation && (
                                <div className="p-3 rounded-lg border bg-blue-50 border-blue-100">
                                  <div className="text-xs font-medium mb-1 text-blue-700">解析</div>
                                  <p className="text-sm whitespace-pre-line text-blue-800">{question.explanation}</p>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                                {showResetConfirm === wq.questionId ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">确定重置此题？</span>
                                    <button onClick={() => handleResetQuestion(wq.questionId)} className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">确定</button>
                                    <button onClick={() => setShowResetConfirm(null)} className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-700 hover:bg-gray-300">取消</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setShowResetConfirm(wq.questionId)} className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors text-gray-500 hover:text-red-600 hover:bg-red-50">
                                    <RotateCcw size={12} />重置记录
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-3 text-xs flex-wrap">
                            <span className={cn('px-2 py-0.5 rounded-full', wq.wrongCount >= 3 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700')}>
                              <XCircle size={10} className="inline mr-1" />错{wq.wrongCount}次
                            </span>
                            <span className="text-gray-400"><Clock size={10} className="inline mr-1" />{formatDate(wq.lastWrongTime)}</span>
                            {question.tags && question.tags.length > 0 && (
                              <span className="text-gray-400">{question.tags.slice(0, 2).join(', ')}{question.tags.length > 2 && '...'}</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex flex-col items-center gap-1">
                            <div className={cn('w-2 h-8 rounded-full', wq.wrongCount >= 3 ? 'bg-red-400' : wq.wrongCount >= 2 ? 'bg-orange-400' : 'bg-yellow-400')} />
                            <span className="text-xs text-gray-400">{wq.wrongCount >= 3 ? '困难' : wq.wrongCount >= 2 ? '较难' : '一般'}</span>
                          </div>
                          
                          <button onClick={() => setExpandedId(isExpanded ? null : wq.id)} className="p-1 rounded transition-colors hover:bg-gray-100">
                            {isExpanded ? (<ChevronUp size={16} className="text-gray-400" />) : (<ChevronDown size={16} className="text-gray-400" />)}
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {wrongQuestions && wrongQuestions.length > 0 && (
          <div className="p-4 border-t text-center bg-gray-50 border-gray-200 flex-shrink-0">
            <p className="text-sm text-gray-500">💡 提示：点击题目可展开查看详情和正确答案</p>
          </div>
        )}
      </div>
    </AnimatedModal>
  );
}
