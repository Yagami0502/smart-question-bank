/**
 * 每日学习目标与任务系统
 * 设置和追踪每日学习目标
 */
import { useState, useEffect } from 'react';
import { X, Target, CheckCircle, Trophy, Clock, BookOpen, Zap, Gift, Settings } from 'lucide-react';
import AnimatedModal from './ui/AnimatedModal';
import Button from './ui/Button';
import { cn } from '../lib/utils';

interface DailyTask {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  type: 'questions' | 'correct' | 'time' | 'streak' | 'custom';
  reward: number;
  completed: boolean;
}

interface DailyGoalsProps {
  isOpen: boolean;
  onClose: () => void;
}

const dailyTasksStorage = {
  getTodayKey: () => `daily-tasks-${new Date().toISOString().split('T')[0]}`,
  getDefaultTasks: (): DailyTask[] => [
    { id: 'task_questions', title: '答题达人', description: '完成20道题目', target: 20, current: 0, type: 'questions', reward: 50, completed: false },
    { id: 'task_correct', title: '精准射手', description: '答对15道题目', target: 15, current: 0, type: 'correct', reward: 80, completed: false },
    { id: 'task_time', title: '学习时光', description: '学习30分钟', target: 30, current: 0, type: 'time', reward: 60, completed: false },
    { id: 'task_streak', title: '连击大师', description: '达成5连击', target: 5, current: 0, type: 'streak', reward: 100, completed: false },
  ],
  getTasks: (): DailyTask[] => {
    const key = dailyTasksStorage.getTodayKey();
    const data = localStorage.getItem(key);
    if (data) return JSON.parse(data);
    const defaultTasks = dailyTasksStorage.getDefaultTasks();
    localStorage.setItem(key, JSON.stringify(defaultTasks));
    return defaultTasks;
  },
  saveTasks: (tasks: DailyTask[]) => {
    const key = dailyTasksStorage.getTodayKey();
    localStorage.setItem(key, JSON.stringify(tasks));
  },
  updateProgress: (type: string, value: number) => {
    const tasks = dailyTasksStorage.getTasks();
    const updated = tasks.map(task => {
      if (task.type === type && !task.completed) {
        const newCurrent = Math.min(task.current + value, task.target);
        return { ...task, current: newCurrent, completed: newCurrent >= task.target };
      }
      return task;
    });
    dailyTasksStorage.saveTasks(updated);
    return updated;
  },
  getTotalXP: (): number => {
    const data = localStorage.getItem('total-xp');
    return data ? parseInt(data) : 0;
  },
  addXP: (xp: number) => {
    const current = dailyTasksStorage.getTotalXP();
    localStorage.setItem('total-xp', String(current + xp));
  },
  getGoals: () => {
    const data = localStorage.getItem('daily-goals-settings');
    return data ? JSON.parse(data) : { dailyQuestions: 20, dailyTime: 30, dailyCorrect: 15 };
  },
  saveGoals: (goals: { dailyQuestions: number; dailyTime: number; dailyCorrect: number }) => {
    localStorage.setItem('daily-goals-settings', JSON.stringify(goals));
  },
};

