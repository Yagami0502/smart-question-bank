/**
 * 文章列表页面 - 展示内置文章和用户自定义文章
 */
import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Play,
  Trash2,
  FileText,
  Upload,
  Loader2,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Modal, ModalContent, ModalFooter } from '../components/ui/Modal';
import { dialog } from '../components/ui/ConfirmDialog';
import { articleOperations } from '../lib/vocabulary-db';
import type { Article } from '../types/vocabulary';

interface ArticlesPageProps {
  onNavigate: (view: string, data?: any) => void;
}

// 内置文章数据
const builtInArticles: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    title: 'The Importance of Reading',
    content: 'Reading is one of the most important skills a person can develop. It opens doors to new worlds and ideas. Through reading, we can learn about different cultures and perspectives. Books have the power to change our lives and shape our thinking. Regular reading improves vocabulary and comprehension skills. It also enhances critical thinking and analytical abilities.',
    translation: '阅读是一个人可以培养的最重要的技能之一。它为新世界和新思想打开了大门。通过阅读，我们可以了解不同的文化和观点。书籍有改变我们生活和塑造我们思维的力量。经常阅读可以提高词汇量和理解能力。它还能增强批判性思维和分析能力。',
    sentences: [],
    category: '教育',
    isBuiltIn: true,
  },
  {
    title: 'Climate Change',
    content: 'Climate change is one of the biggest challenges facing our planet today. Global temperatures are rising due to greenhouse gas emissions. This leads to melting ice caps and rising sea levels. Extreme weather events are becoming more frequent. We must take action to reduce our carbon footprint. Renewable energy sources offer hope for a sustainable future.',
    translation: '气候变化是当今地球面临的最大挑战之一。由于温室气体排放，全球气温正在上升。这导致冰盖融化和海平面上升。极端天气事件变得更加频繁。我们必须采取行动减少碳足迹。可再生能源为可持续的未来带来了希望。',
    sentences: [],
    category: '环境',
    isBuiltIn: true,
  },
  {
    title: 'The Digital Age',
    content: 'We live in an era of rapid technological advancement. Smartphones have become an essential part of daily life. Social media connects people across the globe. Artificial intelligence is transforming various industries. However, we must be mindful of digital privacy concerns. Finding balance between online and offline life is crucial.',
    translation: '我们生活在一个技术快速发展的时代。智能手机已成为日常生活的重要组成部分。社交媒体将全球各地的人们联系在一起。人工智能正在改变各个行业。然而，我们必须注意数字隐私问题。在线上和线下生活之间找到平衡至关重要。',
    sentences: [],
    category: '科技',
    isBuiltIn: true,
  },
];

