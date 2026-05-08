/**
 * 词库设置页面 - 配置学习参数和个性化选项
 */
import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Volume2,
  Settings,
  Target,
  Eye,
  Music,
  Save,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { dialog } from '../components/ui/ConfirmDialog';
import { speechService } from '../lib/speech-service';
import { keyboardSound, type SoundType } from '../lib/keyboard-sound';
import { vocabularySettingsOperations } from '../lib/vocabulary-db';
import type { VocabularySettings } from '../types/vocabulary';
import { defaultVocabularySettings } from '../types/vocabulary';
import { cn } from '../lib/utils';

interface VocabularySettingsPageProps {
  onBack: () => void;
}

export default function VocabularySettingsPage({ onBack }: VocabularySettingsPageProps) {
  const [settings, setSettings] = useState<VocabularySettings>(defaultVocabularySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 加载设置
  useEffect(() => {
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
  }, []);

  // 保存设置
  const handleSave = async () => {
    try {
      setSaving(true);
      await vocabularySettingsOperations.save(settings);
      
      // 更新语音服务配置
      speechService.setConfig({
        voiceType: settings.voiceType,
        rate: settings.voiceRate,
      });
      
      dialog.success('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      dialog.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 重置为默认
  const handleReset = async () => {
    const confirmed = await dialog.confirm('确定要恢复默认设置吗？', {
      title: '恢复默认',
    });

    if (confirmed) {
      setSettings(defaultVocabularySettings);
      await vocabularySettingsOperations.save(defaultVocabularySettings);
      dialog.success('已恢复默认设置');
    }
  };

  // 测试发音
  const testVoice = () => {
    speechService.speak('Hello, this is a test.', {
      voiceType: settings.voiceType,
      rate: settings.voiceRate,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto fade-in">
      {/* 页面标题 */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft size={20} />
          <span>返回</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center">
            <Settings size={22} className="text-gray-600" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">词库设置</h1>
        </div>
      </div>

      <div className="space-y-6">
        {/* 发音设置 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Volume2 size={18} className="text-primary-600" />
              <h2 className="font-semibold text-gray-800">发音设置</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 自动播放 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">自动播放发音</div>
                <div className="text-sm text-gray-500">切换单词时自动播放</div>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, autoPlayAudio: !s.autoPlayAudio }))}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  settings.autoPlayAudio ? "bg-primary-500" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform",
                  settings.autoPlayAudio ? "translate-x-6" : "translate-x-0.5"
                )} />
              </button>
            </div>

            {/* 发音类型 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">发音类型</div>
                <div className="text-sm text-gray-500">选择美式或英式发音</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSettings(s => ({ ...s, voiceType: 'us' }))}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    settings.voiceType === 'us'
                      ? "bg-primary-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  🇺🇸 美音
                </button>
                <button
                  onClick={() => setSettings(s => ({ ...s, voiceType: 'uk' }))}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    settings.voiceType === 'uk'
                      ? "bg-primary-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  🇬🇧 英音
                </button>
              </div>
            </div>

            {/* 语速 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-gray-800">语速</div>
                <span className="text-sm text-gray-500">{settings.voiceRate.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={settings.voiceRate}
                onChange={(e) => setSettings(s => ({ ...s, voiceRate: parseFloat(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>慢</span>
                <span>正常</span>
                <span>快</span>
              </div>
            </div>

            {/* 测试发音 */}
            <Button variant="outline" size="sm" onClick={testVoice}>
              测试发音
            </Button>
          </CardContent>
        </Card>

        {/* 学习设置 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target size={18} className="text-green-600" />
              <h2 className="font-semibold text-gray-800">学习设置</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 每日新词 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-gray-800">每日新词数量</div>
                <span className="text-sm text-primary-600 font-medium">{settings.dailyNewWords} 个</span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={settings.dailyNewWords}
                onChange={(e) => setSettings(s => ({ ...s, dailyNewWords: parseInt(e.target.value) }))}
                className="w-full"
              />
            </div>

            {/* 每日复习 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-gray-800">每日复习数量</div>
                <span className="text-sm text-primary-600 font-medium">{settings.dailyReviewWords} 个</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={settings.dailyReviewWords}
                onChange={(e) => setSettings(s => ({ ...s, dailyReviewWords: parseInt(e.target.value) }))}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* 显示设置 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-blue-600" />
              <h2 className="font-semibold text-gray-800">显示设置</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 显示音标 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">显示音标</div>
                <div className="text-sm text-gray-500">在单词旁显示音标</div>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, showPhonetic: !s.showPhonetic }))}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  settings.showPhonetic ? "bg-primary-500" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform",
                  settings.showPhonetic ? "translate-x-6" : "translate-x-0.5"
                )} />
              </button>
            </div>

            {/* 显示例句 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">显示例句</div>
                <div className="text-sm text-gray-500">在答案中显示例句</div>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, showExample: !s.showExample }))}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  settings.showExample ? "bg-primary-500" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform",
                  settings.showExample ? "translate-x-6" : "translate-x-0.5"
                )} />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 键盘音效 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Music size={18} className="text-purple-600" />
              <h2 className="font-semibold text-gray-800">键盘音效</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 启用音效 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">启用键盘音效</div>
                <div className="text-sm text-gray-500">打字时播放音效</div>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, keyboardSound: !s.keyboardSound }))}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  settings.keyboardSound ? "bg-primary-500" : "bg-gray-300"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform",
                  settings.keyboardSound ? "translate-x-6" : "translate-x-0.5"
                )} />
              </button>
            </div>

            {/* 音效类型 */}
            {settings.keyboardSound && (
              <div>
                <div className="font-medium text-gray-800 mb-2">音效类型</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'mechanical', label: '机械键盘' },
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
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        settings.keyboardSoundType === opt.value
                          ? "bg-primary-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <div className="flex gap-3 pt-4">
          <Button variant="ghost" onClick={handleReset}>
            恢复默认
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            leftIcon={<Save size={16} />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存设置'}
          </Button>
        </div>
      </div>
    </div>
  );
}
