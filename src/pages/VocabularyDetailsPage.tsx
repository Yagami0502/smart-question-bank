/**
 * 词库详情页面 - 展示词库中的所有单词（电脑端优化版）
 */
import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  BookOpen,
  Clock,
  CheckCircle,
  AlertCircle,
  Volume2,
  Star,
  StarOff,
  Filter,
  X,
  Award,
  TrendingUp,
  Calendar,
  Edit3,
  Trash2,
  Save,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { cn } from '../lib/utils';
import { dialog } from '../components/ui/ConfirmDialog';
import {
  wordOperations,
  favoriteWordOperations,
  masteredWordOperations,
  wrongWordOperations,
  wordProgressOperations,
} from '../lib/vocabulary-db';
import { speechService } from '../lib/speech-service';
import type { Word, WordProgress } from '../types/vocabulary';

interface VocabularyDetailsPageProps {
  bookId: string;
  bookName: string;
  initialFilter?: FilterType;
  onBack: () => void;
}

type FilterType = 'all' | 'new' | 'learning' | 'mastered' | 'wrong';

export default function VocabularyDetailsPage({ 
  bookId, 
  bookName, 
  initialFilter = 'all',
  onBack 
}: VocabularyDetailsPageProps) {
  const [words, setWords] = useState<Word[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, WordProgress>>(new Map());
  const [wrongWordsSet, setWrongWordsSet] = useState<Set<string>>(new Set());
  const [favoritesSet, setFavoritesSet] = useState<Set<string>>(new Set());
  const [masteredSet, setMasteredSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [searchTerm, setSearchTerm] = useState('');
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [editTranslations, setEditTranslations] = useState<{ type: string; translation: string }[]>([]);
  const [editPhrases, setEditPhrases] = useState<{ phrase: string; translation: string }[]>([]);
  const [editSentences, setEditSentences] = useState<{ sentence: string; translation: string }[]>([]);
  const [deletingWordId, setDeletingWordId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 同步 initialFilter prop 到 filter 状态
  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        const [wordsData, progressData, wrongData, favData, masteredData] = await Promise.all([
          wordOperations.getByBookId(bookId),
          wordProgressOperations.getByBookId(bookId),
          wrongWordOperations.getByBookId(bookId),
          favoriteWordOperations.getAll(),
          masteredWordOperations.getAll(),
        ]);

        setWords(wordsData);
        
        const pMap = new Map<string, WordProgress>();
        progressData.forEach(p => pMap.set(p.wordId, p));
        setProgressMap(pMap);
        
        setWrongWordsSet(new Set(wrongData.map(w => w.wordId)));
        setFavoritesSet(new Set(favData.filter(f => f.bookId === bookId).map(f => f.wordId)));
        setMasteredSet(new Set(masteredData.filter(m => m.bookId === bookId).map(m => m.wordId)));
      } catch (error) {
        console.error('加载词库数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [bookId]);

  // 获取单词状态
  const getWordStatus = (wordId: string): FilterType => {
    if (masteredSet.has(wordId)) return 'mastered';
    if (wrongWordsSet.has(wordId)) return 'wrong';
    const progress = progressMap.get(wordId);
    if (!progress || progress.state === 'new') return 'new';
    if (progress.state === 'learning' || progress.state === 'review') return 'learning';
    return 'new';
  };

  // 统计数据
  const stats = useMemo(() => {
    const counts = { all: words.length, new: 0, learning: 0, mastered: 0, wrong: 0 };
    words.forEach(w => {
      const status = getWordStatus(w.id);
      if (status === 'new') counts.new++;
      else if (status === 'learning') counts.learning++;
      else if (status === 'mastered') counts.mastered++;
      if (wrongWordsSet.has(w.id)) counts.wrong++;
    });
    return counts;
  }, [words, progressMap, wrongWordsSet, masteredSet]);

  // 过滤单词
  const filteredWords = useMemo(() => {
    let filtered = words;
    
    if (filter !== 'all') {
      if (filter === 'wrong') {
        filtered = filtered.filter(w => wrongWordsSet.has(w.id));
      } else {
        filtered = filtered.filter(w => getWordStatus(w.id) === filter);
      }
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(w => 
        w.word.toLowerCase().includes(term) ||
        w.translations.some(t => (t.translation || '').toLowerCase().includes(term))
      );
    }
    
    return filtered;
  }, [words, filter, searchTerm, progressMap, wrongWordsSet, masteredSet]);

  // 播放发音
  const handlePlayAudio = async (word: string, wordId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPlayingWordId(wordId);
    try {
      await speechService.speak(word, { voiceType: 'us' });
    } finally {
      setPlayingWordId(null);
    }
  };

  // 切换收藏
  const handleToggleFavorite = async (word: Word, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const isFav = favoritesSet.has(word.id);
    await favoriteWordOperations.toggle(word.id, bookId, word.word);
    setFavoritesSet(prev => {
      const newSet = new Set(prev);
      if (isFav) newSet.delete(word.id);
      else newSet.add(word.id);
      return newSet;
    });
  };

  // 打开编辑弹窗
  const openEditWord = (word: Word) => {
    setEditingWord(word);
    setEditTranslations(word.translations.map((t: any) => ({
      type: t.type || t.pos || '',
      translation: t.translation || t.cn || '',
    })));
    setEditPhrases(word.phrases?.map((p: any) => ({
      phrase: p.phrase || '',
      translation: p.translation || '',
    })) || []);
    setEditSentences(word.sentences?.map((s: any) => ({
      sentence: s.sentence || '',
      translation: s.translation || '',
    })) || []);
  };

  // 关闭编辑弹窗
  const closeEditWord = () => {
    setEditingWord(null);
    setEditTranslations([]);
    setEditPhrases([]);
    setEditSentences([]);
    setIsSaving(false);
  };

  // 保存编辑
  const saveEditedWord = async () => {
    if (!editingWord) return;
    setIsSaving(true);
    try {
      const updatedTranslations = editTranslations.map(t => ({
        type: t.type,
        pos: t.type,
        translation: t.translation,
        cn: t.translation,
      }));
      const updatedPhrases = editPhrases.filter(p => p.phrase.trim() || p.translation.trim());
      const updatedSentences = editSentences.filter(s => s.sentence.trim() || s.translation.trim());
      
      await wordOperations.update(editingWord.id, { 
        translations: updatedTranslations,
        phrases: updatedPhrases,
        sentences: updatedSentences,
      });
      // 更新本地状态
      const updatedWord = { 
        ...editingWord, 
        translations: updatedTranslations,
        phrases: updatedPhrases,
        sentences: updatedSentences,
      };
      setWords(prev => prev.map(w => w.id === editingWord.id ? updatedWord : w));
      if (selectedWord?.id === editingWord.id) {
        setSelectedWord(updatedWord);
      }
      closeEditWord();
    } catch (error) {
      console.error('保存单词失败:', error);
      dialog.error('保存失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsSaving(false);
    }
  };

  // 删除单词
  const handleDeleteWord = async (wordId: string) => {
    const confirmed = await dialog.confirm('确定要删除这个单词吗？此操作不可撤销。', { 
      title: '删除单词', 
      isDanger: true 
    });
    if (!confirmed) return;
    
    setDeletingWordId(wordId);
    try {
      await wordOperations.delete(wordId);
      // 同时删除相关的收藏、掌握、错词记录
      await favoriteWordOperations.remove(wordId);
      await masteredWordOperations.remove(wordId);
      await wrongWordOperations.remove(wordId);
      // 删除学习进度
      await wordProgressOperations.delete(wordId);
      
      // 更新本地状态
      setWords(prev => prev.filter(w => w.id !== wordId));
      setFavoritesSet(prev => { const s = new Set(prev); s.delete(wordId); return s; });
      setMasteredSet(prev => { const s = new Set(prev); s.delete(wordId); return s; });
      setWrongWordsSet(prev => { const s = new Set(prev); s.delete(wordId); return s; });
      setProgressMap(prev => { const m = new Map(prev); m.delete(wordId); return m; });
      
      if (selectedWord?.id === wordId) setSelectedWord(null);
    } catch (error) {
      console.error('删除单词失败:', error);
      dialog.error('删除失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setDeletingWordId(null);
    }
  };

  // 添加释义
  const handleAddTranslation = () => {
    setEditTranslations(prev => [...prev, { type: '', translation: '' }]);
  };

  // 删除释义
  const handleRemoveTranslation = (index: number) => {
    if (editTranslations.length <= 1) return;
    setEditTranslations(prev => prev.filter((_, i) => i !== index));
  };

  // 状态配置 - 使用完整的 Tailwind 类名以支持 JIT 模式
  const statusConfig = {
    new: { 
      label: '新单词', 
      icon: AlertCircle,
      btnActive: 'bg-blue-100 text-blue-700 ring-2 ring-blue-500',
      countActive: 'bg-blue-200',
      badge: 'bg-blue-100 text-blue-700',
    },
    learning: { 
      label: '学习中', 
      icon: Clock,
      btnActive: 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-500',
      countActive: 'bg-yellow-200',
      badge: 'bg-yellow-100 text-yellow-700',
    },
    mastered: { 
      label: '已掌握', 
      icon: CheckCircle,
      btnActive: 'bg-green-100 text-green-700 ring-2 ring-green-500',
      countActive: 'bg-green-200',
      badge: 'bg-green-100 text-green-700',
    },
    wrong: { 
      label: '易错词', 
      icon: AlertCircle,
      btnActive: 'bg-red-100 text-red-700 ring-2 ring-red-500',
      countActive: 'bg-red-200',
      badge: 'bg-red-100 text-red-700',
    },
    all: { 
      label: '全部', 
      icon: BookOpen,
      btnActive: 'bg-gray-100 text-gray-700 ring-2 ring-gray-500',
      countActive: 'bg-gray-200',
      badge: 'bg-gray-100 text-gray-700',
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* 头部 */}
      <header className="liquid-glass-wrapper liquid-glass-header flex-shrink-0" style={{ '--border-radius': '0' } as React.CSSProperties}>
        <div className="liquid-glass-outer" />
        <div className="liquid-glass-cover" />
        <div className="liquid-glass-sharp" />
        <div className="liquid-glass-reflect" />
        <div className="liquid-glass-content">
          <div className="max-w-[1600px] mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={18} />} onClick={onBack}>
                  返回
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-gray-800">{bookName}</h1>
                  <p className="text-xs text-gray-500">共 {words.length} 个单词</p>
                </div>
              </div>
              
              {/* 统计标签 */}
              <div className="hidden md:flex items-center gap-2">
                {(['all', 'new', 'learning', 'mastered', 'wrong'] as FilterType[]).map(f => {
                  const config = statusConfig[f];
                  const count = f === 'all' ? stats.all : stats[f];
                  const isActive = filter === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                        isActive 
                          ? config.btnActive
                          : 'bg-white/50 text-gray-600 hover:bg-white/80'
                      )}
                    >
                      <config.icon size={14} />
                      <span>{config.label}</span>
                      <span className={cn(
                        'px-1.5 py-0.5 rounded-full text-xs',
                        isActive ? config.countActive : 'bg-gray-200'
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 - 左右分栏 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：单词列表 */}
        <div className={cn(
          "flex flex-col bg-white/50 border-r border-gray-200 transition-all",
          selectedWord ? "w-1/2 lg:w-2/5" : "w-full"
        )}>
          {/* 搜索框 */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="搜索单词或释义..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white border-gray-300"
              />
            </div>
          </div>

          {/* 单词列表 */}
          <div className="flex-1 overflow-y-auto">
            {filteredWords.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Filter size={48} className="mb-4 opacity-50" />
                <p className="font-medium">没有找到符合条件的单词</p>
                <p className="text-sm mt-1">试试调整筛选条件</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm">
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">单词</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">音标</th>
                    <th className="px-4 py-3 font-medium">释义</th>
                    <th className="px-4 py-3 font-medium text-center">状态</th>
                    <th className="px-4 py-3 font-medium text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredWords.map((word, index) => {
                    const status = getWordStatus(word.id);
                    const isFavorite = favoritesSet.has(word.id);
                    const isSelected = selectedWord?.id === word.id;
                    const config = statusConfig[status];

                    return (
                      <tr
                        key={word.id}
                        onClick={() => setSelectedWord(word)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'
                        )}
                      >
                        <td className="px-4 py-3 text-sm text-gray-400">{index + 1}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-900">{word.word}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                          {word.phonetic?.us && `/${word.phonetic.us}/`}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                          {word.translations.map((t: any) => `${t.type || t.pos || ''} ${t.translation || t.cn || ''}`).join('；')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                            config.badge
                          )}>
                            {config.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => handlePlayAudio(word.word, word.id, e)}
                              className={cn(
                                'p-1.5 rounded-lg transition-colors',
                                playingWordId === word.id ? 'bg-primary-100 text-primary-600' : 'hover:bg-gray-100 text-gray-500'
                              )}
                            >
                              <Volume2 size={14} />
                            </button>
                            <button
                              onClick={(e) => handleToggleFavorite(word, e)}
                              className={cn(
                                'p-1.5 rounded-lg transition-colors',
                                isFavorite ? 'text-yellow-500 bg-yellow-50' : 'text-gray-400 hover:bg-gray-100'
                              )}
                            >
                              {isFavorite ? <Star size={14} fill="currentColor" /> : <StarOff size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 右侧：单词详情 */}
        {selectedWord && (
          <div className="w-1/2 lg:w-3/5 flex flex-col bg-white overflow-hidden">
            {/* 详情头部 */}
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-3xl font-bold text-gray-900">{selectedWord.word}</h2>
                    <button
                      onClick={() => handlePlayAudio(selectedWord.word, selectedWord.id)}
                      className={cn(
                        'p-2 rounded-full transition-colors',
                        playingWordId === selectedWord.id ? 'bg-primary-100 text-primary-600' : 'hover:bg-gray-100 text-gray-500'
                      )}
                    >
                      <Volume2 size={20} />
                    </button>
                    <button
                      onClick={() => handleToggleFavorite(selectedWord)}
                      className={cn(
                        'p-2 rounded-full transition-colors',
                        favoritesSet.has(selectedWord.id) ? 'text-yellow-500 bg-yellow-50' : 'text-gray-400 hover:bg-gray-100'
                      )}
                    >
                      {favoritesSet.has(selectedWord.id) ? <Star size={20} fill="currentColor" /> : <StarOff size={20} />}
                    </button>
                  </div>
                  {selectedWord.phonetic && (
                    <div className="flex items-center gap-4 text-gray-500">
                      {selectedWord.phonetic.us && <span>美 /{selectedWord.phonetic.us}/</span>}
                      {selectedWord.phonetic.uk && <span>英 /{selectedWord.phonetic.uk}/</span>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button variant="ghost" size="sm" leftIcon={<Edit3 size={14} />} onClick={() => openEditWord(selectedWord)}>编辑</Button>
                  <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />} onClick={() => handleDeleteWord(selectedWord.id)} disabled={deletingWordId === selectedWord.id}>
                    {deletingWordId === selectedWord.id ? '删除中...' : '删除'}
                  </Button>
                  <button onClick={() => setSelectedWord(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><X size={18} /></button>
                </div>
              </div>
            </div>

            {/* 详情内容 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 释义 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">释义</h3>
                <div className="space-y-2">
                  {selectedWord.translations.map((t: any, i) => (
                    <div key={i} className="flex items-start gap-3">
                      {(t.type || t.pos) && (
                        <span className="px-2 py-0.5 rounded bg-primary-100 text-primary-700 text-sm font-medium">
                          {t.type || t.pos}
                        </span>
                      )}
                      <span className="text-gray-800 text-lg">{t.translation || t.cn || ''}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 短语 */}
              {selectedWord.phrases && selectedWord.phrases.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">常用短语</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {selectedWord.phrases.map((p, i) => (
                      <div key={i} className="p-3 rounded-lg bg-gray-50">
                        <p className="font-medium text-primary-700">{p.phrase}</p>
                        <p className="text-sm text-gray-600 mt-1">{p.translation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 例句 */}
              {selectedWord.sentences && selectedWord.sentences.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">例句</h3>
                  <div className="space-y-3">
                    {selectedWord.sentences.map((s, i) => (
                      <div key={i} className="p-4 rounded-lg bg-blue-50 border-l-4 border-blue-400">
                        <p className="text-gray-800">{s.sentence}</p>
                        <p className="text-sm text-gray-600 mt-2">{s.translation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 学习进度 */}
              {(() => {
                const progress = progressMap.get(selectedWord.id);
                if (!progress || progress.state === 'new') return null;
                
                const accuracy = (progress.correctCount + progress.wrongCount) > 0
                  ? Math.round((progress.correctCount / (progress.correctCount + progress.wrongCount)) * 100)
                  : 0;

                return (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">学习进度</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-blue-50">
                        <div className="flex items-center gap-2 text-blue-600 mb-1">
                          <TrendingUp size={16} />
                          <span className="text-sm font-medium">复习次数</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-700">{progress.reps}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-green-50">
                        <div className="flex items-center gap-2 text-green-600 mb-1">
                          <Award size={16} />
                          <span className="text-sm font-medium">正确率</span>
                        </div>
                        <p className="text-2xl font-bold text-green-700">{accuracy}%</p>
                      </div>
                      <div className="p-4 rounded-xl bg-red-50">
                        <div className="flex items-center gap-2 text-red-600 mb-1">
                          <AlertCircle size={16} />
                          <span className="text-sm font-medium">错误次数</span>
                        </div>
                        <p className="text-2xl font-bold text-red-700">{progress.lapses}</p>
                      </div>
                      {progress.lastReview && (
                        <div className="p-4 rounded-xl bg-purple-50">
                          <div className="flex items-center gap-2 text-purple-600 mb-1">
                            <Calendar size={16} />
                            <span className="text-sm font-medium">上次复习</span>
                          </div>
                          <p className="text-lg font-bold text-purple-700">
                            {new Date(progress.lastReview).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 同义词/反义词 */}
              {(selectedWord.synonyms?.length || selectedWord.antonyms?.length) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {selectedWord.synonyms && selectedWord.synonyms.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">同义词</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedWord.synonyms.map((s, i) => (
                          <span key={i} className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedWord.antonyms && selectedWord.antonyms.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">反义词</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedWord.antonyms.map((a, i) => (
                          <span key={i} className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 编辑单词弹窗 */}
      {editingWord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeEditWord}>
          <div className="rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between border-gray-200 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">编辑单词</h3>
              <button onClick={closeEditWord} className="p-2 rounded-lg transition-colors hover:bg-gray-100">
                <X size={20} className="text-gray-600" />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* 单词（只读） */}
              <div>
                <label className="text-sm font-medium mb-2 block text-gray-700">单词</label>
                <div className="px-3 py-2 rounded-lg bg-gray-100 text-gray-800 font-semibold">
                  {editingWord.word}
                </div>
              </div>

              {/* 释义列表 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">释义</label>
                  <button
                    onClick={handleAddTranslation}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    + 添加
                  </button>
                </div>
                <div className="space-y-2">
                  {editTranslations.map((t, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <input
                        type="text"
                        value={t.type}
                        onChange={(e) => {
                          const newTranslations = [...editTranslations];
                          newTranslations[index].type = e.target.value;
                          setEditTranslations(newTranslations);
                        }}
                        placeholder="词性"
                        className="w-16 px-2 py-1.5 rounded-lg border text-sm outline-none bg-white border-gray-300 focus:border-primary-500"
                      />
                      <input
                        type="text"
                        value={t.translation}
                        onChange={(e) => {
                          const newTranslations = [...editTranslations];
                          newTranslations[index].translation = e.target.value;
                          setEditTranslations(newTranslations);
                        }}
                        placeholder="释义"
                        className="flex-1 px-2 py-1.5 rounded-lg border text-sm outline-none bg-white border-gray-300 focus:border-primary-500"
                      />
                      {editTranslations.length > 1 && (
                        <button
                          onClick={() => handleRemoveTranslation(index)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 常用短语 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">常用短语</label>
                  <button
                    onClick={() => setEditPhrases(prev => [...prev, { phrase: '', translation: '' }])}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    + 添加
                  </button>
                </div>
                <div className="space-y-2">
                  {editPhrases.map((p, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <input
                        type="text"
                        value={p.phrase}
                        onChange={(e) => {
                          const newPhrases = [...editPhrases];
                          newPhrases[index].phrase = e.target.value;
                          setEditPhrases(newPhrases);
                        }}
                        placeholder="短语"
                        className="flex-1 px-2 py-1.5 rounded-lg border text-sm outline-none bg-white border-gray-300 focus:border-primary-500"
                      />
                      <input
                        type="text"
                        value={p.translation}
                        onChange={(e) => {
                          const newPhrases = [...editPhrases];
                          newPhrases[index].translation = e.target.value;
                          setEditPhrases(newPhrases);
                        }}
                        placeholder="翻译"
                        className="flex-1 px-2 py-1.5 rounded-lg border text-sm outline-none bg-white border-gray-300 focus:border-primary-500"
                      />
                      <button
                        onClick={() => setEditPhrases(prev => prev.filter((_, i) => i !== index))}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {editPhrases.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-2">暂无短语</p>
                  )}
                </div>
              </div>

              {/* 例句 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">例句</label>
                  <button
                    onClick={() => setEditSentences(prev => [...prev, { sentence: '', translation: '' }])}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    + 添加
                  </button>
                </div>
                <div className="space-y-2">
                  {editSentences.map((s, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-start gap-2">
                        <input
                          type="text"
                          value={s.sentence}
                          onChange={(e) => {
                            const newSentences = [...editSentences];
                            newSentences[index].sentence = e.target.value;
                            setEditSentences(newSentences);
                          }}
                          placeholder="英文例句"
                          className="flex-1 px-2 py-1.5 rounded-lg border text-sm outline-none bg-white border-gray-300 focus:border-primary-500"
                        />
                        <button
                          onClick={() => setEditSentences(prev => prev.filter((_, i) => i !== index))}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={s.translation}
                        onChange={(e) => {
                          const newSentences = [...editSentences];
                          newSentences[index].translation = e.target.value;
                          setEditSentences(newSentences);
                        }}
                        placeholder="中文翻译"
                        className="w-full px-2 py-1.5 rounded-lg border text-sm outline-none bg-white border-gray-300 focus:border-primary-500"
                      />
                    </div>
                  ))}
                  {editSentences.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-2">暂无例句</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <Button variant="ghost" onClick={closeEditWord}>取消</Button>
              <Button 
                variant="primary" 
                leftIcon={<Save size={16} />}
                onClick={saveEditedWord}
                disabled={isSaving}
              >
                {isSaving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