export default function DailyGoals({ isOpen, onClose }: DailyGoalsProps) {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [totalXP, setTotalXP] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [goals, setGoals] = useState({ dailyQuestions: 20, dailyTime: 30, dailyCorrect: 15 });
  const [showReward, setShowReward] = useState<{ xp: number; task: string } | null>(null);

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen]);

  const loadData = () => {
    setTasks(dailyTasksStorage.getTasks());
    setTotalXP(dailyTasksStorage.getTotalXP());
    setGoals(dailyTasksStorage.getGoals());
  };

  const handleClaimReward = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.completed && task.reward > 0) {
      dailyTasksStorage.addXP(task.reward);
      setTotalXP(prev => prev + task.reward);
      setShowReward({ xp: task.reward, task: task.title });
      setTimeout(() => setShowReward(null), 2000);
      const updated = tasks.map(t => (t.id === taskId ? { ...t, reward: 0 } : t));
      setTasks(updated);
      dailyTasksStorage.saveTasks(updated);
    }
  };

  const handleSaveGoals = () => {
    dailyTasksStorage.saveGoals(goals);
    const updated = tasks.map(task => {
      if (task.type === 'questions') return { ...task, target: goals.dailyQuestions, description: `完成${goals.dailyQuestions}道题目` };
      if (task.type === 'correct') return { ...task, target: goals.dailyCorrect, description: `答对${goals.dailyCorrect}道题目` };
      if (task.type === 'time') return { ...task, target: goals.dailyTime, description: `学习${goals.dailyTime}分钟` };
      return task;
    });
    setTasks(updated);
    dailyTasksStorage.saveTasks(updated);
    setShowSettings(false);
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalReward = tasks.reduce((sum, t) => sum + (t.completed ? t.reward : 0), 0);
  const level = Math.floor(totalXP / 500) + 1;
  const levelProgress = ((totalXP % 500) / 500) * 100;

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'questions': return <BookOpen size={18} />;
      case 'correct': return <CheckCircle size={18} />;
      case 'time': return <Clock size={18} />;
      case 'streak': return <Zap size={18} />;
      default: return <Target size={18} />;
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">每日目标</h2>
                <p className="text-xs text-white/80">完成任务获取经验值</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg">
                <Settings size={18} className="text-white" />
              </button>
              <button onClick={onClose} className="p-2 rounded-lg">
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Level & XP */}
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-white", "bg-gradient-to-br from-yellow-400 to-orange-500")}>
                {level}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">等级 {level}</p>
                <p className="text-xs text-gray-500">{totalXP} XP</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">下一级还需</p>
              <p className="text-sm font-medium text-gray-900">{500 - (totalXP % 500)} XP</p>
            </div>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-gray-200">
            <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 duration-500" style={{ width: `${levelProgress}%` }} />
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 border-b border-gray-100 bg-white">
            <h3 className="text-sm font-medium mb-3 text-gray-900">目标设置</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">每日答题</span>
                <input type="number" value={goals.dailyQuestions} onChange={(e) => setGoals({ ...goals, dailyQuestions: parseInt(e.target.value) || 0 })} className="w-20 px-2 py-1 rounded text-sm text-center bg-gray-100 text-gray-900" min={1} max={100} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">每日正确</span>
                <input type="number" value={goals.dailyCorrect} onChange={(e) => setGoals({ ...goals, dailyCorrect: parseInt(e.target.value) || 0 })} className="w-20 px-2 py-1 rounded text-sm text-center bg-gray-100 text-gray-900" min={1} max={100} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">每日时长(分钟)</span>
                <input type="number" value={goals.dailyTime} onChange={(e) => setGoals({ ...goals, dailyTime: parseInt(e.target.value) || 0 })} className="w-20 px-2 py-1 rounded text-sm text-center bg-gray-100 text-gray-900" min={5} max={240} />
              </div>
            </div>
            <Button size="sm" className="w-full mt-3" onClick={handleSaveGoals}>保存设置</Button>
          </div>
        )}

        {/* Progress Overview */}
        <div className="px-4 py-2 border-b flex items-center justify-between border-gray-100">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <CheckCircle size={16} className="text-green-500" />
              <span className="text-sm text-gray-600">{completedCount}/{tasks.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <Gift size={16} className="text-purple-500" />
              <span className="text-sm text-gray-600">+{totalReward} XP</span>
            </div>
          </div>
          {completedCount === tasks.length && (
            <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-600">🎉 全部完成!</span>
          )}
        </div>

        {/* Tasks List */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          {tasks.map(task => (
            <div key={task.id} className={cn("p-4 rounded-xl border", task.completed ? "border-green-200 bg-green-50" : "border-gray-200 bg-white")}>
              <div className="flex items-start gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", task.completed ? "bg-green-500 text-white" : "bg-gray-100 text-gray-500")}>
                  {task.completed ? <CheckCircle size={20} /> : getTaskIcon(task.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className={cn("font-medium", task.completed ? "text-green-600" : "text-gray-900")}>{task.title}</h4>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", task.completed ? "bg-green-100 text-green-600" : "bg-purple-100 text-purple-600")}>+{task.reward} XP</span>
                  </div>
                  <p className="text-sm mb-2 text-gray-500">{task.description}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full overflow-hidden bg-gray-200">
                      <div className={cn("h-full duration-300", task.completed ? "bg-green-500" : "bg-gradient-to-r from-indigo-500 to-purple-500")} style={{ width: `${Math.min((task.current / task.target) * 100, 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium min-w-[50px] text-right text-gray-500">{task.current}/{task.target}</span>
                  </div>
                </div>
                {task.completed && task.reward > 0 && (
                  <button onClick={() => handleClaimReward(task.id)} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity animate-pulse">
                    领取
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-center text-gray-400">💡 每日任务在凌晨重置，坚持学习获取更多奖励！</p>
        </div>

        {/* Reward Animation */}
        {showReward && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="animate-bounce bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-3 rounded-2xl shadow-2xl">
              <div className="flex items-center gap-2">
                <Trophy className="w-6 h-6" />
                <span className="text-lg font-bold">+{showReward.xp} XP</span>
              </div>
              <p className="text-sm text-center opacity-90">{showReward.task}</p>
            </div>
          </div>
        )}
      </div>
    </AnimatedModal>
  );
}

export { dailyTasksStorage };
