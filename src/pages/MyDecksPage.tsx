/**
 * 我的题库页面 - 展示用户所有题库的完整列表
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery, refreshQueries } from '../hooks/useAsyncQuery';
import {
  Plus,
  Play,
  Upload,
  BarChart3,
  Trash2,
  Edit2,
  BookOpen,
  Sparkles,
  RefreshCw,
  Dumbbell,
  FileText,
  Wand2,
  Globe,
  Lock,
} from 'lucide-react';
import { authFetch } from '../lib/auth';
import { deckOperations } from '../lib/database';
import { useAppStore } from '../stores/appStore';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Modal, ModalContent, ModalFooter } from '../components/ui/Modal';
import { Progress } from '../components/ui/Progress';
import { dialog } from '../components/ui/ConfirmDialog';
import type { Deck, PracticeMode } from '../types';
import { cn } from '../lib/utils';

interface MyDecksPageProps {
  onNavigate: (view: string, deck?: Deck & { filter?: string }) => void;
  onStartPractice: (deck: Deck, mode: PracticeMode) => void;
}

export default function MyDecksPage({ onNavigate, onStartPractice }: MyDecksPageProps) {
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

  // 获取题库统计
  const [deckStats, setDeckStats] = useState<Record<string, { total: number; due: number; new: number; mastered: number; learning: number; review: number }>>({});

  useEffect(() => {
    const fetchDeckStats = async () => {
      if (!decks || decks.length === 0) return;
      
      try {
        const stats: Record<string, { total: number; due: number; new: number; mastered: number; learning: number; review: number }> = {};
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
      dialog.warning(t('home.enterDeckName'));
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

  // 切换题库公开状态
  const handleTogglePublic = async (deck: Deck, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIsPublic = !deck.isPublic;
    try {
      const res = await authFetch(`/api/decks/${deck.id}/public`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: newIsPublic }),
      });
      if (res.ok) {
        refreshQueries();
        dialog.success(newIsPublic ? t('myDecks.deckPublished') : t('myDecks.deckPrivated'));
      } else {
        dialog.error(t('myDecks.operationFailed'));
      }
    } catch (error) {
      console.error('切换公开状态失败:', error);
      dialog.error(t('myDecks.operationFailed'));
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
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <BookOpen size={22} className="text-blue-600" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{t('myDecks.title')}</h1>
            </div>
            <p className="text-sm md:text-base text-gray-600">
              {t('myDecks.subtitle')}
            </p>
          </div>
          <Button
            variant="liquid-glass-blue"
            leftIcon={<Plus size={16} />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            {t('myDecks.newDeck')}
          </Button>
        </div>
      </div>

      {/* 题库列表 */}
      {decks === undefined ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-sm text-gray-600">{t('home.loadingDecks')}</p>
        </div>
      ) : decks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="mb-4 text-gray-600">{t('home.noDecks')}</p>
            <Button onClick={() => setIsCreateModalOpen(true)} leftIcon={<Plus size={16} />}>
              {t('home.createFirstDeck')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map(deck => {
            const stats = deckStats?.[deck.id] || { total: 0, due: 0, new: 0, mastered: 0, learning: 0, review: 0 };
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
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg text-gray-800">
                          {deck.name}
                        </h3>
                        {deck.isPublic && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-600 flex items-center gap-0.5">
                            <Globe size={10} />
                            {t('myDecks.public')}
                          </span>
                        )}
                      </div>
                      {deck.description && (
                        <p className="text-sm line-clamp-2 text-gray-600">{deck.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleTogglePublic(deck, e)}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          deck.isPublic 
                            ? "text-green-500 hover:bg-green-50/50" 
                            : "text-gray-400 hover:bg-white/50"
                        )}
                        title={deck.isPublic ? t('myDecks.setPrivate') : t('myDecks.setPublic')}
                      >
                        {deck.isPublic ? <Globe size={14} /> : <Lock size={14} />}
                      </button>
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
