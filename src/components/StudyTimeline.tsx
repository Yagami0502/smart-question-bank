/**
 * 学习历史时间线
 * 展示学习活动记录
 */
import { useState, useEffect } from 'react';
import {
  X,
  Clock,
  CheckCircle,
  BookOpen,
  Target,
  Trophy,
  Calendar,
  TrendingUp,
  Filter,
  ChevronDown
} from 'lucide-react';
import AnimatedModal from './ui/AnimatedModal';
import { cn } from '../lib/utils';

interface TimelineEvent {
  id: string;
  type: 'practice' | 'achievement' | 'streak' | 'goal' | 'checkin';
  title: string;
  description: string;
  timestamp: number;
  data?: {
    correct?: number;
    total?: number;
    duration?: number;
    achievement?: string;
    streak?: number;
  };
}

interface StudyTimelineProps {
  isOpen: boolean;
  onClose: () => void;
}

// 获取学习历史数据
const getTimelineEvents = (): TimelineEvent[] => {
  const events: TimelineEvent[] = [];

  // 从学习日历获取数据
  const calendarData = localStorage.getItem('learning-calendar');
  if (calendarData) {
    const records = JSON.parse(calendarData);
    Object.entries(records).forEach(([date, record]: [string, any]) => {
      if (record.questionsCount > 0) {
        events.push({
          id: `practice_${date}`,
          type: 'practice',
          title: '完成练习',
          description: `答题 ${record.questionsCount} 道，正确 ${record.correctCount || 0} 道`,
          timestamp: new Date(date).getTime(),
          data: {
            correct: record.correctCount || 0,
            total: record.questionsCount,
            duration: record.studyMinutes || 0,
          },
        });
      }
      if (record.checkedIn) {
        events.push({
          id: `checkin_${date}`,
          type: 'checkin',
          title: '每日打卡',
          description: '完成今日学习打卡',
          timestamp: new Date(date).getTime() + 1000,
        });
      }
    });
  }

  // 从成就获取数据
  const achievementsData = localStorage.getItem('achievements-unlocked');
  if (achievementsData) {
    const achievements = JSON.parse(achievementsData);
    achievements.forEach((ach: any, index: number) => {
      events.push({
        id: `achievement_${index}`,
        type: 'achievement',
        title: '解锁成就',
        description: ach.name || '获得新成就',
        timestamp: ach.unlockedAt || Date.now() - (index * 86400000),
        data: { achievement: ach.id },
      });
    });
  }

  // 获取连续打卡记录
  const calendarRecords = calendarData ? JSON.parse(calendarData) : {};
  let currentStreak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const record = calendarRecords[dateStr];
    if (record && (record.questionsCount > 0 || record.checkedIn)) {
      currentStreak++;
    } else if (i > 0) {
      break;
    }
  }

  if (currentStreak >= 3) {
    events.push({
      id: `streak_current`,
      type: 'streak',
      title: '连续学习',
      description: `已连续学习 ${currentStreak} 天`,
      timestamp: Date.now(),
      data: { streak: currentStreak },
    });
  }

  // 按时间排序（最新在前）
  events.sort((a, b) => b.timestamp - a.timestamp);
  return events;
};

const eventIcons = {
  practice: BookOpen,
  achievement: Trophy,
  streak: TrendingUp,
  goal: Target,
  checkin: CheckCircle,
};

const eventColors = {
  practice: { bg: 'bg-blue-500', light: 'bg-blue-100 text-blue-600' },
  achievement: { bg: 'bg-yellow-500', light: 'bg-yellow-100 text-yellow-600' },
  streak: { bg: 'bg-orange-500', light: 'bg-orange-100 text-orange-600' },
  goal: { bg: 'bg-green-500', light: 'bg-green-100 text-green-600' },
  checkin: { bg: 'bg-purple-500', light: 'bg-purple-100 text-purple-600' },
};

