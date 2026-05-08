/**
 * 成就系统面板
 * 展示用户获得的成就和徽章
 */
import { useState, useEffect } from 'react';
import { Trophy, Star, Flame, Target, Zap, Award, Crown, Medal, BookOpen, Brain, Clock, TrendingUp, X, Lock } from 'lucide-react';
import AnimatedModal from './ui/AnimatedModal';
import { cn } from '../lib/utils';
import { db } from '../lib/database';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  requirement: number;
  type: 'questions' | 'streak' | 'accuracy' | 'combo' | 'time' | 'perfect';
  unlocked: boolean;
  progress: number;
}

interface AchievementsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACHIEVEMENTS_CONFIG: Omit<Achievement, 'unlocked' | 'progress'>[] = [
  { id: 'first_step', name: '初出茅庐', description: '完成第一道题目', icon: <Star size={24} />, color: 'from-yellow-400 to-yellow-600', requirement: 1, type: 'questions' },
  { id: 'apprentice', name: '学徒', description: '累计完成50道题目', icon: <BookOpen size={24} />, color: 'from-green-400 to-green-600', requirement: 50, type: 'questions' },
  { id: 'scholar', name: '学者', description: '累计完成200道题目', icon: <Brain size={24} />, color: 'from-blue-400 to-blue-600', requirement: 200, type: 'questions' },
  { id: 'master', name: '大师', description: '累计完成500道题目', icon: <Award size={24} />, color: 'from-purple-400 to-purple-600', requirement: 500, type: 'questions' },
  { id: 'grandmaster', name: '宗师', description: '累计完成1000道题目', icon: <Crown size={24} />, color: 'from-orange-400 to-red-600', requirement: 1000, type: 'questions' },
  { id: 'day_one', name: '新的开始', description: '连续学习1天', icon: <Flame size={24} />, color: 'from-red-400 to-red-600', requirement: 1, type: 'streak' },
  { id: 'week_warrior', name: '周末战士', description: '连续学习7天', icon: <Flame size={24} />, color: 'from-orange-400 to-orange-600', requirement: 7, type: 'streak' },
  { id: 'month_master', name: '月度达人', description: '连续学习30天', icon: <Flame size={24} />, color: 'from-yellow-400 to-orange-600', requirement: 30, type: 'streak' },
  { id: 'sharp_mind', name: '头脑敏锐', description: '单次练习正确率达到80%', icon: <Target size={24} />, color: 'from-cyan-400 to-cyan-600', requirement: 80, type: 'accuracy' },
  { id: 'precision', name: '精准打击', description: '单次练习正确率达到90%', icon: <Target size={24} />, color: 'from-teal-400 to-teal-600', requirement: 90, type: 'accuracy' },
  { id: 'perfectionist', name: '完美主义者', description: '单次练习正确率达到100%', icon: <Target size={24} />, color: 'from-emerald-400 to-emerald-600', requirement: 100, type: 'accuracy' },
  { id: 'combo_starter', name: '连击新手', description: '达成5连击', icon: <Zap size={24} />, color: 'from-violet-400 to-violet-600', requirement: 5, type: 'combo' },
  { id: 'combo_pro', name: '连击达人', description: '达成10连击', icon: <Zap size={24} />, color: 'from-fuchsia-400 to-fuchsia-600', requirement: 10, type: 'combo' },
  { id: 'combo_legend', name: '连击传奇', description: '达成20连击', icon: <Zap size={24} />, color: 'from-pink-400 to-pink-600', requirement: 20, type: 'combo' },
  { id: 'time_10', name: '十分钟热度', description: '累计学习10分钟', icon: <Clock size={24} />, color: 'from-slate-400 to-slate-600', requirement: 10, type: 'time' },
  { id: 'time_60', name: '一小时专注', description: '累计学习1小时', icon: <Clock size={24} />, color: 'from-gray-400 to-gray-600', requirement: 60, type: 'time' },
  { id: 'time_300', name: '五小时达人', description: '累计学习5小时', icon: <Clock size={24} />, color: 'from-zinc-400 to-zinc-600', requirement: 300, type: 'time' },
  { id: 'perfect_session', name: '完美一局', description: '完成一次全对的练习', icon: <Medal size={24} />, color: 'from-amber-400 to-amber-600', requirement: 1, type: 'perfect' },
  { id: 'perfect_streak', name: '连续完美', description: '连续3次完美练习', icon: <Trophy size={24} />, color: 'from-yellow-400 to-amber-600', requirement: 3, type: 'perfect' },
];

