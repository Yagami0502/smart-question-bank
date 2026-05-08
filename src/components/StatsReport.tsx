/**
 * 学习统计报告组件
 * 展示学习数据的可视化图表
 */
import { useState, useEffect } from 'react';
import {
  X,
  BarChart3,
  TrendingUp,
  Clock,
  Target,
  CheckCircle,
  Calendar,
  Award,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import AnimatedModal from './ui/AnimatedModal';
import { cn } from '../lib/utils';

interface DayStats {
  date: string;
  questions: number;
  correct: number;
  time: number;
}

interface StatsReportProps {
  isOpen: boolean;
  onClose: () => void;
}

// 统计数据存储
const statsStorage = {
  getWeeklyStats: (): DayStats[] => {
    const stats: DayStats[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = localStorage.getItem(`learning-calendar`);
      const records = dayData ? JSON.parse(dayData) : {};
      const record = records[dateStr];
      stats.push({
        date: dateStr,
        questions: record?.questionsCount || 0,
        correct: record?.correctCount || 0,
        time: record?.studyMinutes || 0,
      });
    }
    return stats;
  },

  getMonthlyStats: (year: number, month: number): DayStats[] => {
    const stats: DayStats[] = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayData = localStorage.getItem(`learning-calendar`);
    const records = dayData ? JSON.parse(dayData) : {};

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const record = records[dateStr];
      stats.push({
        date: dateStr,
        questions: record?.questionsCount || 0,
        correct: record?.correctCount || 0,
        time: record?.studyMinutes || 0,
      });
    }
    return stats;
  },

  getTotalStats: () => {
    const dayData = localStorage.getItem(`learning-calendar`);
    const records = dayData ? JSON.parse(dayData) : {};
    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalTime = 0;
    let studyDays = 0;

    Object.values(records).forEach((record: any) => {
      totalQuestions += record.questionsCount || 0;
      totalCorrect += record.correctCount || 0;
      totalTime += record.studyMinutes || 0;
      if (record.questionsCount > 0 || record.checkedIn) {
        studyDays++;
      }
    });

    return { totalQuestions, totalCorrect, totalTime, studyDays };
  },
};

