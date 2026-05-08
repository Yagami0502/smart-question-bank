/**
 * 番茄钟计时器组件
 * 帮助用户专注学习，使用25分钟工作+5分钟休息的番茄工作法
 */
import { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain, X, Settings, Volume2, VolumeX } from 'lucide-react';
import AnimatedModal from './ui/AnimatedModal';
import Button from './ui/Button';
import { cn } from '../lib/utils';

interface PomodoroTimerProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionComplete?: (type: 'work' | 'break') => void;
}

type TimerMode = 'work' | 'shortBreak' | 'longBreak';

const TIMER_SETTINGS = {
  work: { duration: 25 * 60, label: '专注学习', color: 'from-red-500 to-orange-500', bgColor: 'bg-red-50' },
  shortBreak: { duration: 5 * 60, label: '短休息', color: 'from-green-500 to-emerald-500', bgColor: 'bg-green-50' },
  longBreak: { duration: 15 * 60, label: '长休息', color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-50' },
};

export default function PomodoroTimer({ isOpen, onClose, onSessionComplete }: PomodoroTimerProps) {
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(TIMER_SETTINGS.work.duration);
  const [isRunning, setIsRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // 自定义时间设置
  const [customSettings, setCustomSettings] = useState({
    work: 25,
    shortBreak: 5,
    longBreak: 15,
  });

  const currentSettings = TIMER_SETTINGS[mode];

  // 播放提示音
  const playSound = useCallback(() => {
    if (soundEnabled) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    }
  }, [soundEnabled]);

  // 计时器逻辑
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      playSound();
      setIsRunning(false);

      if (mode === 'work') {
        setCompletedPomodoros(prev => prev + 1);
        onSessionComplete?.('work');

        if ((completedPomodoros + 1) % 4 === 0) {
          setMode('longBreak');
          setTimeLeft(customSettings.longBreak * 60);
        } else {
          setMode('shortBreak');
          setTimeLeft(customSettings.shortBreak * 60);
        }
      } else {
        onSessionComplete?.('break');
        setMode('work');
        setTimeLeft(customSettings.work * 60);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft, mode, completedPomodoros, customSettings, playSound, onSessionComplete]);

  // 切换模式
  const switchMode = (newMode: TimerMode) => {
    setMode(newMode);
    setIsRunning(false);
    setTimeLeft(
      newMode === 'work'
        ? customSettings.work * 60
        : newMode === 'shortBreak'
        ? customSettings.shortBreak * 60
        : customSettings.longBreak * 60
    );
  };

  // 重置计时器
  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(
      mode === 'work'
        ? customSettings.work * 60
        : mode === 'shortBreak'
        ? customSettings.shortBreak * 60
        : customSettings.longBreak * 60
    );
  };

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 计算进度
  const totalTime =
    mode === 'work'
      ? customSettings.work * 60
      : mode === 'shortBreak'
      ? customSettings.shortBreak * 60
      : customSettings.longBreak * 60;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div
        className={cn(
          "rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white",
          currentSettings.bgColor
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200/50">
          <h2 className="text-lg font-bold text-gray-900">番茄钟</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg"
              title={soundEnabled ? '关闭提示音' : '开启提示音'}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg">
              <Settings size={18} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex p-2 gap-2 bg-white/50">
          <button
            onClick={() => switchMode('work')}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-sm font-medium',
              mode === 'work'
                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md'
                : 'text-gray-600'
            )}
          >
            <Brain size={14} className="inline mr-1" />
            专注
          </button>
          <button
            onClick={() => switchMode('shortBreak')}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-sm font-medium',
              mode === 'shortBreak'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md'
                : 'text-gray-600'
            )}
          >
            <Coffee size={14} className="inline mr-1" />
            短休息
          </button>
          <button
            onClick={() => switchMode('longBreak')}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-sm font-medium',
              mode === 'longBreak'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                : 'text-gray-600'
            )}
          >
            <Coffee size={14} className="inline mr-1" />
            长休息
          </button>
        </div>

        {/* Timer Display */}
        <div className="p-8 text-center">
          {/* Progress Ring */}
          <div className="relative w-48 h-48 mx-auto mb-6">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="88"
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="8"
              />
              <circle
                cx="96"
                cy="96"
                r="88"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 88}
                strokeDashoffset={2 * Math.PI * 88 * (1 - progress / 100)}
                className="duration-1000"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop
                    offset="0%"
                    stopColor={mode === 'work' ? '#ef4444' : mode === 'shortBreak' ? '#22c55e' : '#3b82f6'}
                  />
                  <stop
                    offset="100%"
                    stopColor={mode === 'work' ? '#f97316' : mode === 'shortBreak' ? '#10b981' : '#06b6d4'}
                  />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-5xl font-bold text-gray-900", isRunning && "timer-active rounded-full")}>
                {formatTime(timeLeft)}
              </span>
              <span className="text-sm mt-2 text-gray-500">{currentSettings.label}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={resetTimer}
              className="p-3 rounded-full shadow-md bg-white/80"
              title="重置"
            >
              <RotateCcw size={20} className="text-gray-600" />
            </button>
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={cn(
                "p-5 rounded-full shadow-lg transform hover:scale-105",
                "bg-gradient-to-r",
                currentSettings.color,
                "text-white"
              )}
            >
              {isRunning ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
            </button>
            <div className="p-3 rounded-full shadow-md bg-white/80">
              <span className="text-sm font-bold text-gray-700">{completedPomodoros}</span>
            </div>
          </div>

          {/* Pomodoro Count */}
          <div className="mt-6 flex items-center justify-center gap-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-3 h-3 rounded-full",
                  i < (completedPomodoros % 4)
                    ? "bg-gradient-to-r from-red-500 to-orange-500"
                    : "bg-gray-200"
                )}
              />
            ))}
            <span className="text-xs ml-2 text-gray-500">
              第 {Math.floor(completedPomodoros / 4) + 1} 轮
            </span>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 border-t border-gray-200/50 bg-white/80">
            <h3 className="text-sm font-medium mb-3 text-gray-700">时间设置（分钟）</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500">专注</label>
                <input
                  type="number"
                  value={customSettings.work}
                  onChange={(e) =>
                    setCustomSettings(prev => ({ ...prev, work: parseInt(e.target.value) || 25 }))
                  }
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-center text-sm bg-white text-gray-900 border-gray-300"
                  min={1}
                  max={60}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">短休息</label>
                <input
                  type="number"
                  value={customSettings.shortBreak}
                  onChange={(e) =>
                    setCustomSettings(prev => ({ ...prev, shortBreak: parseInt(e.target.value) || 5 }))
                  }
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-center text-sm bg-white text-gray-900 border-gray-300"
                  min={1}
                  max={30}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">长休息</label>
                <input
                  type="number"
                  value={customSettings.longBreak}
                  onChange={(e) =>
                    setCustomSettings(prev => ({ ...prev, longBreak: parseInt(e.target.value) || 15 }))
                  }
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-center text-sm bg-white text-gray-900 border-gray-300"
                  min={1}
                  max={60}
                />
              </div>
            </div>
            <Button
              size="sm"
              className="w-full mt-3"
              onClick={() => {
                resetTimer();
                setShowSettings(false);
              }}
            >
              应用设置
            </Button>
          </div>
        )}

        {/* Tips */}
        <div className="p-4 border-t bg-white/50 border-gray-200/50">
          <p className="text-xs text-center text-gray-500">
            💡 专注25分钟，休息5分钟。每完成4个番茄钟，奖励自己15分钟长休息！
          </p>
        </div>
      </div>
    </AnimatedModal>
  );
}
