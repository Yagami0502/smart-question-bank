/**
 * 词库错词本页面 - 管理单词练习中的错词
 */
import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Trash2,
  Play,
  Volume2,
  Search,
  AlertTriangle,
  Check,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { dialog } from '../components/ui/ConfirmDialog';
import { speechService, type VoiceType } from '../lib/speech-service';
import {
  wrongWordOperations,
  wordOperations,
} from '../lib/vocabulary-db';
import type { WrongWord, Word } from '../types/vocabulary';
import { cn } from '../lib/utils';

interface VocabularyWrongWordsPageProps {
  onBack: () => void;
  onPractice?: (wordIds: string[]) => void;
}

export default function VocabularyWrongWordsPage({ onBack, onPractice }: VocabularyWrongWordsPageProps) {
  const [wrongWords, setWrongWords] = useState<WrongWord[]>([]);
  const [wordDetails, setWordDetails] = useState<Map<string, Word>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [voiceType, setVoiceType] = useState<VoiceType>('us');

  // 加载错词
  useEffect(() => {
    const loadWrongWords = async () => {
      try {
        setLoading(true);
        const words = await wrongWordOperations.getAll();
        setWrongWords(words);

        // 加载单词详情
        const details = new Map<string, Word>();
        for (const ww of words) {
          const word = await wordOperations.getById(ww.wordId);
          if (word) {
            details.set(ww.wordId, word);
          }
        }
        setWordDetails(details);
      } catch (error) {
        console.error('加载错词失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWrongWords();
  }, []);

  // 过滤错词
  const filteredWords = wrongWords.filter(ww =>
    ww.word.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 播放发音
  const playAudio = (word: string) => {
    speechService.speakWord(word, voiceType);
  };

  // 删除错词
  const handleDelete = async (wordId: string) => {
    const confirmed = await dialog.confirm('确定要从错词本中移除这个单词吗？', {
      title: '移除错词',
      isDanger: true,
    });

    if (confirmed) {
      await wrongWordOperations.remove(wordId);
      setWrongWords(prev => prev.filter(ww => ww.wordId !== wordId));
      setSelectedWords(prev => {
        const next = new Set(prev);
        next.delete(wordId);
        return next;
      });
    }
  };

  // 清空错词本
  const handleClearAll = async () => {
    const confirmed = await dialog.confirm('确定要清空所有错词吗？此操作不可恢复。', {
      title: '清空错词本',
      isDanger: true,
    });

    if (confirmed) {
      await wrongWordOperations.clear();
      setWrongWords([]);
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
    if (selectedWords.size === filteredWords.length) {
      setSelectedWords(new Set());
    } else {
      setSelectedWords(new Set(filteredWords.map(ww => ww.wordId)));
    }
  };

  // 开始练习选中的错词
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
      hour: '2-digit',
      minute: '2-digit',
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
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertTriangle size={22} className="text-red-600" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">词库错词本</h1>
            </div>
            <p className="text-sm md:text-base text-gray-600">
              共 {wrongWords.length} 个错词，复习巩固薄弱单词。
            </p>
          </div>
          {wrongWords.length > 0 && (
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
      {wrongWords.length > 0 && (
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
              {selectedWords.size === filteredWords.length ? '取消全选' : '全选'}
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

      {/* 错词列表 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      ) : wrongWords.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Check size={48} className="mx-auto mb-4 text-green-500" />
            <p className="text-gray-600">太棒了！错词本是空的</p>
            <p className="text-sm text-gray-500 mt-2">继续保持，加油学习！</p>
          </CardContent>
        </Card>
      ) : filteredWords.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search size={40} className="mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">没有找到匹配的单词</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredWords.map(ww => {
            const detail = wordDetails.get(ww.wordId);
            const isSelected = selectedWords.has(ww.wordId);

            return (
              <Card
                key={ww.id}
                className={cn(
                  "transition-all cursor-pointer",
                  isSelected && "ring-2 ring-primary-500"
                )}
                onClick={() => toggleSelect(ww.wordId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* 选择框 */}
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1",
                      isSelected ? "bg-primary-500 border-primary-500" : "border-gray-300"
                    )}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>

                    {/* 单词信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xl font-bold text-gray-800">{ww.word}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); playAudio(ww.word); }}
                          className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
                        >
                          <Volume2 size={16} />
                        </button>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                          错 {ww.wrongCount} 次
                        </span>
                      </div>

                      {/* 释义 */}
                      {detail && (
                        <div className="text-sm text-gray-600 mb-2">
                          {detail.translations.map((t: any, i) => (
                            <span key={i}>
                              <span className="text-gray-400">{t.type || t.pos || ''}</span> {t.translation || t.cn || ''}
                              {i < detail.translations.length - 1 && '；'}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 错误输入记录 */}
                      {ww.userInputs.length > 0 && (
                        <div className="text-xs text-gray-500">
                          <span className="text-gray-400">错误输入：</span>
                          {ww.userInputs.slice(-3).map((input, i) => (
                            <span key={i} className="text-red-500 line-through mx-1">{input}</span>
                          ))}
                        </div>
                      )}

                      {/* 时间 */}
                      <div className="text-xs text-gray-400 mt-2">
                        最近错误：{formatTime(ww.lastWrongTime)}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(ww.wordId); }}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                    >
                      <Trash2 size={16} />
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