export default function StatsReport({ isOpen, onClose }: StatsReportProps) {
  const [viewType, setViewType] = useState<'week' | 'month'>('week');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [weeklyStats, setWeeklyStats] = useState<DayStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<DayStats[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalQuestions: 0,
    totalCorrect: 0,
    totalTime: 0,
    studyDays: 0
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, currentMonth, viewType]);

  const loadData = () => {
    setWeeklyStats(statsStorage.getWeeklyStats());
    setMonthlyStats(statsStorage.getMonthlyStats(currentMonth.getFullYear(), currentMonth.getMonth()));
    setTotalStats(statsStorage.getTotalStats());
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const currentStats = viewType === 'week' ? weeklyStats : monthlyStats;
  const maxQuestions = Math.max(...currentStats.map(s => s.questions), 1);
  const totalPeriodQuestions = currentStats.reduce((sum, s) => sum + s.questions, 0);
  const totalPeriodCorrect = currentStats.reduce((sum, s) => sum + s.correct, 0);
  const totalPeriodTime = currentStats.reduce((sum, s) => sum + s.time, 0);
  const avgAccuracy = totalPeriodQuestions > 0
    ? Math.round((totalPeriodCorrect / totalPeriodQuestions) * 100)
    : 0;

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (viewType === 'week') {
      const days = ['日', '一', '二', '三', '四', '五', '六'];
      return days[date.getDay()];
    }
    return date.getDate().toString();
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b flex-shrink-0 border-gray-200 bg-gradient-to-r from-blue-500 to-cyan-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">学习统计</h2>
                <p className="text-xs text-white/80">数据分析与报告</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg">
              <X size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-4 gap-3 p-4 border-b flex-shrink-0 border-gray-100 bg-gray-50">
          <div className="p-3 rounded-xl text-center bg-white">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Target size={14} className="text-blue-500" />
            </div>
            <p className="text-xl font-bold text-gray-900">{totalStats.totalQuestions}</p>
            <p className="text-xs text-gray-500">总答题</p>
          </div>
          <div className="p-3 rounded-xl text-center bg-white">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle size={14} className="text-green-500" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {totalStats.totalQuestions > 0
                ? Math.round((totalStats.totalCorrect / totalStats.totalQuestions) * 100)
                : 0}%
            </p>
            <p className="text-xs text-gray-500">正确率</p>
          </div>
          <div className="p-3 rounded-xl text-center bg-white">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock size={14} className="text-purple-500" />
            </div>
            <p className="text-xl font-bold text-gray-900">
              {Math.round(totalStats.totalTime / 60)}h
            </p>
            <p className="text-xs text-gray-500">学习时长</p>
          </div>
          <div className="p-3 rounded-xl text-center bg-white">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar size={14} className="text-orange-500" />
            </div>
            <p className="text-xl font-bold text-gray-900">{totalStats.studyDays}</p>
            <p className="text-xs text-gray-500">学习天数</p>
          </div>
        </div>

        {/* View Toggle & Navigation */}
        <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0 border-gray-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewType('week')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium",
                viewType === 'week'
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              本周
            </button>
            <button
              onClick={() => setViewType('month')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium",
                viewType === 'month'
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              本月
            </button>
          </div>
          {viewType === 'month' && (
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1.5 rounded-lg">
                <ChevronLeft size={18} className="text-gray-600" />
              </button>
              <span className="text-sm font-medium min-w-[100px] text-center text-gray-900">
                {currentMonth.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
              </span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg">
                <ChevronRight size={18} className="text-gray-600" />
              </button>
            </div>
          )}
        </div>

        {/* Chart Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Period Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-blue-500" />
                <span className="text-xs text-gray-500">
                  {viewType === 'week' ? '本周' : '本月'}答题
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {totalPeriodQuestions} <span className="text-sm font-normal">题</span>
              </p>
            </div>
            <div className="p-3 rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <Award size={14} className="text-green-500" />
                <span className="text-xs text-gray-500">正确率</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{avgAccuracy}%</p>
            </div>
            <div className="p-3 rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className="text-purple-500" />
                <span className="text-xs text-gray-500">学习时长</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {totalPeriodTime} <span className="text-sm font-normal">分钟</span>
              </p>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="p-4 rounded-xl border border-gray-200 bg-white">
            <h3 className="text-sm font-medium mb-4 text-gray-900">每日答题量</h3>
            <div className="flex items-end gap-1 h-40">
              {currentStats.map((stat) => (
                <div key={stat.date} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center justify-end h-32">
                    {stat.questions > 0 && (
                      <span className="text-xs mb-1 text-gray-500">{stat.questions}</span>
                    )}
                    <div
                      className={cn(
                        "w-full max-w-8 rounded-t duration-300",
                        stat.questions > 0
                          ? "bg-gradient-to-t from-blue-500 to-cyan-400"
                          : "bg-gray-200"
                      )}
                      style={{
                        height: `${Math.max((stat.questions / maxQuestions) * 100, stat.questions > 0 ? 10 : 4)}%`,
                        minHeight: stat.questions > 0 ? '12px' : '4px'
                      }}
                    />
                  </div>
                  <span className="text-xs mt-2 text-gray-400">{getDayLabel(stat.date)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Accuracy Chart */}
          <div className="p-4 rounded-xl border mt-4 border-gray-200 bg-white">
            <h3 className="text-sm font-medium mb-4 text-gray-900">正确率趋势</h3>
            <div className="flex items-end gap-1 h-32">
              {currentStats.map((stat) => {
                const accuracy = stat.questions > 0
                  ? Math.round((stat.correct / stat.questions) * 100)
                  : 0;
                return (
                  <div key={stat.date} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col items-center justify-end h-24">
                      {stat.questions > 0 && (
                        <span
                          className={cn(
                            "text-xs mb-1",
                            accuracy >= 80
                              ? "text-green-500"
                              : accuracy >= 60
                                ? "text-yellow-500"
                                : "text-red-500"
                          )}
                        >
                          {accuracy}%
                        </span>
                      )}
                      <div
                        className={cn(
                          "w-full max-w-8 rounded-t duration-300",
                          stat.questions > 0
                            ? accuracy >= 80
                              ? "bg-gradient-to-t from-green-500 to-emerald-400"
                              : accuracy >= 60
                                ? "bg-gradient-to-t from-yellow-500 to-amber-400"
                                : "bg-gradient-to-t from-red-500 to-rose-400"
                            : "bg-gray-200"
                        )}
                        style={{
                          height: `${Math.max(accuracy, stat.questions > 0 ? 10 : 4)}%`,
                          minHeight: stat.questions > 0 ? '12px' : '4px'
                        }}
                      />
                    </div>
                    <span className="text-xs mt-2 text-gray-400">{getDayLabel(stat.date)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex-shrink-0 border-gray-100 bg-gray-50">
          <p className="text-xs text-center text-gray-400">
            📊 数据每日更新，持续学习看到进步！
          </p>
        </div>
      </div>
    </AnimatedModal>
  );
}

export { statsStorage };
