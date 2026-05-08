import { useMemo } from 'react';
import { useLiveQuery } from '../hooks/useAsyncQuery';
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Target,
  Flame,
  BookOpen,
  Award
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { CircularProgress } from '../components/ui/Progress';
import { db, deckOperations, questionOperations, dailyRecordOperations } from '../lib/database';
import { predictForgettingCurve } from '../lib/sm2';
import { cn, getHeatmapColor } from '../lib/utils';
import type { Deck } from '../types';

interface DashboardPageProps {
  deck: Deck;
  onBack: () => void;
}

export default function DashboardPage({ deck, onBack }: DashboardPageProps) {
  const deckStats = useLiveQuery(() => deckOperations.getStats(deck.id), [deck.id]);
  const allCards = useLiveQuery(() => db.cards.where('deckId').equals(deck.id).toArray(), [deck.id]);
  const allQuestions = useLiveQuery(() => questionOperations.getByDeckId(deck.id), [deck.id]);
  const streak = useLiveQuery(() => dailyRecordOperations.getStreak(), []);
  const heatmapData = useLiveQuery(() => dailyRecordOperations.getHeatmapData(90), []);

  const forgettingCurve = useMemo(() => {
    if (!allCards || allCards.length === 0) return [];
    return predictForgettingCurve(allCards, 14);
  }, [allCards]);

  const tagMastery = useMemo(() => {
    if (!allCards || !allQuestions) return [];
    const tagStats = new Map<string, { total: number; mastered: number }>();
    for (const question of allQuestions) {
      const card = allCards.find(c => c.questionId === question.id);
      if (!card) continue;
      for (const tag of question.tags) {
        if (!tagStats.has(tag)) {
          tagStats.set(tag, { total: 0, mastered: 0 });
        }
        const stats = tagStats.get(tag)!;
        stats.total++;
        if (card.state === 'review' && card.easeFactor >= 2.5) {
          stats.mastered++;
        }
      }
    }
    return Array.from(tagStats.entries())
      .map(([tag, stats]) => ({
        tag,
        mastery: stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0,
        fullMark: 100
      }))
      .slice(0, 8);
  }, [allCards, allQuestions]);

  const difficultCards = useMemo(() => {
    if (!allCards) return [];
    return allCards.filter(c => c.lapses >= 2).sort((a, b) => b.lapses - a.lapses).slice(0, 5);
  }, [allCards]);

  const heatmapMatrix = useMemo(() => {
    const weeks: Array<Array<{ date: string; count: number }>> = [];
    const today = new Date();
    const maxCount = Math.max(...(heatmapData?.map(d => d.count) || [1]), 1);
    for (let week = 11; week >= 0; week--) {
      const weekData: Array<{ date: string; count: number }> = [];
      for (let day = 0; day < 7; day++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (week * 7 + (6 - day)));
        const dateStr = date.toISOString().split('T')[0];
        const record = heatmapData?.find(d => d.date === dateStr);
        weekData.push({ date: dateStr, count: record?.count || 0 });
      }
      weeks.push(weekData);
    }
    return { weeks, maxCount };
  }, [heatmapData]);

  const totalCards = deckStats?.total || 0;
  const masteredCards = deckStats?.mastered || 0;
  const masteryRate = totalCards > 0 ? masteredCards / totalCards : 0;

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
              <p className="text-sm text-gray-600">{deck.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 fade-in">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="py-4 text-center">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-primary-500" />
              <div className="text-2xl font-bold text-gray-800">{totalCards}</div>
              <div className="text-sm text-gray-600">总题数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <Target className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600">{deckStats?.due || 0}</div>
              <div className="text-sm text-gray-600">今日待复习</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <Flame className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-orange-600">{streak || 0}</div>
              <div className="text-sm text-gray-600">连续学习天数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <Award className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-600">{Math.round(masteryRate * 100)}%</div>
              <div className="text-sm text-gray-600">掌握率</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Mastery Ring */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-800">总体掌握度</h3>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-8">
              <div className="text-center">
                <CircularProgress
                  value={masteryRate * 100}
                  size={160}
                  strokeWidth={16}
                  color={masteryRate >= 0.8 ? '#22c55e' : masteryRate >= 0.5 ? '#f59e0b' : '#ef4444'}
                />
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-gray-800">{deckStats?.new || 0}</div>
                    <div className="text-gray-600">新题目</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{deckStats?.learning || 0}</div>
                    <div className="text-gray-600">学习中</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{masteredCards}</div>
                    <div className="text-gray-600">已掌握</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tag Radar */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-800">知识点掌握雷达图</h3>
            </CardHeader>
            <CardContent>
              {tagMastery.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={tagMastery}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="tag" tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#6b7280' }} />
                    <Radar name="掌握度" dataKey="mastery" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-500">暂无标签数据</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Forgetting Curve */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-500" />
              <h3 className="font-semibold text-gray-800">遗忘曲线预测</h3>
            </div>
            <p className="text-sm mt-1 text-gray-600">预测未来14天的记忆保持率和待复习题目数</p>
          </CardHeader>
          <CardContent>
            {forgettingCurve.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={forgettingCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(day) => (day === 0 ? '今天' : `+${day}天`)}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(v) => `${Math.round(v * 100)}%`}
                    domain={[0, 1]}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', color: '#111827' }}
                    formatter={(value: number, name: string) => {
                      if (name === 'retention') return [`${Math.round(value * 100)}%`, '记忆保持率'];
                      return [value, '待复习数'];
                    }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="retention" stroke="#22c55e" strokeWidth={2} dot={false} name="retention" />
                  <Line yAxisId="right" type="stepAfter" dataKey="dueCount" stroke="#f59e0b" strokeWidth={2} dot={false} name="dueCount" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">暂无学习数据</div>
            )}
          </CardContent>
        </Card>

        {/* Heatmap */}
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
                        className={cn('w-3 h-3 rounded-sm heatmap-cell', getHeatmapColor(day.count, heatmapMatrix.maxCount))}
                        title={`${day.date}: ${day.count} 次练习`}
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

        {/* Difficult Cards */}
        {difficultCards.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-gray-800">高频错题 TOP 5</h3>
              </div>
              <p className="text-sm mt-1 text-gray-600">这些题目需要重点关注</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {difficultCards.map((card, index) => {
                  const question = allQuestions?.find((q) => q.id === card.questionId);
                  if (!question) return null;
                  return (
                    <div key={card.id} className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <span className="flex-shrink-0 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-medium flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2 text-gray-800">{question.content.text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-red-600">遗忘 {card.lapses} 次</span>
                          <span className="text-xs text-gray-500">EF: {card.easeFactor.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
