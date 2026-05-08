/**
 * 我的词库页面 - 展示用户添加的词库和学习进度
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Play,
  Trash2,
  BookOpen,
  Settings,
  Upload,
  Loader2,
  Sparkles,
  BarChart3,
  Globe,
  Lock,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Progress } from '../components/ui/Progress';
import { Modal, ModalContent, ModalFooter } from '../components/ui/Modal';
import { dialog } from '../components/ui/ConfirmDialog';
import VocabularySettingsModal from '../components/VocabularySettingsModal';
import { 
  userVocabularyOperations,
  vocabularyBookOperations,
} from '../lib/vocabulary-db';
import type { UserVocabulary } from '../types/vocabulary';

interface MyVocabularyPageProps {
  onNavigate: (view: string, data?: any) => void;
}

// 带实时统计的用户词库类型
type UserVocabularyWithStats = UserVocabulary & { 
  wordCount: number;
  isBuiltIn?: boolean;
  isPublic?: boolean;
  isOwner?: boolean;  // 是否是用户自己创建的词库
};

export default function MyVocabularyPage({ onNavigate }: MyVocabularyPageProps) {
  const { t } = useTranslation();
  const [vocabularies, setVocabularies] = useState<UserVocabularyWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 创建词库弹窗
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
  });
  const [creating, setCreating] = useState(false);
  
  // 设置弹窗
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // 加载用户词库
  useEffect(() => {
    const loadVocabularies = async () => {
      try {
        setLoading(true);
        // 使用带实时统计的方法
        const data = await userVocabularyOperations.getAllWithStats();
        setVocabularies(data);
      } catch (error) {
        console.error('加载词库失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadVocabularies();
  }, []);

  // 移除词库
  const handleRemove = async (vocab: UserVocabulary) => {
    const confirmed = await dialog.confirm(
      t('myVocabulary.removeConfirm', { name: vocab.bookName }),
      { title: t('myVocabulary.removeTitle'), isDanger: true }
    );
    
    if (confirmed) {
      await userVocabularyOperations.remove(vocab.bookId);
      setVocabularies(prev => prev.filter(v => v.id !== vocab.id));
      dialog.success(t('myVocabulary.removed'));
    }
  };

  // 开始学习
  const handleStartPractice = (vocab: UserVocabulary) => {
    onNavigate('vocabulary-practice', { bookId: vocab.bookId, bookName: vocab.bookName });
  };

  // 切换词库公开状态
  const handleTogglePublic = async (vocab: UserVocabularyWithStats) => {
    const newIsPublic = !vocab.isPublic;
    try {
      await vocabularyBookOperations.togglePublic(vocab.bookId, newIsPublic);
      // 更新本地状态
      setVocabularies(prev => prev.map(v => 
        v.id === vocab.id ? { ...v, isPublic: newIsPublic } : v
      ));
      dialog.success(newIsPublic ? t('myVocabulary.published') : t('myVocabulary.privated'));
    } catch (error) {
      console.error('切换公开状态失败:', error);
      dialog.error(t('myVocabulary.operationFailed'));
    }
  };

  // 创建自定义词库
  const handleCreateBook = async () => {
    if (!createForm.name.trim()) {
      dialog.warning(t('myVocabulary.enterBookName'));
      return;
    }

    try {
      setCreating(true);
      const bookId = await vocabularyBookOperations.create({
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        isBuiltIn: false,
        isPublic: false,
      });
      
      // 添加到我的词库
      await userVocabularyOperations.add(bookId, createForm.name.trim());
      
      // 刷新列表
      const data = await userVocabularyOperations.getAllWithStats();
      setVocabularies(data);
      
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '' });
      dialog.success(t('myVocabulary.createSuccess'));
    } catch (error) {
      console.error('创建词库失败:', error);
      dialog.error(t('myVocabulary.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto fade-in">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <BookOpen size={22} className="text-green-600" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{t('myVocabulary.title')}</h1>
            </div>
            <p className="text-sm md:text-base text-gray-600">
              {t('myVocabulary.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="liquid-glass"
              leftIcon={<Settings size={18} />}
              onClick={() => setShowSettingsModal(true)}
            >
              {t('myVocabulary.settings')}
            </Button>
            <Button
              variant="liquid-glass-blue"
              leftIcon={<Plus size={18} />}
              onClick={() => setShowCreateModal(true)}
            >
              {t('myVocabulary.createBook')}
            </Button>
          </div>
        </div>
      </div>

      {/* 词库列表 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      ) : vocabularies.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="mb-4 text-gray-600">{t('myVocabulary.noBooks')}</p>
            <Button 
              onClick={() => onNavigate('public-vocabulary')} 
              leftIcon={<Plus size={16} />}
            >
              {t('myVocabulary.browsePublic')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vocabularies.map(vocab => {
            const progress = vocab.wordCount > 0 
              ? Math.round((vocab.masteredCount / vocab.wordCount) * 100) 
              : 0;
            const learnedProgress = vocab.wordCount > 0
              ? Math.round((vocab.learnedCount / vocab.wordCount) * 100)
              : 0;

            return (
              <Card key={vocab.id} className="group" hover>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg text-gray-800">
                          {vocab.bookName}
                        </h3>
                        {vocab.isBuiltIn && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-600">
                            {t('myVocabulary.builtIn')}
                          </span>
                        )}
                        {!vocab.isBuiltIn && vocab.isPublic && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-600 flex items-center gap-0.5">
                            <Globe size={10} />
                            {t('myVocabulary.public')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {/* 只有用户自己创建的词库才能设置公开状态 */}
                      {vocab.isOwner && !vocab.isBuiltIn && (
                        <button
                          onClick={() => handleTogglePublic(vocab)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            vocab.isPublic 
                              ? 'text-green-500 hover:bg-green-50/50' 
                              : 'text-gray-400 hover:bg-white/50'
                          }`}
                          title={vocab.isPublic ? t('myVocabulary.setPrivate') : t('myVocabulary.setPublic')}
                        >
                          {vocab.isPublic ? <Globe size={14} /> : <Lock size={14} />}
                        </button>
                      )}
                      <button
                        onClick={() => handleRemove(vocab)}
                        className="p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50/50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  {/* 进度条 */}
                  <div className="mb-4 space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{t('myVocabulary.learningProgress')}</span>
                        <span className="text-gray-700">{learnedProgress}%</span>
                      </div>
                      <Progress value={learnedProgress} className="h-1.5" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{t('myVocabulary.masteryProgress')}</span>
                        <span className="text-green-600">{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  </div>

                  {/* 统计数据 - 可点击进入详情 */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                    <div 
                      className="py-2.5 px-2 rounded-xl bg-white/50 backdrop-blur-sm border border-white/30 shadow-sm cursor-pointer hover:bg-white/70 transition-colors"
                      onClick={() => onNavigate('vocabulary-details', { bookId: vocab.bookId, bookName: vocab.bookName, filter: 'all' })}
                    >
                      <div className="text-lg font-bold text-gray-800">{vocab.wordCount}</div>
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{t('myVocabulary.totalWords')}</div>
                    </div>
                    <div 
                      className="py-2.5 px-2 rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100/80 border border-yellow-200/50 shadow-sm cursor-pointer hover:from-yellow-100 hover:to-yellow-200/80 transition-colors"
                      onClick={() => onNavigate('vocabulary-details', { bookId: vocab.bookId, bookName: vocab.bookName, filter: 'learning' })}
                    >
                      <div className="text-lg font-bold text-yellow-600">{vocab.learnedCount}</div>
                      <div className="text-[10px] font-medium text-yellow-500 uppercase tracking-wide">{t('myVocabulary.learned')}</div>
                    </div>
                    <div 
                      className="py-2.5 px-2 rounded-xl bg-gradient-to-br from-green-50 to-green-100/80 border border-green-200/50 shadow-sm cursor-pointer hover:from-green-100 hover:to-green-200/80 transition-colors"
                      onClick={() => onNavigate('vocabulary-details', { bookId: vocab.bookId, bookName: vocab.bookName, filter: 'mastered' })}
                    >
                      <div className="text-lg font-bold text-green-600">{vocab.masteredCount}</div>
                      <div className="text-[10px] font-medium text-green-500 uppercase tracking-wide">{t('myVocabulary.mastered')}</div>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <Button
                      variant="liquid-glass-blue"
                      size="sm"
                      className="flex-1"
                      leftIcon={<Play size={14} />}
                      onClick={() => handleStartPractice(vocab)}
                    >
                      {t('myVocabulary.startLearning')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Upload size={14} />}
                      onClick={() => onNavigate('vocabulary-import', { bookId: vocab.bookId, bookName: vocab.bookName })}
                    >
                      {t('myVocabulary.import')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<BarChart3 size={14} />}
                      onClick={() => onNavigate('vocabulary-stats', { bookId: vocab.bookId, bookName: vocab.bookName })}
                    >
                      {t('myVocabulary.stats')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 创建词库弹窗 */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('myVocabulary.createTitle')}
        size="md"
      >
        <ModalContent>
          <div className="space-y-5">
            {/* 图标装饰 */}
            <div className="flex justify-center mb-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg">
                <Sparkles size={32} className="text-white" />
              </div>
            </div>
            
            {/* 词库名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('myVocabulary.bookNameLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t('myVocabulary.bookNamePlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200/80 bg-white/60 backdrop-blur-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
            
            {/* 描述 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('myVocabulary.descriptionLabel')} <span className="text-gray-400 font-normal">（{t('myVocabulary.descriptionOptional')}）</span>
              </label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t('myVocabulary.descriptionPlaceholder')}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200/80 bg-white/60 backdrop-blur-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all resize-none"
              />
            </div>

            {/* 提示信息 */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50/80 border border-blue-100">
              <span className="text-blue-500 mt-0.5">💡</span>
              <p className="text-xs text-blue-600">
                {t('myVocabulary.createTip')}
              </p>
            </div>
          </div>
        </ModalContent>
        
        <ModalFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowCreateModal(false);
              setCreateForm({ name: '', description: '' });
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateBook}
            disabled={creating || !createForm.name.trim()}
            leftIcon={creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          >
            {creating ? t('myVocabulary.creating') : t('myVocabulary.createBook')}
          </Button>
        </ModalFooter>
      </Modal>

      {/* 设置模态框 */}
      <VocabularySettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
}
