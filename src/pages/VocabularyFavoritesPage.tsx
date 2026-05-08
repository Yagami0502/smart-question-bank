/**
 * 词库收藏页面 - 管理收藏的单词
 */
import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Trash2,
  Play,
  Volume2,
  Search,
  Star,
  Heart,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { dialog } from '../components/ui/ConfirmDialog';
import { speechService, type VoiceType } from '../lib/speech-service';
import {
  favoriteWordOperations,
  wordOperations,
} from '../lib/vocabulary-db';
import type { FavoriteWord, Word } from '../types/vocabulary';
import { cn } from '../lib/utils';

interface VocabularyFavoritesPageProps {
  onBack: () => void;
  onPractice?: (wordIds: string[]) => void;
}

export default function VocabularyFavoritesPage({ onBack, onPractice }: VocabularyFavoritesPageProps) {
  const [favorites, setFavorites] = useState<FavoriteWord[]>([]);
  const [wordDetails, setWordDetails] = useState<Map<string, Word>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [voiceType, setVoiceType] = useState<VoiceType>('us');

  // 加载收藏
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        setLoading(true);
        const words = await favoriteWordOperations.getAll();
        setFavorites(words);

        // 加载单词详情
        const details = new Map<string, Word>();
        for (const fav of words) {
          const word = await wordOperations.getById(fav.wordId);
          if (word) {
            details.set(fav.wordId, word);
          }
        }
        setWordDetails(details);
      } catch (error) {
        console.error('加载收藏失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, []);

  // 过滤收藏
  const filteredFavorites = favorites.filter(fav =>
    fav.word.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 播放发音
  const playAudio = (word: string) => {
    speechService.speakWord(word, voiceType);
  };

  // 取消收藏
  const handleRemove = async (wordId: string, bookId: string, word: string) => {
    await favoriteWordOperations.toggle(wordId, bookId, word);
    setFavorites(prev => prev.filter(fav => fav.wordId !== wordId));
    setSelectedWords(prev => {
      const next = new Set(prev);
      next.delete(wordId);
      return next;
    });
  };

  // 清空收藏
  const handleClearAll = async () => {
    const confirmed = await dialog.confirm('确定要清空所有收藏吗？', {
      title: '清空收藏',
      isDanger: true,
    });

    if (confirmed) {
      await favoriteWordOperations.clear();
      setFavorites([]);
      setSelectedWords(new Set());
    }
  };

  // 切换选择
  const toggleSelect = (wordId: string) => {
    setSelectedWords(prev => {
      const next = new Set(prev);
      if (next.has(wordId)) {
        next.delete(wordId);
      } else {
        next.add(wordId);
      }
      return next;
    });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedWords.size === filteredFavorites.length) {
      setSelectedWords(new Set());
    } else {
      setSelectedWords(new Set(filteredFavorites.map(fav => fav.wordId)));
    }
  };

  // 开始练习选中的单词
  const handlePracticeSelected = () => {
    if (selectedWords.size === 0) {
      dialog.warning('请先选择要练习的单词');
      return;
    }
    if (onPractice) {
      onPractice(Array.from(selectedWords));
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto fade-in">
      {/* 页面标题 */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft size={20} />
          <span>返回</span>
        </button>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <Star size={22} className="text-yellow-600" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">词库收藏</h1>
            </div>
            <p className="text-sm md:text-base text-gray-600">
              共收藏 {favorites.length} 个单词
            </p>
          </div>
          {favorites.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              onClick={handleClearAll}
            >
              清空
            </Button>
          )}
        </div>
      </div>

      {/* 搜索和操作栏 */}
      {favorites.length > 0 && (
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索单词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white outline-none focus:border-primary-500"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectAll}
            >
              {selectedWords.size === filteredFavorites.length ? '取消全选' : '全选'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Play size={14} />}
              onClick={handlePracticeSelected}
              disabled={selectedWords.size === 0}
            >
              练习选中 ({selectedWords.size})
            </Button>
          </div>
        </div>
      )}

      {/* 收藏列表 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      ) : favorites.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Heart size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600">还没有收藏任何单词</p>
            <p className="text-sm text-gray-500 mt-2">在练习时点击收藏按钮添加</p>
          </CardContent>
        </Card>
      ) : filteredFavorites.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search size={40} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">没有找到匹配的单词</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredFavorites.map(fav => {
            const detail = wordDetails.get(fav.wordId);
            const isSelected = selectedWords.has(fav.wordId);

            return (
              <Card
                key={fav.id}
                className={cn(
                  "transition-all cursor-pointer",
                  isSelected && "ring-2 ring-primary-500"
                )}
                onClick={() => toggleSelect(fav.wordId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* 单词信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-gray-800">{fav.word}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); playAudio(fav.word); }}
                          className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
                        >
                          <Volume2 size={14} />
                        </button>
                      </div>

                      {/* 释义 */}
                      {detail && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {detail.translations.map((t: any, i) => {
                            const typeStr = String(t.type || t.pos || '');
                            const transStr = String(t.translation || t.cn || '');
                            return (
                              <span key={i}>
                                <span className="text-gray-400">{typeStr}</span> {transStr}
                                {i < detail.translations.length - 1 && '；'}
                              </span>
                            );
                          })}
                        </p>
                      )}

                      {/* 收藏时间 */}
                      <div className="text-xs text-gray-400 mt-2">
                        收藏于 {formatTime(fav.createdAt)}
                      </div>
                    </div>

                    {/* 取消收藏按钮 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(fav.wordId, fav.bookId, fav.word); }}
                      className="p-2 rounded-lg hover:bg-yellow-50 text-yellow-500"
                    >
                      <Star size={16} className="fill-yellow-400" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 发音切换 */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => setVoiceType(voiceType === 'us' ? 'uk' : 'us')}
          className="px-4 py-2 rounded-full bg-white shadow-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          {voiceType === 'us' ? '🇺🇸 美音' : '🇬🇧 英音'}
        </button>
      </div>
    </div>
  );
}
