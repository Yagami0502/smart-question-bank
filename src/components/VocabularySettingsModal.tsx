/**
 * 词库设置模态框 - 配置学习参数和个性化选项
 */
import { useState, useEffect } from 'react';
import {
  Volume2,
  Settings,
  Target,
  Eye,
  Music,
  Save,
  X,
  RotateCcw,
} from 'lucide-react';
import Button from './ui/Button';
import { dialog } from './ui/ConfirmDialog';
import { speechService } from '../lib/speech-service';
import { keyboardSound, type SoundType } from '../lib/keyboard-sound';
import { vocabularySettingsOperations } from '../lib/vocabulary-db';
import type { VocabularySettings } from '../types/vocabulary';
import { defaultVocabularySettings } from '../types/vocabulary';
import { cn } from '../lib/utils';

interface VocabularySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VocabularySettingsModal({ isOpen, onClose }: VocabularySettingsModalProps) {
  const [settings, setSettings] = useState<VocabularySettings>(defaultVocabularySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 加载设置
  useEffect(() => {
    if (!isOpen) return;
    
    const loadSettings = async () => {
      try {
        setLoading(true);
        const saved = await vocabularySettingsOperations.get();
        setSettings(saved);
      } catch (error) {
        console.error('加载设置失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [isOpen]);

  // 保存设置
  const handleSave = async () => {
    try {
      setSaving(true);
      await vocabularySettingsOperations.save(settings);
      
      speechService.setConfig({
        voiceType: settings.voiceType,
        rate: settings.voiceRate,
      });
      
      dialog.success('设置已保存');
      onClose();
    } catch (error) {
      console.error('保存设置失败:', error);
      dialog.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 重置为默认
  const handleReset = async () => {
    const confirmed = await dialog.confirm('确定要恢复默认设置吗？', { title: '恢复默认' });
    if (confirmed) {
      setSettings(defaultVocabularySettings);
    }
  };

  // 测试发音
  const testVoice = () => {
    speechService.speak('Hello, this is a test.', {
      voiceType: settings.voiceType,
      rate: settings.voiceRate,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-500/20 flex items-center justify-center">
              <Settings size={18} className="text-gray-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">词库设置</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {/* 发音设置 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  <Volume2 size={14} />
                  <span>发音设置</span>
                </div>
                
                <div className="space-y-3 pl-1">
                  {/* 自动播放 */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">自动播放发音</span>
                    <button
                      onClick={() => setSettings(s => ({ ...s, autoPlayAudio: !s.autoPlayAudio }))}
                      className={cn(
                        "w-11 h-6 rounded-full transition-colors relative",
                        settings.autoPlayAudio ? "bg-primary-500" : "bg-gray-300"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform",
                        settings.autoPlayAudio ? "translate-x-5" : "translate-x-0.5"
                      )} />
                    </button>
                  </div>

                  {/* 发音类型 */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">发音类型</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setSettings(s => ({ ...s, voiceType: 'us' }))}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-sm transition-colors",
                          settings.voiceType === 'us' ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-600"
                        )}
                      >
                        🇺🇸 美音
                      </button>
                      <button
                        onClick={() => setSettings(s => ({ ...s, voiceType: 'uk' }))}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-sm transition-colors",
                          settings.voiceType === 'uk' ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-600"
                        )}
                      >
                        🇬🇧 英音
                      </button>
                    </div>
                  </div>

                  {/* 语速 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700">语速</span>
                      <span className="text-sm text-gray-500">{settings.voiceRate.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.1"
                      value={settings.voiceRate}
                      onChange={(e) => setSettings(s => ({ ...s, voiceRate: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={testVoice}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    测试发音
                  </button>
                </div>
              </div>

              {/* 学习设置 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  <Target size={14} />
                  <span>学习设置</span>
                </div>
                
                <div className="space-y-3 pl-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700">每日新词</span>
                      <span className="text-sm text-primary-600 font-medium">{settings.dailyNewWords} 个</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="5"
                      value={settings.dailyNewWords}
                      onChange={(e) => setSettings(s => ({ ...s, dailyNewWords: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700">每日复习</span>
                      <span className="text-sm text-primary-600 font-medium">{settings.dailyReviewWords} 个</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="200"
                      step="10"
                      value={settings.dailyReviewWords}
                      onChange={(e) => setSettings(s => ({ ...s, dailyReviewWords: parseInt(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* 显示设置 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  <Eye size={14} />
                  <span>显示设置</span>
                </div>
                
                <div className="space-y-3 pl-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">显示音标</span>
                    <button
                      onClick={() => setSettings(s => ({ ...s, showPhonetic: !s.showPhonetic }))}
                      className={cn(
                        "w-11 h-6 rounded-full transition-colors relative",
                        settings.showPhonetic ? "bg-primary-500" : "bg-gray-300"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform",
                        settings.showPhonetic ? "translate-x-5" : "translate-x-0.5"
                      )} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">显示例句</span>
                    <button
                      onClick={() => setSettings(s => ({ ...s, showExample: !s.showExample }))}
                      className={cn(
                        "w-11 h-6 rounded-full transition-colors relative",
                        settings.showExample ? "bg-primary-500" : "bg-gray-300"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform",
                        settings.showExample ? "translate-x-5" : "translate-x-0.5"
                      )} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 键盘音效 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  <Music size={14} />
                  <span>键盘音效</span>
                </div>
                
                <div className="space-y-3 pl-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">启用音效</span>
                    <button
                      onClick={() => setSettings(s => ({ ...s, keyboardSound: !s.keyboardSound }))}
                      className={cn(
                        "w-11 h-6 rounded-full transition-colors relative",
                        settings.keyboardSound ? "bg-primary-500" : "bg-gray-300"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform",
                        settings.keyboardSound ? "translate-x-5" : "translate-x-0.5"
                      )} />
                    </button>
                  </div>

                  {settings.keyboardSound && (
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { value: 'mechanical', label: '机械' },
                        { value: 'typewriter', label: '打字机' },
                        { value: 'soft', label: '轻柔' },
                        { value: 'none', label: '无' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setSettings(s => ({ ...s, keyboardSoundType: opt.value as any }));
                            // 切换时播放预览音效
                            keyboardSound.previewSound(opt.value as SoundType);
                          }}
                          className={cn(
                            "px-2 py-1.5 rounded-lg text-xs font-medium transition-colors",
                            settings.keyboardSoundType === opt.value
                              ? "bg-primary-500 text-white"
                              : "bg-gray-100 text-gray-600"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw size={14} />} onClick={handleReset}>
            恢复默认
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button leftIcon={<Save size={14} />} onClick={handleSave} disabled={saving || loading}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