export default function ArticlesPage({ onNavigate }: ArticlesPageProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTranslation, setNewTranslation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // 文件导入
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importingFile, setImportingFile] = useState(false);

  // 加载文章
  useEffect(() => {
    const loadArticles = async () => {
      try {
        setLoading(true);
        const allArticles = await articleOperations.getAll();
        
        // 如果没有文章，初始化内置文章
        if (allArticles.length === 0) {
          for (const article of builtInArticles) {
            const newArticle = await articleOperations.add(article);
            allArticles.push(newArticle);
          }
        }
        
        setArticles(allArticles);
      } catch (error) {
        console.error('加载文章失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadArticles();
  }, []);

  // 过滤文章
  const filteredArticles = selectedCategory === 'all'
    ? articles
    : articles.filter(a => a.category === selectedCategory || (selectedCategory === 'custom' && !a.isBuiltIn));

  // 获取所有分类
  const categories: string[] = ['all', ...new Set(articles.map(a => a.category).filter((c): c is string => Boolean(c))), 'custom'];

  // 创建文章
  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      dialog.warning('请输入文章标题和内容');
      return;
    }

    try {
      const newArticle = await articleOperations.add({
        title: newTitle,
        content: newContent,
        translation: newTranslation || undefined,
        isBuiltIn: false,
      });

      setArticles(prev => [...prev, newArticle]);
      
      setNewTitle('');
      setNewContent('');
      setNewTranslation('');
      setIsCreateModalOpen(false);
      
      dialog.success('文章创建成功');
    } catch (error) {
      console.error('创建文章失败:', error);
      dialog.error('创建失败');
    }
  };

  // 删除文章
  const handleDelete = async (article: Article) => {
    if (article.isBuiltIn) {
      dialog.warning('内置文章不能删除');
      return;
    }

    const confirmed = await dialog.confirm(
      `确定要删除文章「${article.title}」吗？`,
      { title: '删除文章', isDanger: true }
    );

    if (confirmed) {
      await articleOperations.delete(article.id);
      setArticles(prev => prev.filter(a => a.id !== article.id));
    }
  };

  // 开始练习
  const handleStartPractice = (article: Article) => {
    onNavigate('article-practice', { article });
  };

  // 处理文件导入
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportingFile(true);
      const text = await file.text();
      
      // 支持 JSON 和纯文本格式
      let articleData: { title?: string; content: string; translation?: string; category?: string };
      
      if (file.name.endsWith('.json')) {
        articleData = JSON.parse(text);
      } else {
        // 纯文本格式：第一行为标题，其余为内容
        const lines = text.split('\n');
        articleData = {
          title: lines[0]?.trim() || file.name.replace(/\.(txt|md)$/i, ''),
          content: lines.slice(1).join('\n').trim(),
        };
      }

      if (!articleData.content) {
        throw new Error('文章内容不能为空');
      }

      const newArticle = await articleOperations.add({
        title: articleData.title || file.name.replace(/\.(json|txt|md)$/i, ''),
        content: articleData.content,
        translation: articleData.translation,
        category: articleData.category,
        isBuiltIn: false,
      });

      setArticles(prev => [...prev, newArticle]);
      
      dialog.success('文章导入成功！');
    } catch (error) {
      console.error('导入失败:', error);
      dialog.error('导入失败，请检查文件格式');
    } finally {
      setImportingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto fade-in">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <FileText size={22} className="text-purple-600" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">背文章</h1>
            </div>
            <p className="text-sm md:text-base text-gray-600">
              通过跟打和默写练习，高效背诵英语文章。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.txt,.md"
              onChange={handleFileImport}
              className="hidden"
            />
            <Button
              variant="liquid-glass"
              size="sm"
              leftIcon={importingFile ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              onClick={() => fileInputRef.current?.click()}
              disabled={importingFile}
            >
              导入文章
            </Button>
            <Button
              variant="liquid-glass-blue"
              leftIcon={<Plus size={16} />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              添加文章
            </Button>
          </div>
        </div>
      </div>

      {/* 分类筛选 */}
      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-primary-500 text-white'
                : 'bg-white/50 text-gray-600 hover:bg-white/80'
            }`}
          >
            {cat === 'all' ? '全部' : cat === 'custom' ? '我的文章' : cat}
          </button>
        ))}
      </div>

      {/* 文章列表 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      ) : filteredArticles.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="mb-4 text-gray-600">暂无文章</p>
            <Button onClick={() => setIsCreateModalOpen(true)} leftIcon={<Plus size={16} />}>
              添加第一篇文章
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredArticles.map(article => (
            <Card key={article.id} className="group" hover>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {article.isBuiltIn && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          内置
                        </span>
                      )}
                      {article.category && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          {article.category}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg mb-1 text-gray-800">
                      {article.title}
                    </h3>
                  </div>
                  {!article.isBuiltIn && (
                    <button
                      onClick={() => handleDelete(article)}
                      className="p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50/50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                  {article.content}
                </p>
                
                {article.translation && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4 italic">
                    {article.translation}
                  </p>
                )}

                <Button
                  variant="liquid-glass-blue"
                  size="sm"
                  className="w-full"
                  leftIcon={<Play size={14} />}
                  onClick={() => handleStartPractice(article)}
                >
                  开始练习
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 创建文章弹窗 */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
        <ModalContent title="添加文章">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">文章标题</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="输入文章标题"
                className="w-full px-3 py-2 rounded-lg border outline-none transition-colors bg-white border-gray-300 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">英文内容</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="输入英文文章内容..."
                rows={6}
                className="w-full px-3 py-2 rounded-lg border outline-none transition-colors resize-none bg-white border-gray-300 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">中文翻译（可选）</label>
              <textarea
                value={newTranslation}
                onChange={(e) => setNewTranslation(e.target.value)}
                placeholder="输入中文翻译..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg border outline-none transition-colors resize-none bg-white border-gray-300 focus:border-primary-500"
              />
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>取消</Button>
          <Button onClick={handleCreate}>创建</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