export default function AchievementsPanel({ isOpen, onClose }: AchievementsPanelProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState({
    totalQuestions: 0,
    streak: 0,
    maxCombo: 0,
    totalTime: 0,
    perfectSessions: 0,
  });

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = async () => {
    try {
      const cards = await db.cards.toArray();
      const totalQuestions = cards.reduce((sum, card) => sum + card.reps, 0);

      const savedStats = localStorage.getItem('learning-stats');
      const parsedStats = savedStats ? JSON.parse(savedStats) : {};

      const currentStats = {
        totalQuestions,
        streak: parsedStats.streak || 0,
        maxCombo: parsedStats.maxCombo || 0,
        totalTime: parsedStats.totalTime || 0,
        perfectSessions: parsedStats.perfectSessions || 0,
      };

      setStats(currentStats);

      const unlockedAchievements = ACHIEVEMENTS_CONFIG.map(achievement => {
        let progress = 0;
        let unlocked = false;

        switch (achievement.type) {
          case 'questions':
            progress = currentStats.totalQuestions;
            unlocked = progress >= achievement.requirement;
            break;
          case 'streak':
            progress = currentStats.streak;
            unlocked = progress >= achievement.requirement;
            break;
          case 'combo':
            progress = currentStats.maxCombo;
            unlocked = progress >= achievement.requirement;
            break;
          case 'time':
            progress = currentStats.totalTime;
            unlocked = progress >= achievement.requirement;
            break;
          case 'perfect':
            progress = currentStats.perfectSessions;
            unlocked = progress >= achievement.requirement;
            break;
          case 'accuracy':
            progress = parsedStats.maxAccuracy || 0;
            unlocked = progress >= achievement.requirement;
            break;
        }

        return {
          ...achievement,
          unlocked,
          progress: Math.min(progress, achievement.requirement),
        };
      });

      setAchievements(unlockedAchievements);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Trophy size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold">成就系统</h2>
                <p className="text-white/80 text-sm">已解锁 {unlockedCount}/{totalCount} 个成就</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg">
              <X size={20} />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-2 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full duration-500"
                style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4 p-4 border-b bg-gray-50 border-gray-200">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.totalQuestions}</p>
            <p className="text-xs text-gray-500">总答题数</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-500">{stats.streak}</p>
            <p className="text-xs text-gray-500">连续天数</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-500">{stats.maxCombo}</p>
            <p className="text-xs text-gray-500">最高连击</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-500">{stats.totalTime}m</p>
            <p className="text-xs text-gray-500">学习时长</p>
          </div>
        </div>

        {/* Achievements Grid */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={cn(
                  "relative p-4 rounded-xl border-2",
                  achievement.unlocked
                    ? "border-transparent bg-gradient-to-br shadow-md"
                    : "border-gray-200 bg-gray-50 opacity-60"
                )}
                style={
                  achievement.unlocked
                    ? {
                        background: `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))`,
                      }
                    : undefined
                }
              >
                {!achievement.unlocked && (
                  <div className="absolute top-2 right-2">
                    <Lock size={14} className="text-gray-400" />
                  </div>
                )}

                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center mb-3",
                    achievement.unlocked ? "bg-white/20 text-white" : "bg-gray-200 text-gray-400"
                  )}
                >
                  {achievement.icon}
                </div>

                <h3
                  className={cn(
                    "font-semibold text-sm mb-1",
                    achievement.unlocked ? "text-white" : "text-gray-700"
                  )}
                >
                  {achievement.name}
                </h3>

                <p
                  className={cn(
                    "text-xs mb-2",
                    achievement.unlocked ? "text-white/80" : "text-gray-500"
                  )}
                >
                  {achievement.description}
                </p>

                {!achievement.unlocked && (
                  <div className="mt-2">
                    <div className="h-1.5 rounded-full overflow-hidden bg-gray-200">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                        style={{ width: `${(achievement.progress / achievement.requirement) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs mt-1 text-gray-400">
                      {achievement.progress}/{achievement.requirement}
                    </p>
                  </div>
                )}

                {achievement.unlocked && (
                  <div className="absolute top-2 right-2">
                    <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center">
                      <Star size={12} className="text-white fill-white" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t text-center bg-gray-50 border-gray-200">
          <p className="text-sm text-gray-500">继续学习解锁更多成就！🎯</p>
        </div>
      </div>
    </AnimatedModal>
  );
}

export function saveLearningStats(stats: {
  streak?: number;
  maxCombo?: number;
  totalTime?: number;
  perfectSessions?: number;
  maxAccuracy?: number;
}) {
  const savedStats = localStorage.getItem('learning-stats');
  const currentStats = savedStats ? JSON.parse(savedStats) : {};

  const updatedStats = {
    ...currentStats,
    ...stats,
    maxCombo: Math.max(currentStats.maxCombo || 0, stats.maxCombo || 0),
    maxAccuracy: Math.max(currentStats.maxAccuracy || 0, stats.maxAccuracy || 0),
  };

  localStorage.setItem('learning-stats', JSON.stringify(updatedStats));
}
