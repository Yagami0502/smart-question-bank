/**
 * 模拟考试设置组件
 */
import { useState } from 'react';
import { Clock, FileText, Zap, Flame, Skull, AlertTriangle } from 'lucide-react';
import { Modal, ModalContent, ModalFooter } from './ui/Modal';
import Button from './ui/Button';
import { cn } from '../lib/utils';

export interface ExamConfig {
  questionCount: number;
  timeLimit: number;
  shuffleOptions: boolean;
  shuffleQuestions: boolean;
  showProgress: boolean;
  allowSkip: boolean;
  convertToMulti: boolean;
  multiRatio: number;
}

const PRESETS: Record<string, { name: string; icon: any; color: string; config: ExamConfig; description: string }> = {
  easy: {
    name: '简单',
    icon: Zap,
    color: 'text-green-500 bg-green-50 border-green-200',
    description: '50题，无时间限制，可跳题',
    config: {
      questionCount: 50,
      timeLimit: 0,
      shuffleOptions: false,
      shuffleQuestions: true,
      showProgress: true,
      allowSkip: true,
      convertToMulti: false,
      multiRatio: 0,
    },
  },
  normal: {
    name: '普通',
    icon: FileText,
    color: 'text-blue-500 bg-blue-50 border-blue-200',
    description: '100题，90分钟，可跳题',
    config: {
      questionCount: 100,
      timeLimit: 90,
      shuffleOptions: false,
      shuffleQuestions: true,
      showProgress: true,
      allowSkip: true,
      convertToMulti: false,
      multiRatio: 0,
    },
  },
  hard: {
    name: '困难',
    icon: Flame,
    color: 'text-orange-500 bg-orange-50 border-orange-200',
    description: '100题，60分钟，打乱选项，15%多选',
    config: {
      questionCount: 100,
      timeLimit: 60,
      shuffleOptions: true,
      shuffleQuestions: true,
      showProgress: true,
      allowSkip: true,
      convertToMulti: true,
      multiRatio: 15,
    },
  },
  hell: {
    name: '地狱',
    icon: Skull,
    color: 'text-red-500 bg-red-50 border-red-200',
    description: '150题，60分钟，打乱选项，30%多选，不可跳题',
    config: {
      questionCount: 150,
      timeLimit: 60,
      shuffleOptions: true,
      shuffleQuestions: true,
      showProgress: false,
      allowSkip: false,
      convertToMulti: true,
      multiRatio: 30,
    },
  },
};

interface ExamSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: ExamConfig) => void;
  maxQuestions?: number;
  deckId?: string;
}

export default function ExamSettings({ isOpen, onClose, onStart, maxQuestions = 500, deckId: _deckId }: ExamSettingsProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('normal');
  const [customMode, setCustomMode] = useState(false);
  const [config, setConfig] = useState<ExamConfig>(PRESETS.normal.config);

  const handlePresetSelect = (presetKey: string) => {
    setSelectedPreset(presetKey);
    setCustomMode(false);
    setConfig({ ...PRESETS[presetKey].config });
  };

  const handleCustomChange = (key: keyof ExamConfig, value: any) => {
    setCustomMode(true);
    setSelectedPreset('');
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleStart = () => {
    const finalConfig = {
      ...config,
      questionCount: Math.min(config.questionCount, maxQuestions),
    };
    onStart(finalConfig);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="模拟考试设置" size="lg">
      <ModalContent>
        <div className="space-y-6">
          {/* 难度预设 */}
          <div>
            <label className="block text-sm font-medium mb-3 text-gray-700">选择难度</label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(PRESETS).map(([key, preset]) => {
                const Icon = preset.icon;
                const isSelected = selectedPreset === key && !customMode;
                return (
                  <div
                    key={key}
                    onClick={() => handlePresetSelect(key)}
                    className={cn(
                      'p-3 border-2 rounded-xl cursor-pointer',
                      isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', preset.color)}>
                        <Icon size={18} />
                      </div>
                      <span className="font-medium text-gray-900">{preset.name}</span>
                    </div>
                    <p className="text-xs text-gray-500">{preset.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 自定义设置 */}
          <div className="border-t pt-4 border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">自定义设置</label>
              {customMode && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">已自定义</span>
              )}
            </div>

            <div className="space-y-4">
              {/* 题目数量 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700">题目数量</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={maxQuestions}
                    value={config.questionCount}
                    onChange={(e) =>
                      handleCustomChange(
                        'questionCount',
                        Math.max(10, Math.min(maxQuestions, parseInt(e.target.value) || 50))
                      )
                    }
                    className="w-20 px-2 py-1 border rounded-lg text-sm text-center bg-white text-gray-900 border-gray-300"
                  />
                  <span className="text-xs text-gray-400">/ {maxQuestions}</span>
                </div>
              </div>

              {/* 时间限制 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700">时间限制</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={180}
                    value={config.timeLimit}
                    onChange={(e) =>
                      handleCustomChange('timeLimit', Math.max(0, parseInt(e.target.value) || 0))
                    }
                    className="w-20 px-2 py-1 border rounded-lg text-sm text-center bg-white text-gray-900 border-gray-300"
                  />
                  <span className="text-xs text-gray-400">分钟 (0=无限)</span>
                </div>
              </div>

              {/* 开关选项 */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.shuffleOptions}
                    onChange={(e) => handleCustomChange('shuffleOptions', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">打乱选项</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.shuffleQuestions}
                    onChange={(e) => handleCustomChange('shuffleQuestions', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">打乱题序</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showProgress}
                    onChange={(e) => handleCustomChange('showProgress', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">显示进度</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.allowSkip}
                    onChange={(e) => handleCustomChange('allowSkip', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">允许跳题</span>
                </label>
              </div>

              {/* 多选题转换 */}
              <div className="p-3 rounded-lg bg-gray-50">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={config.convertToMulti}
                    onChange={(e) => handleCustomChange('convertToMulti', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-900">转换部分单选为多选</span>
                </label>
                {config.convertToMulti && (
                  <div className="flex items-center gap-2 ml-6">
                    <span className="text-xs text-gray-500">多选比例:</span>
                    <input
                      type="range"
                      min={5}
                      max={50}
                      value={config.multiRatio}
                      onChange={(e) => handleCustomChange('multiRatio', parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-10 text-gray-900">{config.multiRatio}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 提示信息 */}
          {config.timeLimit > 0 && config.questionCount > 100 && (
            <div className="flex items-start gap-2 p-3 border rounded-lg bg-yellow-50 border-yellow-200">
              <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-700">
                {config.questionCount}题在{config.timeLimit}分钟内完成，平均每题只有
                {(config.timeLimit * 60 / config.questionCount).toFixed(0)}秒
              </p>
            </div>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button onClick={handleStart}>开始考试</Button>
      </ModalFooter>
    </Modal>
  );
}
