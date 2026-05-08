/**
 * 题目搜索与筛选组件
 * 支持关键词搜索、标签筛选、难度筛选等
 */
import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Filter,
  Tag,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Play,
  RotateCcw
} from 'lucide-react';
import Button from './ui/Button';
import AnimatedModal from './ui/AnimatedModal';
import { cn } from '../lib/utils';
import { db } from "../lib/database";

interface Question {
  id: string;
  deckId: string;
  content: string | { text: string };
  type: string;
  options: { id: string; text: string; content?: { text: string } }[];
  correctAnswer: string | string[];
  explanation?: string;
  tags?: string[];
  difficulty?: number;
  createdAt: number;
}

// 获取内容文本
const getContentText = (content: string | { text: string } | undefined): string => {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content.text || '';
};

interface Card {
  id: string;
  deckId: string;
  questionId: string;
  state: string;
  due: number;
  errorCount: number;
  correctCount: number;
}

interface QuestionSearchProps {
  isOpen: boolean;
  onClose: () => void;
  deckId?: string;
  onStartPractice?: (questionIds: string[]) => void;
}

export default function QuestionSearch({
  isOpen,
  onClose,
  deckId,
  onStartPractice
}: QuestionSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());

  // 筛选条件
  const [filters, setFilters] = useState({
    type: 'all',
    difficulty: 'all',
    status: 'all',
    tags: [] as string[],
  });

  // 排序
  const [sortBy, setSortBy] = useState<'date' | 'difficulty' | 'errorRate'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (isOpen) {
      loadQuestions();
    }
  }, [isOpen, deckId]);

  const loadQuestions = async () => {
    setIsLoading(true);
    try {
      let questionsData: Question[] = [];
      let cardsData: Card[] = [];

      if (deckId) {
        questionsData = await db.questions.where('deckId').equals(deckId).toArray();
        cardsData = await db.cards.where('deckId').equals(deckId).toArray();
      } else {
        questionsData = await db.questions.toArray();
        cardsData = await db.cards.toArray();
      }

      setQuestions(questionsData);
      setCards(cardsData);
    } catch (error) {
      console.error('Failed to load questions:', error);
    }
    setIsLoading(false);
  };

  // 获取所有标签
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    questions.forEach(q => {
      q.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [questions]);

  // 获取卡片状态
  const getCardStatus = (questionId: string) => {
    const card = cards.find(c => c.questionId === questionId);
    if (!card) return 'new';
    if (card.state === 'new') return 'new';
    if (card.errorCount > card.correctCount) return 'difficult';
    if (card.state === 'review' || card.state === 'learning') return 'learning';
    return 'mastered';
  };

  // 获取错误率
  const getErrorRate = (questionId: string) => {
    const card = cards.find(c => c.questionId === questionId);
    if (!card) return 0;
    const total = card.errorCount + card.correctCount;
    return total > 0 ? card.errorCount / total : 0;
  };

  // 筛选和排序
  const filteredQuestions = useMemo(() => {
    let result = [...questions];

    // 关键词搜索
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(q => {
        const contentText = getContentText(q.content);
        const optionTexts = q.options?.map(o => o.text || getContentText(o.content)) || [];
        return (
          contentText.toLowerCase().includes(query) ||
          optionTexts.some(t => t?.toLowerCase().includes(query)) ||
          q.tags?.some(t => t.toLowerCase().includes(query))
        );
      });
    }

    // 类型筛选
    if (filters.type !== 'all') {
      result = result.filter(q => q.type === filters.type);
    }

    // 难度筛选
    if (filters.difficulty !== 'all') {
      const diffLevel = parseInt(filters.difficulty);
      result = result.filter(q => q.difficulty === diffLevel);
    }

    // 状态筛选
    if (filters.status !== 'all') {
      result = result.filter(q => getCardStatus(q.id) === filters.status);
    }

    // 标签筛选
    if (filters.tags.length > 0) {
      result = result.filter(q =>
        filters.tags.some(tag => q.tags?.includes(tag))
      );
    }

    // 排序
    result.sort((a, b) => {
      let compare = 0;
      switch (sortBy) {
        case 'date':
          compare = a.createdAt - b.createdAt;
          break;
        case 'difficulty':
          compare = (a.difficulty || 3) - (b.difficulty || 3);
          break;
        case 'errorRate':
          compare = getErrorRate(a.id) - getErrorRate(b.id);
          break;
      }
      return sortOrder === 'asc' ? compare : -compare;
    });

    return result;
  }, [questions, searchQuery, filters, sortBy, sortOrder, cards]);

  const handleSelectAll = () => {
    if (selectedQuestions.size === filteredQuestions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(filteredQuestions.map(q => q.id)));
    }
  };

  const handleSelectQuestion = (id: string) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedQuestions(newSelected);
  };

  const handleStartPractice = () => {
    if (selectedQuestions.size > 0 && onStartPractice) {
      onStartPractice(Array.from(selectedQuestions));
      onClose();
    }
  };

  const resetFilters = () => {
    setFilters({
      type: 'all',
      difficulty: 'all',
      status: 'all',
      tags: [],
    });
    setSearchQuery('');
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'MCQ': '单选题',
      'MULTI': '多选题',
      'TRUE_FALSE': '判断题',
      'FILL': '填空题',
      'SHORT_ANSWER': '简答题',
    };
    return types[type] || type;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-600';
      case 'learning': return 'bg-yellow-100 text-yellow-600';
      case 'difficult': return 'bg-red-100 text-red-600';
      case 'mastered': return 'bg-green-100 text-green-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return '新题';
      case 'learning': return '学习中';
      case 'difficult': return '困难';
      case 'mastered': return '已掌握';
      default: return '未知';
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b flex-shrink-0 border-gray-200 bg-gradient-to-r from-violet-500 to-purple-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Search className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">题目搜索</h2>
                <p className="text-xs text-white/80">搜索和筛选题目</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg">
              <X size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b flex-shrink-0 border-gray-100">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索题目内容、选项或标签..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-purple-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "px-4 py-2 rounded-xl border flex items-center gap-2",
                showFilters
                  ? "bg-purple-500 text-white border-purple-500"
                  : "bg-white border-gray-200 text-gray-600 hover:border-purple-500"
              )}
            >
              <Filter size={18} />
              筛选
              {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 p-4 rounded-xl space-y-4 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 题目类型 */}
                <div>
                  <label className="text-xs font-medium mb-1 block text-gray-600">
                    题目类型
                  </label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white text-gray-900"
                  >
                    <option value="all">全部类型</option>
                    <option value="MCQ">单选题</option>
                    <option value="MULTI">多选题</option>
                    <option value="TRUE_FALSE">判断题</option>
                    <option value="FILL">填空题</option>
                    <option value="SHORT_ANSWER">简答题</option>
                  </select>
                </div>

                {/* 难度 */}
                <div>
                  <label className="text-xs font-medium mb-1 block text-gray-600">
                    难度等级
                  </label>
                  <select
                    value={filters.difficulty}
                    onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white text-gray-900"
                  >
                    <option value="all">全部难度</option>
                    <option value="1">⭐ 简单</option>
                    <option value="2">⭐⭐ 较易</option>
                    <option value="3">⭐⭐⭐ 中等</option>
                    <option value="4">⭐⭐⭐⭐ 较难</option>
                    <option value="5">⭐⭐⭐⭐⭐ 困难</option>
                  </select>
                </div>

                {/* 掌握状态 */}
                <div>
                  <label className="text-xs font-medium mb-1 block text-gray-600">
                    掌握状态
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white text-gray-900"
                  >
                    <option value="all">全部状态</option>
                    <option value="new">新题</option>
                    <option value="learning">学习中</option>
                    <option value="difficult">困难</option>
                    <option value="mastered">已掌握</option>
                  </select>
                </div>

                {/* 排序 */}
                <div>
                  <label className="text-xs font-medium mb-1 block text-gray-600">
                    排序方式
                  </label>
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [by, order] = e.target.value.split('-');
                      setSortBy(by as any);
                      setSortOrder(order as any);
                    }}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-white text-gray-900"
                  >
                    <option value="date-desc">最新添加</option>
                    <option value="date-asc">最早添加</option>
                    <option value="difficulty-desc">难度从高到低</option>
                    <option value="difficulty-asc">难度从低到高</option>
                    <option value="errorRate-desc">错误率从高到低</option>
                    <option value="errorRate-asc">错误率从低到高</option>
                  </select>
                </div>
              </div>

              {/* 标签筛选 */}
              {allTags.length > 0 && (
                <div>
                  <label className="text-xs font-medium mb-2 block text-gray-600">
                    标签筛选
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => {
                          const newTags = filters.tags.includes(tag)
                            ? filters.tags.filter(t => t !== tag)
                            : [...filters.tags, tag];
                          setFilters({ ...filters, tags: newTags });
                        }}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium",
                          filters.tags.includes(tag)
                            ? "bg-purple-500 text-white"
                            : "bg-gray-200 text-gray-600"
                        )}
                      >
                        <Tag size={12} className="inline mr-1" />
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 重置筛选 */}
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-sm text-gray-500"
              >
                <RotateCcw size={14} />
                重置筛选
              </button>
            </div>
          )}
        </div>

        {/* Stats Bar */}
        <div className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0 border-gray-100 bg-gray-50">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              找到 <strong>{filteredQuestions.length}</strong> 道题目
            </span>
            {selectedQuestions.size > 0 && (
              <span className="text-sm text-purple-500">
                已选择 {selectedQuestions.size} 道
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="text-sm px-3 py-1 rounded-lg text-gray-600"
            >
              {selectedQuestions.size === filteredQuestions.length ? '取消全选' : '全选'}
            </button>
          </div>
        </div>

        {/* Questions List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="text-center py-12">
              <Search size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">未找到匹配的题目</p>
              <p className="text-sm mt-1 text-gray-400">尝试调整搜索条件或筛选选项</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQuestions.map(question => {
                const status = getCardStatus(question.id);
                const errorRate = getErrorRate(question.id);
                const isSelected = selectedQuestions.has(question.id);

                return (
                  <div
                    key={question.id}
                    onClick={() => handleSelectQuestion(question.id)}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer",
                      isSelected
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                          isSelected
                            ? "bg-purple-500 border-purple-500"
                            : "border-gray-300"
                        )}
                      >
                        {isSelected && <CheckCircle size={14} className="text-white" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            {getTypeLabel(question.type)}
                          </span>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-xs font-medium",
                              getStatusColor(status)
                            )}
                          >
                            {getStatusLabel(status)}
                          </span>
                          {question.difficulty && (
                            <span className="text-xs text-gray-500">
                              {'⭐'.repeat(question.difficulty)}
                            </span>
                          )}
                          {errorRate > 0 && (
                            <span className="text-xs text-red-500">
                              错误率 {Math.round(errorRate * 100)}%
                            </span>
                          )}
                        </div>
                        <p className="text-sm line-clamp-2 text-gray-900">
                          {getContentText(question.content)}
                        </p>
                        {question.tags && question.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {question.tags.map(tag => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between flex-shrink-0 border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">💡 选择题目后可开始专项练习</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button
              variant="liquid-glass-blue"
              onClick={handleStartPractice}
              disabled={selectedQuestions.size === 0}
              leftIcon={<Play size={16} />}
            >
              开始练习 ({selectedQuestions.size})
            </Button>
          </div>
        </div>
      </div>
    </AnimatedModal>
  );
}
