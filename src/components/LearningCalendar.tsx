/**
 * 学习日历与打卡系统
 * 展示学习记录热力图和打卡统计
 */
import { useState, useEffect } from 'react';
import { X, Calendar, Flame, Target, TrendingUp, ChevronLeft, ChevronRight, CheckCircle, Star } from 'lucide-react';
import AnimatedModal from './ui/AnimatedModal';
import Button from './ui/Button';
import { cn } from '../lib/utils';

interface DayRecord {
  date: string;
  questionsCount: number;
  correctCount: number;
  studyMinutes: number;
  checkedIn: boolean;
}

interface LearningCalendarProps {
  isOpen: boolean;
  onClose: () => void;
}

const learningRecordStorage = {
  getAll: (): Record<string, DayRecord> => {
    const data = localStorage.getItem('learning-calendar');
    return data ? JSON.parse(data) : {};
  },
  getByDate: (date: string): DayRecord | null => {
    const records = learningRecordStorage.getAll();
    return records[date] || null;
  },
  save: (date: string, record: Partial<DayRecord>): void => {
    const records = learningRecordStorage.getAll();
    records[date] = {
      ...records[date],
      date,
      questionsCount: record.questionsCount ?? records[date]?.questionsCount ?? 0,
      correctCount: record.correctCount ?? records[date]?.correctCount ?? 0,
      studyMinutes: record.studyMinutes ?? records[date]?.studyMinutes ?? 0,
      checkedIn: record.checkedIn ?? records[date]?.checkedIn ?? false,
    };
    localStorage.setItem('learning-calendar', JSON.stringify(records));
  },
  checkIn: (date: string): boolean => {
    const records = learningRecordStorage.getAll();
    if (records[date]?.checkedIn) return false;
    learningRecordStorage.save(date, { checkedIn: true });
    return true;
  },
  getStreak: (): number => {
    const records = learningRecordStorage.getAll();
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      if (records[dateStr]?.checkedIn || records[dateStr]?.questionsCount > 0) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  },
  getTotalDays: (): number => {
    const records = learningRecordStorage.getAll();
    return Object.values(records).filter(r => r.checkedIn || r.questionsCount > 0).length;
  },
};

export default function LearningCalendar({ isOpen, onClose }: LearningCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<Record<string, DayRecord>>({});
  const [streak, setStreak] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [todayCheckedIn, setTodayCheckedIn] = useState(false);
  const [showCheckInSuccess, setShowCheckInSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = () => {
    const allRecords = learningRecordStorage.getAll();
    setRecords(allRecords);
    setStreak(learningRecordStorage.getStreak());
    setTotalDays(learningRecordStorage.getTotalDays());
    const today = new Date().toISOString().split('T')[0];
    setTodayCheckedIn(allRecords[today]?.checkedIn || false);
  };

  const handleCheckIn = () => {
    const today = new Date().toISOString().split('T')[0];
    const success = learningRecordStorage.checkIn(today);
    if (success) {
      setTodayCheckedIn(true);
      setShowCheckInSuccess(true);
      loadData();
      setTimeout(() => setShowCheckInSuccess(false), 2000);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const getIntensityLevel = (record: DayRecord | null): number => {
    if (!record) return 0;
    const count = record.questionsCount;
    if (count === 0 && !record.checkedIn) return 0;
    if (count < 5) return 1;
    if (count < 15) return 2;
    if (count < 30) return 3;
    return 4;
  };

  const getIntensityColor = (level: number): string => {
    switch (level) {
      case 0: return 'bg-gray-100';
      case 1: return 'bg-green-100';
      case 2: return 'bg-green-300';
      case 3: return 'bg-green-500';
      case 4: return 'bg-green-600';
      default: return 'bg-gray-100';
    }
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const { daysInMonth, startingDay } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const monthStats = { totalQuestions: 0, totalCorrect: 0, studyDays: 0, totalMinutes: 0 };
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = records[dateStr];
    if (record) {
      monthStats.totalQuestions += record.questionsCount;
      monthStats.totalCorrect += record.correctCount;
      monthStats.totalMinutes += record.studyMinutes;
      if (record.questionsCount > 0 || record.checkedIn) {
        monthStats.studyDays++;
      }
    }
  }

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-green-500 to-teal-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">学习日历</h2>
                <p className="text-xs text-white/80">记录每一天的进步</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg">
              <X size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4 p-4 border-b border-gray-100 bg-gray-50">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Flame size={16} className="text-orange-500" />
              <span className="text-2xl font-bold text-orange-500">{streak}</span>
            </div>
            <p className="text-xs text-gray-500">连续天数</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Target size={16} className="text-blue-500" />
              <span className="text-2xl font-bold text-blue-500">{totalDays}</span>
            </div>
            <p className="text-xs text-gray-500">累计天数</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp size={16} className="text-green-500" />
              <span className="text-2xl font-bold text-green-500">{monthStats.studyDays}</span>
            </div>
            <p className="text-xs text-gray-500">本月天数</p>
          </div>
        </div>

        {/* Check-in Button */}
        <div className="p-4 border-b border-gray-100">
          {todayCheckedIn ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-50 text-green-600">
              <CheckCircle size={20} />
              <span className="font-medium">今日已打卡 ✓</span>
            </div>
          ) : (
            <Button
              onClick={handleCheckIn}
              className="w-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600"
              leftIcon={<Star size={18} />}
            >
              立即打卡
            </Button>
          )}
          {showCheckInSuccess && (
            <div className="mt-2 text-center text-green-500 text-sm animate-pulse">
              🎉 打卡成功！继续保持！
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="p-4 flex-1 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 rounded-lg">
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <h3 className="text-lg font-semibold text-gray-900">{monthName}</h3>
            <button onClick={nextMonth} className="p-2 rounded-lg">
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-medium py-1 text-gray-400">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startingDay }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const record = records[dateStr];
              const intensity = getIntensityLevel(record);
              const isToday = dateStr === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={day}
                  className={cn(
                    "aspect-square rounded-md flex items-center justify-center text-xs font-medium cursor-pointer hover:scale-110",
                    getIntensityColor(intensity),
                    isToday && "ring-2 ring-blue-500",
                    intensity > 0 ? "text-white" : "text-gray-400"
                  )}
                  title={record ? `${record.questionsCount} 题` : '暂无记录'}
                >
                  {day}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="text-xs text-gray-400">少</span>
            {[0, 1, 2, 3, 4].map(level => (
              <div key={level} className={cn("w-3 h-3 rounded-sm", getIntensityColor(level))} />
            ))}
            <span className="text-xs text-gray-400">多</span>
          </div>
        </div>

        {/* Monthly Stats */}
        <div className="p-4 border-t grid grid-cols-2 gap-4 border-gray-100 bg-gray-50">
          <div className="p-3 rounded-xl bg-white">
            <p className="text-xs mb-1 text-gray-500">本月答题</p>
            <p className="text-xl font-bold text-gray-900">
              {monthStats.totalQuestions} <span className="text-sm font-normal">题</span>
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white">
            <p className="text-xs mb-1 text-gray-500">正确率</p>
            <p className="text-xl font-bold text-gray-900">
              {monthStats.totalQuestions > 0
                ? Math.round((monthStats.totalCorrect / monthStats.totalQuestions) * 100)
                : 0}{' '}
              <span className="text-sm font-normal">%</span>
            </p>
          </div>
        </div>
      </div>
    </AnimatedModal>
  );
}

export { learningRecordStorage };
