/**
 * 学习分享组件
 * 支持生成学习成绩卡片并分享
 */
import { useState, useEffect, useRef } from 'react';
import {
  X,
  Share2,
  Download,
  Copy,
  Check,
  Trophy,
  Target,
  Flame,
  Clock,
  Star,
  Award
} from 'lucide-react';
import Button from './ui/Button';
import AnimatedModal from './ui/AnimatedModal';
import { cn } from '../lib/utils';

interface ShareStats {
  totalQuestions: number;
  correctRate: number;
  studyDays: number;
  streak: number;
  totalTime: number;
  level: number;
  achievements: number;
}

interface StudyShareProps {
  isOpen: boolean;
  onClose: () => void;
}

// 获取学习统计
const getShareStats = (): ShareStats => {
  // 从localStorage获取各种数据
  const calendarData = localStorage.getItem('learning-calendar');
  const records = calendarData ? JSON.parse(calendarData) : {};

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

  // 计算连续天数
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const record = records[dateStr];
    if (record && (record.questionsCount > 0 || record.checkedIn)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  // 获取XP和等级
  const totalXp = parseInt(localStorage.getItem('total-xp') || '0');
  const level = Math.floor(totalXp / 1000) + 1;

  // 获取成就数量
  const achievementsData = localStorage.getItem('achievements-unlocked');
  const achievements = achievementsData ? JSON.parse(achievementsData).length : 0;

  return {
    totalQuestions,
    correctRate: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    studyDays,
    streak,
    totalTime,
    level,
    achievements,
  };
};

const cardThemes = [
  { id: 'blue', name: '深海蓝', gradient: 'from-blue-600 to-cyan-500', bg: 'bg-blue-900' },
  { id: 'purple', name: '星空紫', gradient: 'from-purple-600 to-pink-500', bg: 'bg-purple-900' },
  { id: 'green', name: '森林绿', gradient: 'from-green-600 to-teal-500', bg: 'bg-green-900' },
  { id: 'orange', name: '日落橙', gradient: 'from-orange-500 to-red-500', bg: 'bg-orange-900' },
  { id: 'dark', name: '暗夜黑', gradient: 'from-gray-700 to-gray-900', bg: 'bg-gray-900' },
];

export default function StudyShare({ isOpen, onClose }: StudyShareProps) {
  const [stats, setStats] = useState<ShareStats | null>(null);
  const [selectedTheme, setSelectedTheme] = useState(cardThemes[0]);
  const [copied, setCopied] = useState(false);
  const [nickname, setNickname] = useState('学习者');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStats(getShareStats());
      const savedNickname = localStorage.getItem('user-nickname');
      if (savedNickname) setNickname(savedNickname);
    }
  }, [isOpen]);

  const handleSaveNickname = () => {
    localStorage.setItem('user-nickname', nickname);
  };

  const handleCopyStats = () => {
    if (!stats) return;

    const text = `📚 我的学习成绩单
━━━━━━━━━━━━━━━
🎯 总答题: ${stats.totalQuestions} 题
✅ 正确率: ${stats.correctRate}%
📅 学习天数: ${stats.studyDays} 天
🔥 连续打卡: ${stats.streak} 天
⏱️ 学习时长: ${Math.round(stats.totalTime / 60)} 小时
🏆 等级: Lv.${stats.level}
🎖️ 成就: ${stats.achievements} 个
━━━━━━━━━━━━━━━
来自「智能题库」 自适应学习系统`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadCard = async () => {
    if (!cardRef.current) return;

    try {
      // 使用canvas绘制卡片
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 400;
      canvas.height = 500;

      // 绘制背景
      const gradient = ctx.createLinearGradient(0, 0, 400, 500);
      if (selectedTheme.id === 'blue') {
        gradient.addColorStop(0, '#2563eb');
        gradient.addColorStop(1, '#06b6d4');
      } else if (selectedTheme.id === 'purple') {
        gradient.addColorStop(0, '#9333ea');
        gradient.addColorStop(1, '#ec4899');
      } else if (selectedTheme.id === 'green') {
        gradient.addColorStop(0, '#16a34a');
        gradient.addColorStop(1, '#14b8a6');
      } else if (selectedTheme.id === 'orange') {
        gradient.addColorStop(0, '#f97316');
        gradient.addColorStop(1, '#ef4444');
      } else {
        gradient.addColorStop(0, '#374151');
        gradient.addColorStop(1, '#111827');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 400, 500);

      // 绘制文字
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('📚 学习成绩单', 200, 50);

      ctx.font = '18px sans-serif';
      ctx.fillText(nickname, 200, 90);

      if (stats) {
        ctx.textAlign = 'left';
        ctx.font = '16px sans-serif';
        const items = [
          `🎯 总答题: ${stats.totalQuestions} 题`,
          `✅ 正确率: ${stats.correctRate}%`,
          `📅 学习天数: ${stats.studyDays} 天`,
          `🔥 连续打卡: ${stats.streak} 天`,
          `⏱️ 学习时长: ${Math.round(stats.totalTime / 60)} 小时`,
          `🏆 等级: Lv.${stats.level}`,
          `🎖️ 成就: ${stats.achievements} 个`,
        ];

        items.forEach((item, index) => {
          ctx.fillText(item, 80, 150 + index * 40);
        });
      }

      ctx.textAlign = 'center';
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('智能题库 - 自适应学习系统', 200, 470);

      // 下载
      const link = document.createElement('a');
      link.download = `学习成绩单_${new Date().toLocaleDateString()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to download card:', error);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b flex-shrink-0 border-gray-200 bg-gradient-to-r from-pink-500 to-rose-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Share2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">分享成绩</h2>
                <p className="text-xs text-white/80">展示你的学习成果</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg">
              <X size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Nickname */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block text-gray-600">昵称</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={handleSaveNickname}
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-900"
                placeholder="输入你的昵称"
              />
            </div>
          </div>

          {/* Theme Selection */}
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block text-gray-600">卡片主题</label>
            <div className="flex gap-2">
              {cardThemes.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme)}
                  className={cn(
                    "w-10 h-10 rounded-lg bg-gradient-to-br",
                    theme.gradient,
                    selectedTheme.id === theme.id
                      ? "ring-2 ring-offset-2 ring-pink-500"
                      : "opacity-70 hover:opacity-100"
                  )}
                  title={theme.name}
                />
              ))}
            </div>
          </div>

          {/* Preview Card */}
          <div
            ref={cardRef}
            className={cn(
              "rounded-2xl p-6 bg-gradient-to-br text-white",
              selectedTheme.gradient
            )}
          >
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-1">📚 学习成绩单</h3>
              <p className="text-white/80">{nickname}</p>
            </div>

            {stats && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white/10 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Target size={18} />
                    <span>总答题</span>
                  </div>
                  <span className="font-bold">{stats.totalQuestions} 题</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white/10 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Check size={18} />
                    <span>正确率</span>
                  </div>
                  <span className="font-bold">{stats.correctRate}%</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white/10 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Flame size={18} />
                    <span>连续打卡</span>
                  </div>
                  <span className="font-bold">{stats.streak} 天</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white/10 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Clock size={18} />
                    <span>学习时长</span>
                  </div>
                  <span className="font-bold">{Math.round(stats.totalTime / 60)}h</span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="text-center p-2 bg-white/10 rounded-xl">
                    <Trophy size={20} className="mx-auto mb-1" />
                    <div className="text-lg font-bold">Lv.{stats.level}</div>
                    <div className="text-xs text-white/70">等级</div>
                  </div>
                  <div className="text-center p-2 bg-white/10 rounded-xl">
                    <Award size={20} className="mx-auto mb-1" />
                    <div className="text-lg font-bold">{stats.achievements}</div>
                    <div className="text-xs text-white/70">成就</div>
                  </div>
                  <div className="text-center p-2 bg-white/10 rounded-xl">
                    <Star size={20} className="mx-auto mb-1" />
                    <div className="text-lg font-bold">{stats.studyDays}</div>
                    <div className="text-xs text-white/70">学习天</div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-white/20 text-center">
              <p className="text-xs text-white/60">智能题库 - 自适应学习系统</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-2 border-gray-100">
          <Button
            variant="secondary"
            className="flex-1"
            leftIcon={copied ? <Check size={16} /> : <Copy size={16} />}
            onClick={handleCopyStats}
          >
            {copied ? '已复制' : '复制文字'}
          </Button>
          <Button
            className="flex-1"
            leftIcon={<Download size={16} />}
            onClick={handleDownloadCard}
          >
            保存图片
          </Button>
        </div>
      </div>
    </AnimatedModal>
  );
}
