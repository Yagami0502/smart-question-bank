/**
 * 公共题库页面 - 液态玻璃风格
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Download,
  BookOpen,
  User,
  FileText,
  Globe,
  Loader2,
  X,
  Eye,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { dialog } from '../components/ui/ConfirmDialog';
import { authFetch } from '../lib/auth';
import { refreshQueries } from '../hooks/useAsyncQuery';

interface PublicDeck {
  id: string;
  name: string;
  description: string;
  authorId: string;
  authorName: string;
  questionCount: number;
  createdAt: number;
  updatedAt: number;
}

interface PreviewQuestion {
  id: string;
  content: string | { text: string };
  type: string;
  options?: { id: string; text: string; content?: { text: string } }[];
  correctAnswer?: string | string[];
  explanation?: string;
}

interface DecksPageProps {
  onNavigate: (view: string) => void;
}

// 获取内容文本
const getContentText = (content: string | { text: string } | undefined): string => {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content.text || '';
};

export default function DecksPage({ onNavigate }: DecksPageProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [publicDecks, setPublicDecks] = useState<PublicDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);
  
  // 预览相关状态
  const [previewDeck, setPreviewDeck] = useState<PublicDeck | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<PreviewQuestion[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 获取公共题库列表
  useEffect(() => {
    const fetchPublicDecks = async () => {
      try {
        setLoading(true);
        const res = await authFetch('/api/decks/public/list');
        if (res.ok) {
          const data = await res.json();
          setPublicDecks(data);
        }
      } catch (error) {
        console.error('获取公共题库失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicDecks();
  }, []);

  // 过滤题库
  const filteredDecks = publicDecks.filter(deck =>
    deck.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deck.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    deck.authorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 预览题库
  const handlePreview = async (deck: PublicDeck) => {
    setPreviewDeck(deck);
    setPreviewLoading(true);
    try {
      const res = await authFetch(`/api/decks/public/${deck.id}/questions`);
      if (res.ok) {
        const data = await res.json();
        setPreviewQuestions(data);
      }
    } catch (error) {
      console.error('获取题目失败:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  // 关闭预览
  const closePreview = () => {
    setPreviewDeck(null);
    setPreviewQuestions([]);
  };

  // 导入公共题库
  const handleImport = async (deckId: string) => {
    if (importing) return;

    try {
      setImporting(deckId);
      const res = await authFetch(`/api/decks/public/${deckId}/import`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        dialog.success(t('publicDecks.importSuccess', { name: data.deckName, count: data.importedCount }), t('publicDecks.importSuccessTitle'));
        refreshQueries();
        onNavigate('home');
      } else {
        const error = await res.json();
        dialog.error(error.error || t('publicDecks.importFailed'));
      }
    } catch (error) {
      console.error('导入失败:', error);
      dialog.error(t('publicDecks.importFailedRetry'));
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto fade-in">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
            <Globe size={22} className="text-primary-600" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{t('publicDecks.title')}</h1>
        </div>
        <p className="text-sm md:text-base text-gray-600">
          {t('publicDecks.subtitle')}
        </p>
      </div>

      {/* 搜索栏 */}
      <div className="mb-6">
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
                placeholder={t('publicDecks.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-transparent border-none outline-none text-gray-800 placeholder-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 题库列表 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      ) : filteredDecks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="mb-2 text-gray-600">
              {searchQuery ? t('publicDecks.noMatch') : t('publicDecks.noDecks')}
            </p>
            <p className="text-sm text-gray-500">
              {searchQuery ? t('publicDecks.tryOther') : t('publicDecks.beFirst')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDecks.map(deck => (
            <Card key={deck.id} className="group" hover>
              <div className="cursor-pointer" onClick={() => handlePreview(deck)}>
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
                  </div>
                </CardHeader>
              </div>
              <CardContent className="pt-2">
                {/* 作者和题目数 */}
                <div className="flex items-center gap-4 mb-4 cursor-pointer" onClick={() => handlePreview(deck)}>
                  <div className="flex items-center gap-1.5">
                    <User size={14} className="text-gray-400" />
                    <span className="text-sm text-gray-600">{deck.authorName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText size={14} className="text-gray-400" />
                    <span className="text-sm text-gray-600">{deck.questionCount} {t('publicDecks.questions')}</span>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    leftIcon={<Eye size={14} />}
                    onClick={() => handlePreview(deck)}
                  >
                    {t('publicDecks.preview')}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    leftIcon={importing === deck.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    onClick={() => handleImport(deck.id)}
                    disabled={importing !== null}
                  >
                    {importing === deck.id ? t('publicDecks.importing') : t('publicDecks.import')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 预览模态框 */}
      {previewDeck && (
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
                    <h2 className="text-lg font-bold text-white">{previewDeck.name}</h2>
                    <p className="text-xs text-white/80">{previewDeck.questionCount} {t('publicDecks.questions')} · {t('publicDecks.author')}: {previewDeck.authorName}</p>
                  </div>
                </div>
                <button onClick={closePreview} className="p-2 rounded-lg hover:bg-white/10">
                  <X size={20} className="text-white" />
                </button>
              </div>
            </div>

            {/* 题目列表 */}
            <div className="flex-1 overflow-y-auto p-4">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                </div>
              ) : previewQuestions.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">{t('publicDecks.noDeckQuestions')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {previewQuestions.map((question, index) => {
                    // 格式化正确答案显示
                    const formatAnswer = (answer: any) => {
                      if (!answer) return '';
                      if (Array.isArray(answer)) return answer.join('、');
                      return String(answer);
                    };
                    
                    // 获取题目类型翻译
                    const getQuestionTypeLabel = (type: string) => {
                      const typeMap: Record<string, string> = {
                        'MCQ': t('publicDecks.questionTypes.MCQ'),
                        'MULTI': t('publicDecks.questionTypes.MULTI'),
                        'TRUE_FALSE': t('publicDecks.questionTypes.TRUE_FALSE'),
                        'FILL': t('publicDecks.questionTypes.FILL'),
                        'SHORT': t('publicDecks.questionTypes.SHORT'),
                      };
                      return typeMap[type] || type;
                    };
                    
                    return (
                      <div key={question.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                                {getQuestionTypeLabel(question.type)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">
                              {getContentText(question.content)}
                            </p>
                            {question.options && question.options.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {question.options.map((opt, optIndex) => {
                                  let optText = '';
                                  if (typeof opt === 'string') {
                                    optText = opt;
                                  } else if (opt.text) {
                                    optText = opt.text;
                                  } else if (opt.content) {
                                    optText = typeof opt.content === 'string' ? opt.content : opt.content.text || '';
                                  }
                                  return (
                                    <div key={opt.id || optIndex} className="text-sm text-gray-600 flex items-start gap-2">
                                      <span className="text-gray-400">{String.fromCharCode(65 + optIndex)}.</span>
                                      <span>{optText}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            
                            {/* 正确答案和解析 */}
                            <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                              {question.correctAnswer && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">{t('publicDecks.correctAnswer')}</span>
                                  <span className="text-sm text-green-700">{formatAnswer(question.correctAnswer)}</span>
                                </div>
                              )}
                              {question.explanation && (
                                <div className="text-sm text-gray-600">
                                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded mr-2">{t('publicDecks.explanation')}</span>
                                  <span className="whitespace-pre-wrap">{question.explanation}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-400">💡 {t('publicDecks.previewMode')}</p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={closePreview}>{t('common.close')}</Button>
                <Button
                  leftIcon={importing === previewDeck.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  onClick={() => { handleImport(previewDeck.id); closePreview(); }}
                  disabled={importing !== null}
                >
                  {t('publicDecks.importToMyDecks')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
