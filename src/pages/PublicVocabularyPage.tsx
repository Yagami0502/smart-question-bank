/**
 * 公共词库页面 - 展示内置词库和用户分享的词库
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Download,
  BookOpen,
  Globe,
  Loader2,
  GraduationCap,
  X,
  Eye,
  Volume2,
  User,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { dialog } from '../components/ui/ConfirmDialog';
import { 
  vocabularyBookOperations, 
  userVocabularyOperations,
  wordOperations,
} from '../lib/vocabulary-db';
import { speechService } from '../lib/speech-service';
import type { VocabularyBook, Word } from '../types/vocabulary';

interface PublicVocabularyPageProps {
  onNavigate?: (view: string) => void;
}

// 带实时单词数量的词库类型
interface VocabularyBookWithCount extends VocabularyBook {
  wordCount: number;  // 实时查询的单词数量
  authorId?: string;
  authorName?: string;
}

export default function PublicVocabularyPage(_props: PublicVocabularyPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [books, setBooks] = useState<VocabularyBookWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  
  // 预览相关状态
  const [previewBook, setPreviewBook] = useState<VocabularyBook | null>(null);
  const [previewWords, setPreviewWords] = useState<Word[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 初始化内置词库
  useEffect(() => {
    const initBooks = async () => {
      try {
        setLoading(true);
        
        // 从后端获取所有公共词库（内置词库由后端导入脚本管理）
        const allBooks = await vocabularyBookOperations.getPublicBooks();
        
        // 并行查询每个词库的实时单词数量
        const booksWithCount = await Promise.all(
          allBooks.map(async (book: any) => {
            const wordCount = await wordOperations.getByBookId(book.id).then(words => words.length);
            return { 
              ...book, 
              wordCount,
              authorId: book.authorId,
              authorName: book.authorName,
            };
          })
        );
        
        setBooks(booksWithCount);
      } catch (error) {
        console.error('加载词库失败:', error);
      } finally {
        setLoading(false);
      }
    };

    initBooks();
  }, []);

  // 过滤词库
  const filteredBooks = books.filter(book => {
    const matchesSearch = book.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // 添加到我的词库
  const handleAddToMyVocabulary = async (book: VocabularyBookWithCount) => {
    if (importing) return;

    try {
      setImporting(book.id);
      await userVocabularyOperations.add(book.id, book.name);
      dialog.success(`已将「${book.name}」添加到我的词库`, '添加成功');
    } catch (error) {
      console.error('添加失败:', error);
      dialog.error('添加失败，请重试');
    } finally {
      setImporting(null);
    }
  };

  // 预览词库
  const handlePreview = async (book: VocabularyBook) => {
    setPreviewBook(book);
    setPreviewLoading(true);
    try {
      // 从后端获取词库单词
      const words = await wordOperations.getByBookId(book.id);
      setPreviewWords(words);
    } catch (error) {
      console.error('获取单词失败:', error);
      dialog.error('加载词库数据失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  // 关闭预览
  const closePreview = () => {
    setPreviewBook(null);
    setPreviewWords([]);
  };

  // 播放单词发音
  const handlePlayAudio = (word: string) => {
    speechService.speakWord(word);
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto fade-in">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                <Globe size={22} className="text-primary-600" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">公共词库</h1>
            </div>
            <p className="text-sm md:text-base text-gray-600">
              内置常用英语词库，一键添加到我的词库开始学习。
            </p>
          </div>
        </div>
      </div>

      {/* 搜索 */}
      <div className="mb-6">
        {/* 搜索栏 */}
        <div className="liquid-glass-wrapper liquid-glass-card" style={{ '--border-radius': '12px' } as React.CSSProperties}>
          <div className="liquid-glass-outer" />
          <div className="liquid-glass-cover" />
          <div className="liquid-glass-sharp" />
          <div className="liquid-glass-reflect" />
          <div className="liquid-glass-content">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="搜索词库名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-transparent border-none outline-none text-gray-800 placeholder-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 词库列表 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      ) : filteredBooks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="mb-2 text-gray-600">
              {searchQuery ? '没有找到匹配的词库' : '暂无公共词库'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBooks.map(book => {
            return (
              <Card key={book.id} className="group" hover>
                <div className="cursor-pointer" onClick={() => handlePreview(book)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1 text-gray-800">
                          {book.name}
                        </h3>
                        {book.description && (
                          <p className="text-sm line-clamp-2 text-gray-600">{book.description}</p>
                        )}
                      </div>
                      <Eye size={16} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" />
                    </div>
                  </CardHeader>
                </div>
                <CardContent className="pt-2">
                  {/* 统计信息 */}
                  <div className="flex items-center gap-4 mb-4 cursor-pointer" onClick={() => handlePreview(book)}>
                    <div className="flex items-center gap-1.5">
                      <User size={14} className="text-gray-400" />
                      <span className="text-sm text-gray-600">{book.authorName || '官方'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <GraduationCap size={14} className="text-gray-400" />
                      <span className="text-sm text-gray-600">{book.wordCount.toLocaleString()} 词</span>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      leftIcon={<Eye size={14} />}
                      onClick={() => handlePreview(book)}
                    >
                      预览
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      leftIcon={importing === book.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      onClick={() => handleAddToMyVocabulary(book)}
                      disabled={importing !== null}
                    >
                      {importing === book.id ? '添加中...' : '添加'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 预览模态框 */}
      {previewBook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closePreview}>
          <div className="rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col bg-white" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-4 border-b flex-shrink-0 border-gray-200 bg-gradient-to-r from-primary-500 to-primary-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{previewBook.name}</h2>
                    <p className="text-xs text-white/80">{previewWords.length.toLocaleString()} 个单词</p>
                  </div>
                </div>
                <button onClick={closePreview} className="p-2 rounded-lg hover:bg-white/10">
                  <X size={20} className="text-white" />
                </button>
              </div>
            </div>

            {/* 单词列表 */}
            <div className="flex-1 overflow-y-auto p-4">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                </div>
              ) : previewWords.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">该词库暂无单词数据</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {previewWords.map((word, index) => (
                    <div key={word.id} className="p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-800">{word.word}</span>
                            <button
                              onClick={() => handlePlayAudio(word.word)}
                              className="p-1 rounded hover:bg-gray-200 transition-colors"
                              title="播放发音"
                            >
                              <Volume2 size={14} className="text-gray-500" />
                            </button>
                            {word.phonetic && (
                              <span className="text-xs text-gray-500">
                                {word.phonetic.us ? `/${word.phonetic.us}/` : word.phonetic.uk ? `/${word.phonetic.uk}/` : ''}
                              </span>
                            )}
                          </div>
                          {/* 释义 */}
                          <div className="text-sm text-gray-600">
                            {word.translations.map((t: any, i) => {
                              const typeStr = String(t.type || t.pos || '');
                              const transStr = String(t.translation || t.cn || '');
                              return (
                                <span key={i}>
                                  <span className="text-primary-600 font-medium">{typeStr}</span>
                                  {' '}{transStr}
                                  {i < word.translations.length - 1 && '；'}
                                </span>
                              );
                            })}
                          </div>
                          {/* 短语（如果有） */}
                          {word.phrases && word.phrases.length > 0 && (
                            <div className="mt-1 text-xs text-gray-500">
                              {word.phrases.slice(0, 2).map((p, i) => (
                                <span key={i}>
                                  {p.phrase} - {p.translation}
                                  {i < Math.min(word.phrases!.length, 2) - 1 && '；'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-400">💡 预览模式，仅供查看</p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={closePreview}>关闭</Button>
                <Button
                  leftIcon={importing === previewBook.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  onClick={() => { 
                    userVocabularyOperations.add(previewBook.id, previewBook.name)
                      .then(() => {
                        dialog.success(`已将「${previewBook.name}」添加到我的词库`, '添加成功');
                        closePreview();
                      })
                      .catch(() => dialog.error('添加失败，请重试'));
                  }}
                  disabled={importing !== null}
                >
                  添加到我的词库
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