export default function StudyTimeline({ isOpen, onClose }: StudyTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEvents(getTimelineEvents());
    }
  }, [isOpen]);

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    return event.type === filter;
  });

  const groupedEvents = filteredEvents.reduce((groups, event) => {
    const date = new Date(event.timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
    return groups;
  }, {} as Record<string, TimelineEvent[]>);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStats = () => {
    const practiceEvents = events.filter(e => e.type === 'practice');
    const totalQuestions = practiceEvents.reduce((sum, e) => sum + (e.data?.total || 0), 0);
    const totalCorrect = practiceEvents.reduce((sum, e) => sum + (e.data?.correct || 0), 0);
    const totalDuration = practiceEvents.reduce((sum, e) => sum + (e.data?.duration || 0), 0);
    const achievementCount = events.filter(e => e.type === 'achievement').length;
    return { totalQuestions, totalCorrect, totalDuration, achievementCount };
  };

  const stats = getStats();

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b flex-shrink-0 border-gray-200 bg-gradient-to-r from-slate-600 to-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">学习时间线</h2>
                <p className="text-xs text-white/80">回顾你的学习历程</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg">
              <X size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 p-4 border-b border-gray-100 bg-gray-50">
          <div className="p-3 rounded-xl text-center bg-white">
            <p className="text-xl font-bold text-gray-900">{stats.totalQuestions}</p>
            <p className="text-xs text-gray-500">总答题</p>
          </div>
          <div className="p-3 rounded-xl text-center bg-white">
            <p className="text-xl font-bold text-green-500">
              {stats.totalQuestions > 0 ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100) : 0}%
            </p>
            <p className="text-xs text-gray-500">正确率</p>
          </div>
          <div className="p-3 rounded-xl text-center bg-white">
            <p className="text-xl font-bold text-blue-500">{Math.round(stats.totalDuration / 60)}h</p>
            <p className="text-xs text-gray-500">学习时长</p>
          </div>
          <div className="p-3 rounded-xl text-center bg-white">
            <p className="text-xl font-bold text-yellow-500">{stats.achievementCount}</p>
            <p className="text-xs text-gray-500">成就数</p>
          </div>
        </div>

        {/* Filter */}
        <div className="px-4 py-2 border-b flex items-center justify-between border-gray-100">
          <div className="relative">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-600"
            >
              <Filter size={14} />
              {filter === 'all' ? '全部类型' : filter === 'practice' ? '练习记录' : filter === 'achievement' ? '成就' : filter === 'streak' ? '连续记录' : filter === 'checkin' ? '打卡记录' : '全部类型'}
              <ChevronDown size={14} />
            </button>
            {showFilter && (
              <div className="absolute top-full left-0 mt-1 py-1 rounded-lg shadow-lg z-10 min-w-[120px] bg-white border">
                {['all', 'practice', 'achievement', 'streak', 'checkin'].map(f => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); setShowFilter(false); }}
                    className={cn("w-full px-3 py-1.5 text-left text-sm", filter === f ? "bg-orange-500 text-white" : "text-gray-600")}
                  >
                    {f === 'all' ? '全部类型' : f === 'practice' ? '练习记录' : f === 'achievement' ? '成就' : f === 'streak' ? '连续记录' : '打卡记录'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="text-sm text-gray-500">共 {filteredEvents.length} 条记录</span>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-4">
          {Object.keys(groupedEvents).length === 0 ? (
            <div className="text-center py-12">
              <Clock size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">暂无学习记录</p>
              <p className="text-sm text-gray-400">开始学习后这里会显示你的学习历程</p>
            </div>
          ) : (
            Object.entries(groupedEvents).map(([date, dayEvents]) => (
              <div key={date} className="mb-6">
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                    <Calendar size={14} />
                    {date}
                  </div>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Events */}
                <div className="space-y-3 pl-4">
                  {dayEvents.map((event, index) => {
                    const Icon = eventIcons[event.type];
                    const colors = eventColors[event.type];

                    return (
                      <div key={event.id} className="relative flex gap-4 p-3 rounded-xl bg-gray-50">
                        {/* Timeline Line */}
                        {index < dayEvents.length - 1 && (
                          <div className="absolute left-[26px] top-12 bottom-0 w-0.5 bg-gray-200" />
                        )}

                        {/* Icon */}
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", colors.bg)}>
                          <Icon size={16} className="text-white" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-900">{event.title}</h4>
                            <span className="text-xs text-gray-400">{formatTime(event.timestamp)}</span>
                          </div>
                          <p className="text-sm mt-0.5 text-gray-500">{event.description}</p>

                          {/* Extra Data */}
                          {event.data && event.type === 'practice' && (
                            <div className="flex items-center gap-3 mt-2">
                              {event.data.total && (
                                <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                                  {event.data.correct}/{event.data.total} 题
                                </span>
                              )}
                              {event.data.total && event.data.correct !== undefined && (
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded",
                                  event.data.correct / event.data.total >= 0.8 ? "bg-green-100 text-green-600" :
                                  event.data.correct / event.data.total >= 0.6 ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600"
                                )}>
                                  {Math.round((event.data.correct / event.data.total) * 100)}% 正确率
                                </span>
                              )}
                              {event.data.duration && event.data.duration > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">
                                  {event.data.duration} 分钟
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AnimatedModal>
  );
}
