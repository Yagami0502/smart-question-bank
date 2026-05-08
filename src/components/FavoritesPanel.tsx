/**
 * 收藏夹面板组件
 * 管理用户收藏的题目，支持练习功能
 */
import { useState, useEffect } from 'react';
import { X, Star, Trash2, Search, Filter, ChevronRight, ChevronDown, Tag, CheckCircle, Play, Zap } from 'lucide-react';
import AnimatedModal from './ui/AnimatedModal';
import Button from './ui/Button';
import { cn } from '../lib/utils';
import { dialog } from './ui/ConfirmDialog';
import { favoriteOperations, type Favorite } from '../lib/database-mysql';

interface FavoritesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onPractice?: (questionIds: string[], deckId: string) => void;
}

export default function FavoritesPanel({ isOpen, onClose, onPractice }: FavoritesPanelProps) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadFavorites();
    }
  }, [isOpen]);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const data = await favoriteOperations.getAll();
      setFavorites(data);
    } catch (error) {
      console.error('加载收藏失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (questionId: string) => {
    try {
      await favoriteOperations.remove(questionId);
      loadFavorites();
    } catch (error) {
      console.error('删除收藏失败:', error);
    }
  };

  const handleToggleSelect = (questionId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId);
    } else {
      newSelected.add(questionId);
    }
    setSelectedIds(newSelected);
  };

  const allTags = Array.from(new Set(favorites.flatMap(f => f.tags || [])));
  
  // 获取所有题库列表
  const deckList = Array.from(
    new Map(favorites.filter(f => f.deckId && f.deckName).map(f => [f.deckId, f.deckName])).entries()
  ).map(([id, name]) => ({ id, name }));

  const filteredFavorites = favorites.filter(fav => {
    const content = typeof fav.content === 'string' ? fav.content : (fav.content as any)?.text || '';
    const matchesSearch = searchQuery ? content.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    const matchesTag = selectedTag ? (fav.tags || []).includes(selectedTag) : true;
    const matchesDeck = selectedDeckId === 'all' || fav.deckId === selectedDeckId;
    return matchesSearch && matchesTag && matchesDeck;
  });

  const handleSelectAll = () => {
    if (selectedIds.size === filteredFavorites.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFavorites.map(f => f.questionId)));
    }
  };

  const handleRemoveSelected = async () => {
    const confirmed = await dialog.confirm(`确定要删除 ${selectedIds.size} 个收藏吗？`, { title: '删除收藏', isDanger: true });
    if (confirmed) {
      try {
        for (const id of selectedIds) {
          await favoriteOperations.remove(id);
        }
        setSelectedIds(new Set());
        loadFavorites();
      } catch (error) {
        console.error('批量删除失败:', error);
      }
    }
  };

  const handlePracticeSelected = () => {
    if (onPractice && selectedIds.size > 0) {
      // 获取选中题目的第一个题库ID
      const selectedFav = filteredFavorites.find(f => selectedIds.has(f.questionId));
      if (selectedFav?.deckId) {
        onPractice(Array.from(selectedIds), selectedFav.deckId);
        onClose();
      }
    }
  };

  const handlePracticeAll = () => {
    if (onPractice && filteredFavorites.length > 0) {
      // 获取第一个题目的题库ID
      const firstFav = filteredFavorites[0];
      if (firstFav?.deckId) {
        onPractice(filteredFavorites.map(f => f.questionId), firstFav.deckId);
        onClose();
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'MCQ': '单选题',
      'MULTI': '多选题',
      'TRUE_FALSE': '判断题',
      'FILL': '填空题',
      'SHORT_ANSWER': '简答题',
    };
    return labels[type] || type;
  };

  const getContentText = (content: any): string => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (typeof content === 'object' && content.text) return content.text;
    return String(content);
  };

  const getOptionText = (option: any): string => {
    if (!option) return '';
    if (typeof option === 'string') return option;
    if (option.content) {
      if (typeof option.content === 'string') return option.content;
      if (option.content.text) return option.content.text;
    }
    if (option.text) return option.text;
    return String(option);
  };

  const toggleExpand = (questionId: string) => {
    setExpandedId(expandedId === questionId ? null : questionId);
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between flex-shrink-0 border-gray-200 bg-gradient-to-r from-amber-400 to-yellow-500">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Star className="w-6 h-6 text-white fill-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">我的收藏</h2>
              <p className="text-sm text-white/80">{favorites.length} 道题目</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 ? (
              <Button variant="secondary" size="sm" leftIcon={<Play size={16} />} onClick={handlePracticeSelected} className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                练习选中 ({selectedIds.size})
              </Button>
            ) : filteredFavorites.length > 0 && (
              <Button variant="secondary" size="sm" leftIcon={<Zap size={16} />} onClick={handlePracticeAll} className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                练习全部
              </Button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/20">
              <X size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="p-4 border-b flex-shrink-0 border-gray-100 bg-gray-50 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200">
              <Search size={16} className="text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索收藏的题目..."
                className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
              />
            </div>
            
            {deckList.length > 0 && (
              <select 
                value={selectedDeckId} 
                onChange={(e) => setSelectedDeckId(e.target.value)} 
                className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 bg-white border-gray-200 text-gray-700"
              >
                <option value="all">全部题库</option>
                {deckList.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
              </select>
            )}
          </div>

          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-gray-400" />
              <button
                onClick={() => setSelectedTag(null)}
                className={cn(
                  "px-2 py-1 rounded-full text-xs transition-colors",
                  selectedTag === null ? "bg-amber-500 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                )}
              >
                全部
              </button>
              {allTags.slice(0, 5).map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                  className={cn(
                    "px-2 py-1 rounded-full text-xs transition-colors",
                    selectedTag === tag ? "bg-amber-500 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selection Bar */}
        {selectedIds.size > 0 && (
          <div className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0 border-gray-100 bg-amber-50">
            <span className="text-sm text-amber-700">已选择 {selectedIds.size} 题</span>
            <Button size="sm" variant="danger" onClick={handleRemoveSelected} leftIcon={<Trash2 size={14} />}>
              删除选中
            </Button>
          </div>
        )}

        {/* Favorites List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">加载中...</p>
            </div>
          ) : filteredFavorites.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Star size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-1">暂无收藏</p>
              <p className="text-sm">在练习时点击星标收藏题目</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <button onClick={handleSelectAll} className="text-sm text-gray-500">
                  {selectedIds.size === filteredFavorites.length ? '取消全选' : '全选'}
                </button>
                <span className="text-xs text-gray-400">共 {filteredFavorites.length} 题</span>
              </div>

              {filteredFavorites.map(fav => (
                <div
                  key={fav.id}
                  className={cn(
                    "rounded-xl border overflow-hidden",
                    selectedIds.has(fav.questionId)
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleSelect(fav.questionId)}
                        className={cn(
                          "mt-1 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                          selectedIds.has(fav.questionId)
                            ? "bg-amber-500 border-amber-500 text-white"
                            : "border-gray-300 hover:border-gray-400"
                        )}
                      >
                        {selectedIds.has(fav.questionId) && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(fav.questionId)}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                            {getTypeLabel(fav.type)}
                          </span>
                          {fav.deckName && <span className="text-xs text-gray-400">{fav.deckName}</span>}
                          <span className="text-xs text-gray-400">{formatDate(fav.createdAt)}</span>
                        </div>
                        <p className={cn("text-sm mb-2 text-gray-800", expandedId === fav.questionId ? "" : "line-clamp-2")}>
                          {getContentText(fav.content)}
                        </p>
                        {fav.tags && fav.tags.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <Tag size={12} className="text-gray-400" />
                            {fav.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleRemove(fav.questionId)}
                          className="p-2 rounded-lg text-gray-400"
                          title="取消收藏"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button onClick={() => toggleExpand(fav.questionId)} className="p-1 rounded text-gray-400">
                          {expandedId === fav.questionId ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {expandedId === fav.questionId && fav.options && fav.options.length > 0 && (
                    <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50">
                      <p className="text-xs font-medium mb-2 text-gray-500">选项：</p>
                      <div className="space-y-2">
                        {fav.options.map((option: any, index: number) => {
                          const optionId = option.id || String.fromCharCode(65 + index);
                          const isCorrect = option.isCorrect;
                          return (
                            <div
                              key={optionId}
                              className={cn(
                                "flex items-start gap-2 p-2 rounded-lg text-sm",
                                isCorrect ? "bg-green-50 border border-green-200" : "bg-white"
                              )}
                            >
                              <span
                                className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium",
                                  isCorrect ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"
                                )}
                              >
                                {optionId}
                              </span>
                              <span className={cn("flex-1", isCorrect ? "text-green-700" : "text-gray-700")}>
                                {getOptionText(option)}
                              </span>
                              {isCorrect && <CheckCircle size={16} className="text-green-500" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-center flex-shrink-0 border-gray-100 bg-gray-50">
          <p className="text-sm text-gray-500">💡 在练习时点击题目右上角的星标添加收藏</p>
        </div>
      </div>
    </AnimatedModal>
  );
}

export { favoriteOperations };
