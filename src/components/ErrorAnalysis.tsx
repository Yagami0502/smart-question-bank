/**
 * 错题分析报告
 * 分析错题模式和薄弱知识点
 */
import { useState, useEffect } from 'react';
import { X, AlertTriangle, TrendingDown, Tag, BarChart3, PieChart, Target, Lightbulb, ChevronRight, RefreshCw } from 'lucide-react';
import AnimatedModal from './ui/AnimatedModal';
import { cn } from '../lib/utils';
import { db } from '../lib/database';

interface ErrorStats {
  totalErrors: number;
  errorRate: number;
  weakTags: { tag: string; errorCount: number; totalCount: number; errorRate: number }[];
  errorTrend: { date: string; errorCount: number; totalCount: number }[];
  commonMistakes: { questionId: string; content: string; errorCount: number }[];
  difficultyDistribution: { difficulty: number; errorCount: number; totalCount: number }[];
}

interface ErrorAnalysisProps {
  isOpen: boolean;
  onClose: () => void;
  deckId?: string;
}

export default function ErrorAnalysis({ isOpen, onClose, deckId }: ErrorAnalysisProps) {
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tags' | 'trend'>('overview');

  useEffect(() => {
    if (isOpen) {
      loadErrorStats();
    }
  }, [isOpen, deckId]);

  const loadErrorStats = async () => {
    setLoading(true);
    try {
      let cards = await db.cards.toArray();
      let questions = await db.questions.toArray();

      if (deckId) {
        cards = cards.filter(c => c.deckId === deckId);
        questions = questions.filter(q => q.deckId === deckId);
      }

      const totalReviews = cards.reduce((sum, c) => sum + (c.totalReviews || 0), 0);
      const totalErrors = cards.reduce((sum, c) => sum + (c.errorCount || 0), 0);
      const errorRate = totalReviews > 0 ? (totalErrors / totalReviews) * 100 : 0;

      const tagStats = new Map<string, { errorCount: number; totalCount: number }>();
      cards.forEach(card => {
        const question = questions.find(q => q.id === card.questionId);
        if (question && question.tags) {
          question.tags.forEach(tag => {
            const existing = tagStats.get(tag) || { errorCount: 0, totalCount: 0 };
            existing.errorCount += card.errorCount || 0;
            existing.totalCount += card.totalReviews || 0;
            tagStats.set(tag, existing);
          });
        }
      });

      const weakTags = Array.from(tagStats.entries())
        .map(([tag, data]) => ({
          tag,
          ...data,
          errorRate: data.totalCount > 0 ? (data.errorCount / data.totalCount) * 100 : 0,
        }))
        .filter(t => t.totalCount >= 3)
        .sort((a, b) => b.errorRate - a.errorRate)
        .slice(0, 10);

      const calendarData = localStorage.getItem('learning-calendar');
      const errorTrend: { date: string; errorCount: number; totalCount: number }[] = [];
      if (calendarData) {
        const records = JSON.parse(calendarData);
        const dates = Object.keys(records).sort().slice(-14);
        dates.forEach(date => {
          const record = records[date];
          if (record.questionsCount > 0) {
            errorTrend.push({
              date,
              errorCount: record.questionsCount - (record.correctCount || 0),
              totalCount: record.questionsCount,
            });
          }
        });
      }

      const commonMistakes = cards
        .filter(c => (c.errorCount || 0) >= 2)
        .sort((a, b) => (b.errorCount || 0) - (a.errorCount || 0))
        .slice(0, 5)
        .map(card => {
          const question = questions.find(q => q.id === card.questionId);
          return {
            questionId: card.questionId,
            content: question?.content || '未知题目',
            errorCount: card.errorCount || 0,
          };
        });

      const difficultyStats = new Map<number, { errorCount: number; totalCount: number }>();
      cards.forEach(card => {
        const question = questions.find(q => q.id === card.questionId);
        const difficulty = question?.difficulty || 3;
        const existing = difficultyStats.get(difficulty) || { errorCount: 0, totalCount: 0 };
        existing.errorCount += card.errorCount || 0;
        existing.totalCount += card.totalReviews || 0;
        difficultyStats.set(difficulty, existing);
      });

      const difficultyDistribution = [1, 2, 3, 4, 5].map(d => ({
        difficulty: d,
        ...(difficultyStats.get(d) || { errorCount: 0, totalCount: 0 }),
      }));

      setStats({
        totalErrors,
        errorRate,
        weakTags,
        errorTrend,
        commonMistakes,
        difficultyDistribution,
      });
    } catch (error) {
      console.error('Failed to load error stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyLabel = (d: number) => {
    const labels = ['', '入门', '简单', '中等', '困难', '专家'];
    return labels[d] || '未知';
  };

  const getAdvice = () => {
    if (!stats) return [];
    const advice: string[] = [];

    if (stats.errorRate > 40) {
      advice.push('错误率较高，建议放慢学习节奏，确保理解每道题');
    }
    if (stats.weakTags.length > 0 && stats.weakTags[0].errorRate > 50) {
      advice.push(`重点复习「${stats.weakTags[0].tag}」相关知识点`);
    }
    if (stats.commonMistakes.length > 3) {
      advice.push('有多道题目反复出错，建议重新学习这些题目的解析');
    }
    if (stats.difficultyDistribution[3]?.errorCount > stats.difficultyDistribution[3]?.totalCount * 0.5) {
      advice.push('中等难度题目错误率高，可能基础不够扎实');
    }
    if (advice.length === 0) {
      advice.push('继续保持良好的学习状态！');
    }

    return advice;
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b flex-shrink-0 border-gray-200 bg-gradient-to-r from-red-500 to-rose-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">错题分析</h2>
                <p className="text-xs text-white/80">发现薄弱环节，针对性提升</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadErrorStats} className="p-2 rounded-lg text-white" title="刷新数据">
                <RefreshCw size={18} />
              </button>
              <button onClick={onClose} className="p-2 rounded-lg">
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {[
            { id: 'overview', label: '总览', icon: PieChart },
            { id: 'tags', label: '知识点', icon: Tag },
            { id: 'trend', label: '趋势', icon: BarChart3 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium",
                activeTab === tab.id
                  ? "text-red-500 border-b-2 border-red-500"
                  : "text-gray-500"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
            </div>
          ) : !stats ? (
            <div className="text-center py-12">
              <AlertTriangle size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">暂无错题数据</p>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-red-50">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown size={18} className="text-red-500" />
                        <span className="text-sm text-gray-600">总错题数</span>
                      </div>
                      <p className="text-2xl font-bold text-red-500">{stats.totalErrors}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-orange-50">
                      <div className="flex items-center gap-2 mb-2">
                        <Target size={18} className="text-orange-500" />
                        <span className="text-sm text-gray-600">错误率</span>
                      </div>
                      <p className="text-2xl font-bold text-orange-500">{stats.errorRate.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gray-50">
                    <h3 className="text-sm font-medium mb-3 text-gray-900">难度分布</h3>
                    <div className="space-y-2">
                      {stats.difficultyDistribution.map(d => {
                        const errorRate = d.totalCount > 0 ? (d.errorCount / d.totalCount) * 100 : 0;
                        return (
                          <div key={d.difficulty} className="flex items-center gap-3">
                            <span className="w-12 text-xs text-gray-500">{getDifficultyLabel(d.difficulty)}</span>
                            <div className="flex-1 h-4 rounded-full overflow-hidden bg-gray-200">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  errorRate > 50 ? "bg-red-500" :
                                  errorRate > 30 ? "bg-orange-500" :
                                  errorRate > 15 ? "bg-yellow-500" : "bg-green-500"
                                )}
                                style={{ width: `${Math.min(100, errorRate)}%` }}
                              />
                            </div>
                            <span className="w-12 text-xs text-right text-gray-500">{errorRate.toFixed(0)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {stats.commonMistakes.length > 0 && (
                    <div className="p-4 rounded-xl bg-gray-50">
                      <h3 className="text-sm font-medium mb-3 text-gray-900">常错题目 Top 5</h3>
                      <div className="space-y-2">
                        {stats.commonMistakes.map((m, i) => (
                          <div key={m.questionId} className="flex items-center gap-3 p-2 rounded-lg bg-white">
                            <span
                              className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                                i === 0 ? "bg-red-500 text-white" :
                                i === 1 ? "bg-orange-500 text-white" : "bg-gray-300 text-gray-600"
                              )}
                            >
                              {i + 1}
                            </span>
                            <p className="flex-1 text-sm truncate text-gray-700">{m.content}</p>
                            <span className="text-xs text-red-500 font-medium">错{m.errorCount}次</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-yellow-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb size={18} className="text-yellow-500" />
                      <h3 className="text-sm font-medium text-gray-900">学习建议</h3>
                    </div>
                    <ul className="space-y-1">
                      {getAdvice().map((advice, i) => (
                        <li key={i} className="text-sm flex items-start gap-2 text-gray-600">
                          <ChevronRight size={14} className="mt-0.5 flex-shrink-0 text-yellow-500" />
                          {advice}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Tags Tab */}
              {activeTab === 'tags' && (
                <div className="space-y-3">
                  {stats.weakTags.length === 0 ? (
                    <div className="text-center py-8">
                      <Tag size={40} className="text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">暂无足够数据分析薄弱知识点</p>
                    </div>
                  ) : (
                    stats.weakTags.map((tag, i) => (
                      <div key={tag.tag} className="p-4 rounded-xl bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                                tag.errorRate > 50 ? "bg-red-500 text-white" :
                                tag.errorRate > 30 ? "bg-orange-500 text-white" : "bg-yellow-500 text-white"
                              )}
                            >
                              {i + 1}
                            </span>
                            <span className="font-medium text-gray-900">{tag.tag}</span>
                          </div>
                          <span
                            className={cn(
                              "text-sm font-medium",
                              tag.errorRate > 50 ? "text-red-500" :
                              tag.errorRate > 30 ? "text-orange-500" : "text-yellow-500"
                            )}
                          >
                            {tag.errorRate.toFixed(1)}% 错误率
                          </span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden bg-gray-200">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              tag.errorRate > 50 ? "bg-red-500" :
                              tag.errorRate > 30 ? "bg-orange-500" : "bg-yellow-500"
                            )}
                            style={{ width: `${Math.min(100, tag.errorRate)}%` }}
                          />
                        </div>
                        <p className="text-xs mt-2 text-gray-500">
                          共 {tag.totalCount} 次练习，错误 {tag.errorCount} 次
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Trend Tab */}
              {activeTab === 'trend' && (
                <div className="space-y-4">
                  {stats.errorTrend.length === 0 ? (
                    <div className="text-center py-8">
                      <BarChart3 size={40} className="text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">暂无趋势数据</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 rounded-xl bg-gray-50">
                        <h3 className="text-sm font-medium mb-4 text-gray-900">近14天错题趋势</h3>
                        <div className="flex items-end gap-1 h-32">
                          {stats.errorTrend.map((d, i) => {
                            const errorRate = d.totalCount > 0 ? (d.errorCount / d.totalCount) * 100 : 0;
                            const height = Math.max(8, errorRate);
                            return (
                              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                  className={cn(
                                    "w-full rounded-t",
                                    errorRate > 50 ? "bg-red-500" :
                                    errorRate > 30 ? "bg-orange-500" :
                                    errorRate > 15 ? "bg-yellow-500" : "bg-green-500"
                                  )}
                                  style={{ height: `${height}%` }}
                                  title={`${d.date}: ${d.errorCount}/${d.totalCount} (${errorRate.toFixed(0)}%)`}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-2">
                          <span className="text-xs text-gray-400">{stats.errorTrend[0]?.date.slice(5)}</span>
                          <span className="text-xs text-gray-400">
                            {stats.errorTrend[stats.errorTrend.length - 1]?.date.slice(5)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {stats.errorTrend.slice().reverse().slice(0, 7).map(d => {
                          const errorRate = d.totalCount > 0 ? (d.errorCount / d.totalCount) * 100 : 0;
                          return (
                            <div key={d.date} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                              <span className="text-gray-600">{d.date}</span>
                              <div className="flex items-center gap-4">
                                <span className="text-sm text-gray-500">{d.errorCount}/{d.totalCount} 题</span>
                                <span
                                  className={cn(
                                    "text-sm font-medium px-2 py-0.5 rounded",
                                    errorRate > 50 ? "bg-red-100 text-red-600" :
                                    errorRate > 30 ? "bg-orange-100 text-orange-600" :
                                    errorRate > 15 ? "bg-yellow-100 text-yellow-600" : "bg-green-100 text-green-600"
                                  )}
                                >
                                  {errorRate.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AnimatedModal>
  );
}
