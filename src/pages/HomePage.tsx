import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery, refreshQueries } from '../hooks/useAsyncQuery';
import {
  Clock,
  Zap,
  Target,
  Plus,
  Play,
  Upload,
  BarChart3,
  Trash2,
  ChevronRight,
  Flame,
  Edit2,
  BookOpen,
  Sparkles,
  RefreshCw,
  Dumbbell,
  FileText,
  Wand2,
  Globe,
} from 'lucide-react';
import { deckOperations } from '../lib/database';
import { userVocabularyOperations } from '../lib/vocabulary-db';
import { useAppStore } from '../stores/appStore';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Modal, ModalContent, ModalFooter } from '../components/ui/Modal';
import { Progress } from '../components/ui/Progress';
import { dialog } from '../components/ui/ConfirmDialog';
import type { Deck, PracticeMode } from '../types';
import type { UserVocabulary } from '../types/vocabulary';
import { cn } from '../lib/utils';
import { authFetch } from '../lib/auth';

// 统计数据接口
interface StatsOverview {
  totalQuestions: number;
  totalDecks: number;
  learnedCards: number;
  todayReviews: number;
  todayDuration: number;
  totalReviews: number;
  totalDuration: number;
  accuracy: number;
}

interface StreakData {
  streak: number;
  totalDays: number;
}

interface HomePageProps {
  onNavigate: (view: string, data?: any) => void;
  onStartPractice: (deck: Deck, mode: PracticeMode) => void;
}

