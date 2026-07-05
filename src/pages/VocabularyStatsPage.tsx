/**
 * 词库统计页面 - 展示词库学习统计数据
 */
import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Target,
  Flame,
  BookOpen,
  Award,
  AlertTriangle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { CircularProgress } from '../components/ui/Progress';
import {
  wordOperations,
  wordProgressOperations,
  wrongWordOperations,
  masteredWordOperations,
  userVocabularyOperations,
} from '../lib/vocabulary-db';
import { cn, getHeatmapColor } from '../lib/utils';
import type { Word, WordProgress, WrongWord } from '../types/vocabulary';

interface VocabularyStatsPageProps {
  bookId: string;
  bookName: string;
  onBack: () => void;
}

export default function VocabularyStatsPage({ bookId, bookName, onBack }: VocabularyStatsPageProps) {
  const [words, setWords] = useState<Word[]>([]);
  const [progress, setProgress] = useState<WordProgress[]>([]);
  const [wrongWords, setWrongWords] = useState<WrongWord[]>([]);
  const [masteredCount, setMasteredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userVocab, setUserVocab] = useState<{ learnedCount: number; masteredCount: number } | null>(null);

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [wordsData, progressData, wrongData, masteredData, userVocabs] = await Promise.all([
          wordOperations.getByBookId(bookId),
          wordProgressOperations.getDueWords(bookId, 1000),
          wrongWordOperations.getByBookId(bookId),
          masteredWordOperations.getAll(),
          userVocabularyOperations.getAllWithStats(),
        ]);
        
        setWords(wordsData);
        setProgress(progressData);
        setWrongWords(wrongData);
        setMasteredCount(masteredData.filter(m => m.bookId === bookId).length);
        
        const vocab = userVocabs.find(v => v.bookId === bookId);
        if (vocab) {
          setUserVocab({
            learnedCount: vocab.learnedCount,
            masteredCount: vocab.masteredCount,
          });
        } else {
          // 如果没有找到用户词库记录
          setUserVocab({
            learnedCount: 0,
            masteredCount: masteredData.filter(m => m.bookId === bookId).length,
          });
        }
      } catch (error) {
        console.error('加载统计数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [bookId]);

  // 计算统计数据
  const stats = useMemo(() => {
    // 始终使用实际加载的单词数量（words.length），这是最准确的数据源
    const totalWords = words.length;
    const learnedWords = userVocab?.learnedCount || 0;
    const mastered = userVocab?.masteredCount || masteredCount;
    const dueToday = progress.filter(p => p.dueDate <= Date.now()).length;
    const wrongCount = wrongWords.length;

    return {
      total: totalWords,
      learned: learnedWords,
      mastered,
      dueToday,
      wrongCount,
      masteryRate: totalWords > 0 ? mastered / totalWords : 0,
      learnedRate: totalWords > 0 ? learnedWords / totalWords : 0,
    };
  }, [words, progress, wrongWords, masteredCount, userVocab]);

  // 学习状态分布
  const stateDistribution = useMemo(() => {
    const newCount = stats.total - stats.learned;
    const learningCount = stats.learned - stats.mastered;
    
    return [
      { name: '未学习', value: newCount, color: '#94a3b8' },
      { name: '学习中', value: learningCount, color: '#3b82f6' },
      { name: '已掌握', value: stats.mastered, color: '#22c55e' },
    ].filter(item => item.value > 0);
  }, [stats]);

  // 高频错词
  const topWrongWords = useMemo(() => {
    return [...wrongWords]
      .sort((a, b) => b.wrongCount - a.wrongCount)
      .slice(0, 5);
  }, [wrongWords]);

  // 学习热力图数据（近12周，基于真实进度记录的最近复习时间）
  const heatmapMatrix = useMemo(() => {
    const activityByDate = new Map<string, number>();
    progress.forEach(p => {
      if (!p.lastReview) return;
      const key = new Date(p.lastReview).toISOString().split('T')[0];
      activityByDate.set(key, (activityByDate.get(key) || 0) + 1);
    });

    const weeks: Array<Array<{ date: string; count: number }>> = [];
    const today = new Date();
    for (let week = 11; week >= 0; week--) {
      const weekData: Array<{ date: string; count: number }> = [];
      for (let day = 0; day < 7; day++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (week * 7 + (6 - day)));
        const dateStr = date.toISOString().split('T')[0];
        weekData.push({ date: dateStr, count: activityByDate.get(dateStr) || 0 });
      }
      weeks.push(weekData);
    }

    const maxCount = Math.max(...weeks.flat().map(d => d.count), 1);
    return { weeks, maxCount };
  }, [progress]);

  // 学习趋势数据（近7天，基于真实进度记录）
  const trendData = useMemo(() => {
    const learnedByDate = new Map<string, number>();
    const reviewedByDate = new Map<string, number>();
    progress.forEach(p => {
      if (p.createdAt) {
        const key = new Date(p.createdAt).toISOString().split('T')[0];
        learnedByDate.set(key, (learnedByDate.get(key) || 0) + 1);
      }
      if (p.lastReview) {
        const key = new Date(p.lastReview).toISOString().split('T')[0];
        reviewedByDate.set(key, (reviewedByDate.get(key) || 0) + 1);
      }
    });

    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      data.push({
        day: date.toLocaleDateString('zh-CN', { weekday: 'short' }),
        learned: learnedByDate.get(key) || 0,
        reviewed: reviewedByDate.get(key) || 0,
      });
    }
    return data;
  }, [progress]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header
        className="liquid-glass-wrapper liquid-glass-header sticky top-0 z-10"
        style={{ '--border-radius': '0' } as React.CSSProperties}
      >
        <div className="liquid-glass-outer" />
        <div className="liquid-glass-cover" />
        <div className="liquid-glass-sharp" />
        <div className="liquid-glass-reflect" />
        <div className="liquid-glass-content">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
            <button onClick={onBack} className="p-2 rounded-lg text-gray-700 hover:bg-white/40 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-800">学习统计</h1>
              <p className="text-sm text-gray-600">{bookName}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 fade-in">
        {/* 概览统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="py-4 text-center">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-primary-500" />
              <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
              <div className="text-sm text-gray-600">总词数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <Target className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-600">{stats.learned}</div>
              <div className="text-sm text-gray-600">已学习</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <Award className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600">{stats.mastered}</div>
              <div className="text-sm text-gray-600">已掌握</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <Flame className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-600">{stats.dueToday}</div>
              <div className="text-sm text-gray-600">今日待复习</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 掌握度环形图 */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-800">总体掌握度</h3>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center">
                <CircularProgress
                  value={stats.masteryRate * 100}
                  size={160}
                  strokeWidth={16}
                  color={stats.masteryRate >= 0.8 ? '#22c55e' : stats.masteryRate >= 0.5 ? '#f59e0b' : '#ef4444'}
                />
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-gray-800">{stats.total - stats.learned}</div>
                    <div className="text-gray-600">未学习</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{stats.learned - stats.mastered}</div>
                    <div className="text-gray-600">学习中</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{stats.mastered}</div>
                    <div className="text-gray-600">已掌握</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 学习状态分布 */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-800">学习状态分布</h3>
            </CardHeader>
            <CardContent>
              {stateDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={stateDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {stateDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-500">暂无数据</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 学习趋势 */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-500" />
              <h3 className="font-semibold text-gray-800">近7天学习趋势</h3>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                />
                <Line type="monotone" dataKey="learned" stroke="#3b82f6" strokeWidth={2} name="新学" dot={{ fill: '#3b82f6' }} />
                <Line type="monotone" dataKey="reviewed" stroke="#22c55e" strokeWidth={2} name="复习" dot={{ fill: '#22c55e' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 学习热力图 */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-500" />
              <h3 className="font-semibold text-gray-800">学习热力图</h3>
            </div>
            <p className="text-sm mt-1 text-gray-600">最近12周的学习记录</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="flex gap-1 min-w-max">
                {heatmapMatrix.weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col gap-1">
                    {week.map((day, dayIdx) => (
                      <div
                        key={dayIdx}
                        className={cn('w-3 h-3 rounded-sm', getHeatmapColor(day.count, heatmapMatrix.maxCount))}
                        title={`${day.date}: ${day.count} 个单词`}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 mt-3 text-xs text-gray-600">
                <span>少</span>
                <div className="w-3 h-3 rounded-sm bg-gray-200" />
                <div className="w-3 h-3 rounded-sm bg-green-200" />
                <div className="w-3 h-3 rounded-sm bg-green-300" />
                <div className="w-3 h-3 rounded-sm bg-green-400" />
                <div className="w-3 h-3 rounded-sm bg-green-500" />
                <span>多</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 高频错词 */}
        {topWrongWords.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-gray-800">高频错词 TOP 5</h3>
              </div>
              <p className="text-sm mt-1 text-gray-600">这些单词需要重点关注</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topWrongWords.map((wrong, index) => (
                  <div key={wrong.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <span className="flex-shrink-0 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-medium flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800">{wrong.word}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-red-600">错误 {wrong.wrongCount} 次</span>
                        {wrong.userInputs.length > 0 && (
                          <span className="text-xs text-gray-500">
                            常见错误: {wrong.userInputs.slice(-3).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