export default function HomePage({ onNavigate, onStartPractice }: HomePageProps) {
  const { t } = useTranslation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPracticeModalOpen, setIsPracticeModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('smart');

  const { createDeck, deleteDeck } = useAppStore();

  // 获取所有题库
  const decks = useLiveQuery(() => deckOperations.getAll(), []);

  // 获取用户词库
  const [vocabularies, setVocabularies] = useState<(UserVocabulary & { wordCount: number })[]>([]);
  const [vocabLoading, setVocabLoading] = useState(true);

  useEffect(() => {
    const loadVocabularies = async () => {
      try {
        setVocabLoading(true);
        const data = await userVocabularyOperations.getAllWithStats();
        setVocabularies(data);
      } catch (error) {
        console.error('加载词库失败:', error);
      } finally {
        setVocabLoading(false);
      }
    };
    loadVocabularies();
  }, []);

  // 获取题库统计
  const [deckStats, setDeckStats] = useState<Record<string, { total: number; due: number; new: number; learning: number; review: number; mastered: number }>>({});

  // 当 decks 加载完成后获取统计数据
  useEffect(() => {
    const fetchDeckStats = async () => {
      if (!decks || decks.length === 0) {
        return;
      }
      
      try {
        const stats: Record<string, { total: number; due: number; new: number; learning: number; review: number; mastered: number }> = {};
        
        // 并行获取所有题库的统计数据
        const statsPromises = decks.map(async (deck) => {
          const stat = await deckOperations.getStats(deck.id);
          return { deckId: deck.id, stat };
        });
        
        const results = await Promise.all(statsPromises);
        results.forEach(({ deckId, stat }) => {
          stats[deckId] = stat;
        });
        
        setDeckStats(stats);
      } catch (error) {
        console.error('获取题库统计失败:', error);
      }
    };

    fetchDeckStats();
  }, [decks]);

  // 学习统计数据
  const [statsOverview, setStatsOverview] = useState<StatsOverview | null>(null);
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // 获取统计数据
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const [overviewRes, streakRes] = await Promise.all([
          authFetch('/api/stats/overview'),
          authFetch('/api/stats/streak')
        ]);
        
        if (overviewRes.ok) {
          const overview = await overviewRes.json();
          setStatsOverview(overview);
        }
        
        if (streakRes.ok) {
          const streak = await streakRes.json();
          setStreakData(streak);
        }
      } catch (error) {
        console.error('获取统计数据失败:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) {
      dialog.warning(t('home.enterDeckName'));
      return;
    }
    try {
      await createDeck(newDeckName, newDeckDesc);
      setNewDeckName('');
      setNewDeckDesc('');
      setIsCreateModalOpen(false);
      refreshQueries();
    } catch (err) {
      console.error('创建题库失败:', err);
      dialog.error(t('home.createFailed') + ': ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleEditDeck = async () => {
    if (!selectedDeck || !newDeckName.trim()) {
      dialog.warning('请输入题库名称');
      return;
    }
    try {
      await deckOperations.update(selectedDeck.id, {
        name: newDeckName,
        description: newDeckDesc,
        updatedAt: Date.now(),
      });
      setNewDeckName('');
      setNewDeckDesc('');
      setIsEditModalOpen(false);
      setSelectedDeck(null);
      refreshQueries();
    } catch (err) {
      console.error('编辑题库失败:', err);
    }
  };

  const openEditModal = (deck: Deck) => {
    setSelectedDeck(deck);
    setNewDeckName(deck.name);
    setNewDeckDesc(deck.description || '');
    setIsEditModalOpen(true);
  };

  const handleDeleteDeck = async (deckId: string) => {
    const confirmed = await dialog.confirm(t('home.deleteDeckConfirm'), { 
      title: t('home.deleteDeckTitle'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      isDanger: true
    });
    if (confirmed) {
      await deleteDeck(deckId);
      refreshQueries();
    }
  };

  const openPracticeModal = (deck: Deck) => {
    setSelectedDeck(deck);
    setIsPracticeModalOpen(true);
  };

  const handleStartPractice = () => {
    if (selectedDeck) {
      onStartPractice(selectedDeck, practiceMode);
      setIsPracticeModalOpen(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto fade-in">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2 text-gray-800">
          {t('home.title')}
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          {t('home.welcome')}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Clock size={18} className="text-blue-600" />
              </div>
              <span className="text-sm text-gray-600">{t('home.todayPracticeTime')}</span>
            </div>
            <div className="text-3xl font-bold text-gray-800">
              {statsLoading ? (
                <span className="animate-pulse">--</span>
              ) : (
                `${statsOverview?.todayDuration || 0}m`
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Target size={18} className="text-green-600" />
              </div>
              <span className="text-sm text-gray-600">{t('home.totalQuestions')}</span>
            </div>
            <div className="text-3xl font-bold text-gray-800">
              {statsLoading ? (
                <span className="animate-pulse">--</span>
              ) : (
                (statsOverview?.totalReviews || 0).toLocaleString()
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Zap size={18} className="text-yellow-600" />
              </div>
              <span className="text-sm text-gray-600">{t('home.accuracy')}</span>
            </div>
            <div className="text-3xl font-bold text-gray-800">
              {statsLoading ? (
                <span className="animate-pulse">--</span>
              ) : (
                `${statsOverview?.accuracy || 0}%`
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Flame size={18} className="text-orange-600" />
              </div>
              <span className="text-sm text-gray-600">{t('home.studyStreak')}</span>
            </div>
            <div className="text-3xl font-bold text-gray-800">
              {statsLoading ? (
                <span className="animate-pulse">--</span>
              ) : (
                `${streakData?.streak || 0}${t('home.days')}`
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 快捷入口卡片 */}
      <Card 
        className="mb-8 cursor-pointer"
        hover
        onClick={() => onNavigate('flashcard')}
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Sparkles size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-gray-800">{t('home.quickFlashcard')}</h3>
                <p className="text-sm text-gray-600">
                  {t('home.quickFlashcardDesc')}
                </p>
              </div>
            </div>
            <ChevronRight className="text-gray-400" />
          </div>
        </CardContent>
      </Card>

      {/* 题库列表 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <BookOpen size={16} className="text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">{t('home.myDecks')}</h2>
        </div>
        <div className="flex items-center gap-2">
          {decks && decks.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              rightIcon={<ChevronRight size={14} />}
              onClick={() => onNavigate('my-decks')}
            >
              {t('home.more')}
            </Button>
          )}
          <Button
            variant="liquid-glass-blue"
            leftIcon={<Plus size={16} />}
            onClick={() => setIsCreateModalOpen(true)}
            size="sm"
          >
            {t('home.new')}
          </Button>
        </div>
      </div>

      {decks === undefined ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-sm text-gray-600">{t('home.loadingDecks')}</p>
        </div>
      ) : decks.length === 0 ? (
        <Card className="mb-8">
          <CardContent className="py-12 text-center">
            <BookOpen size={40} className="mx-auto mb-3 text-gray-400" />
            <p className="mb-3 text-gray-600">{t('home.noDecks')}</p>
            <Button onClick={() => setIsCreateModalOpen(true)} leftIcon={<Plus size={16} />} size="sm">
              {t('home.createFirstDeck')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {decks.slice(0, 3).map(deck => {
            const stats = deckStats?.[deck.id] || { total: 0, due: 0, new: 0, learning: 0, review: 0, mastered: 0 };
            // 学习进度 = 学习中 / 总题数
            const learnProgress = stats.total > 0 ? Math.round((stats.learning / stats.total) * 100) : 0;
            // 掌握进度 = 已掌握的题目 / 总题数
            const masterProgress = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;

            return (
              <Card 
                key={deck.id} 
                className="group cursor-pointer"
                hover
                onClick={() => onNavigate('deckdetails', deck)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1 text-gray-800">
                        {deck.name}
                      </h3>
                      {deck.description && (
                        <p className="text-sm line-clamp-2 text-gray-600">{deck.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(deck); }}
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/50 text-gray-500"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteDeck(deck.id); }}
                        className="p-1.5 rounded-lg transition-colors text-red-500 hover:bg-red-50/50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  {/* 进度条区域 */}
                  <div className="mb-4 space-y-3">
                    {/* 学习进度 */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{t('home.learningProgress')}</span>
                        <span className="text-gray-700">{learnProgress}%</span>
                      </div>
                      <Progress value={learnProgress} className="h-1.5" />
                    </div>
                    {/* 掌握进度 */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{t('home.masteryProgress')}</span>
                        <span className="text-green-600">{masterProgress}%</span>
                      </div>
                      <Progress value={masterProgress} className="h-1.5" color="success" />
                    </div>
                  </div>

                  {/* 统计数据 */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div 
                      className="py-2.5 px-2 rounded-xl bg-white/50 backdrop-blur-sm border border-white/30 shadow-sm cursor-pointer hover:bg-white/70 transition-colors"
                      onClick={() => onNavigate('deckdetails', { ...deck, filter: 'all' })}
                    >
                      <div className="text-lg font-bold text-gray-800">{stats.total}</div>
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{t('home.totalCount')}</div>
                    </div>
                    <div 
                      className="py-2.5 px-2 rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100/80 border border-yellow-200/50 shadow-sm cursor-pointer hover:from-yellow-100 hover:to-yellow-200/80 transition-colors"
                      onClick={() => onNavigate('deckdetails', { ...deck, filter: 'learning' })}
                    >
                      <div className="text-lg font-bold text-yellow-600">{stats.learning}</div>
                      <div className="text-[10px] font-medium text-yellow-500 uppercase tracking-wide">{t('home.learned')}</div>
                    </div>
                    <div 
                      className="py-2.5 px-2 rounded-xl bg-gradient-to-br from-green-50 to-green-100/80 border border-green-200/50 shadow-sm cursor-pointer hover:from-green-100 hover:to-green-200/80 transition-colors"
                      onClick={() => onNavigate('deckdetails', { ...deck, filter: 'mastered' })}
                    >
                      <div className="text-lg font-bold text-green-600">{stats.mastered}</div>
                      <div className="text-[10px] font-medium text-green-500 uppercase tracking-wide">{t('home.mastered')}</div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="liquid-glass-blue"
                      size="sm"
                      className="flex-1"
                      leftIcon={<Play size={14} />}
                      onClick={() => openPracticeModal(deck)}
                      disabled={stats.total === 0}
                    >
                      {t('home.startPractice')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Upload size={14} />}
                      onClick={() => onNavigate('import', deck)}
                    >
                      {t('home.import')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<BarChart3 size={14} />}
                      onClick={() => onNavigate('dashboard', deck)}
                    >
                      {t('home.stats')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 我的词库 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
            <Globe size={16} className="text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">{t('home.myVocabulary')}</h2>
        </div>
        <div className="flex items-center gap-2">
          {vocabularies.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              rightIcon={<ChevronRight size={14} />}
              onClick={() => onNavigate('my-vocabulary')}
            >
              {t('home.more')}
            </Button>
          )}
          <Button
            variant="liquid-glass-blue"
            leftIcon={<Plus size={16} />}
            onClick={() => onNavigate('public-vocabulary')}
            size="sm"
          >
            {t('home.add')}
          </Button>
        </div>
      </div>

      {vocabLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-sm text-gray-600">{t('home.loadingVocabulary')}</p>
        </div>
      ) : vocabularies.length === 0 ? (
        <Card className="mb-8">
          <CardContent className="py-12 text-center">
            <Globe size={40} className="mx-auto mb-3 text-gray-400" />
            <p className="mb-3 text-gray-600">{t('home.noVocabulary')}</p>
            <Button onClick={() => onNavigate('public-vocabulary')} leftIcon={<Plus size={16} />} size="sm">
              {t('home.browsePublicVocabulary')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {vocabularies.slice(0, 3).map(vocab => {
            // 学习进度 = 已学习的单词 / 总词数
            const learnProgress = vocab.wordCount > 0 
              ? Math.round((vocab.learnedCount / vocab.wordCount) * 100) 
              : 0;
            // 掌握进度 = 已掌握的单词 / 总词数
            const masterProgress = vocab.wordCount > 0 
              ? Math.round((vocab.masteredCount / vocab.wordCount) * 100) 
              : 0;

            return (
              <Card 
                key={vocab.id} 
                className="group cursor-pointer"
                hover
                onClick={() => onNavigate('vocabulary-details', { bookId: vocab.bookId, bookName: vocab.bookName })}
              >
                <CardHeader className="pb-2">
                  <h3 className="font-semibold text-lg mb-1 text-gray-800">
                    {vocab.bookName}
                  </h3>
                </CardHeader>
                <CardContent className="pt-2">
                  {/* 进度条区域 */}
                  <div className="mb-4 space-y-3">
                    {/* 学习进度 */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{t('home.learningProgress')}</span>
                        <span className="text-gray-700">{learnProgress}%</span>
                      </div>
                      <Progress value={learnProgress} className="h-1.5" />
                    </div>
                    {/* 掌握进度 */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{t('home.masteryProgress')}</span>
                        <span className="text-green-600">{masterProgress}%</span>
                      </div>
                      <Progress value={masterProgress} className="h-1.5" color="success" />
                    </div>
                  </div>

                  {/* 统计数据 */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div 
                      className="py-2.5 px-2 rounded-xl bg-white/50 backdrop-blur-sm border border-white/30 shadow-sm cursor-pointer hover:bg-white/70 transition-colors"
                      onClick={() => onNavigate('vocabulary-details', { bookId: vocab.bookId, bookName: vocab.bookName, filter: 'all' })}
                    >
                      <div className="text-lg font-bold text-gray-800">{vocab.wordCount}</div>
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{t('home.totalWords')}</div>
                    </div>
                    <div 
                      className="py-2.5 px-2 rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100/80 border border-yellow-200/50 shadow-sm cursor-pointer hover:from-yellow-100 hover:to-yellow-200/80 transition-colors"
                      onClick={() => onNavigate('vocabulary-details', { bookId: vocab.bookId, bookName: vocab.bookName, filter: 'learning' })}
                    >
                      <div className="text-lg font-bold text-yellow-600">{vocab.learnedCount}</div>
                      <div className="text-[10px] font-medium text-yellow-500 uppercase tracking-wide">{t('home.learned')}</div>
                    </div>
                    <div 
                      className="py-2.5 px-2 rounded-xl bg-gradient-to-br from-green-50 to-green-100/80 border border-green-200/50 shadow-sm cursor-pointer hover:from-green-100 hover:to-green-200/80 transition-colors"
                      onClick={() => onNavigate('vocabulary-details', { bookId: vocab.bookId, bookName: vocab.bookName, filter: 'mastered' })}
                    >
                      <div className="text-lg font-bold text-green-600">{vocab.masteredCount}</div>
                      <div className="text-[10px] font-medium text-green-500 uppercase tracking-wide">{t('home.mastered')}</div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="liquid-glass-blue"
                      size="sm"
                      className="flex-1"
                      leftIcon={<Play size={14} />}
                      onClick={() => onNavigate('vocabulary-practice', { bookId: vocab.bookId, bookName: vocab.bookName })}
                    >
                      {t('home.startLearning')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Upload size={14} />}
                      onClick={() => onNavigate('vocabulary-import', { bookId: vocab.bookId, bookName: vocab.bookName })}
                    >
                      {t('home.import')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<BarChart3 size={14} />}
                      onClick={() => onNavigate('vocabulary-stats', { bookId: vocab.bookId, bookName: vocab.bookName })}
                    >
                      {t('home.stats')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 创建题库弹窗 */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
        <ModalContent title={t('home.createDeck')}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">{t('home.deckName')}</label>
              <input
                type="text"
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                placeholder={t('home.deckNamePlaceholder')}
                className="w-full px-3 py-2 rounded-lg border outline-none transition-colors bg-white border-gray-300 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">{t('home.descriptionOptional')}</label>
              <textarea
                value={newDeckDesc}
                onChange={(e) => setNewDeckDesc(e.target.value)}
                placeholder={t('home.addDescription')}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border outline-none transition-colors resize-none bg-white border-gray-300 focus:border-primary-500"
              />
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleCreateDeck}>{t('common.confirm')}</Button>
        </ModalFooter>
      </Modal>

      {/* 编辑题库弹窗 */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
        <ModalContent title={t('home.editDeck')}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">{t('home.deckName')}</label>
              <input
                type="text"
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border outline-none transition-colors bg-white border-gray-300 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">{t('home.description')}</label>
              <textarea
                value={newDeckDesc}
                onChange={(e) => setNewDeckDesc(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border outline-none transition-colors resize-none bg-white border-gray-300 focus:border-primary-500"
              />
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleEditDeck}>{t('common.save')}</Button>
        </ModalFooter>
      </Modal>

      {/* 练习模式选择弹窗 */}
      <Modal isOpen={isPracticeModalOpen} onClose={() => setIsPracticeModalOpen(false)}>
        <ModalContent title={t('home.selectPracticeMode')}>
          <div className="space-y-3">
            {[
              { mode: 'smart' as PracticeMode, label: t('home.smartReview'), desc: t('home.smartReviewDesc'), icon: Wand2, color: 'text-purple-500' },
              { mode: 'new' as PracticeMode, label: t('home.learnNew'), desc: t('home.learnNewDesc'), icon: Sparkles, color: 'text-yellow-500' },
              { mode: 'review' as PracticeMode, label: t('home.reviewAll'), desc: t('home.reviewAllDesc'), icon: RefreshCw, color: 'text-blue-500' },
              { mode: 'cram' as PracticeMode, label: t('home.intensiveTraining'), desc: t('home.intensiveTrainingDesc'), icon: Dumbbell, color: 'text-orange-500' },
              { mode: 'exam' as PracticeMode, label: t('home.mockExam'), desc: t('home.mockExamDesc'), icon: FileText, color: 'text-green-500' },
            ].map(item => (
              <button
                key={item.mode}
                onClick={() => setPracticeMode(item.mode)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                  practiceMode === item.mode
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100">
                  <item.icon size={22} className={item.color} />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{item.label}</div>
                  <div className="text-sm text-gray-500">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setIsPracticeModalOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="liquid-glass-blue" onClick={handleStartPractice}>{t('home.startPractice')}</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
