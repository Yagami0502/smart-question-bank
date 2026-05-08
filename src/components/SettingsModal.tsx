/**
 * 个人设置模态框
 * 双栏布局：左侧导航 + 右侧内容
 */

import { useState } from 'react';
import {
  X,
  Settings,
  Target,
  Zap,
  Bell,
  Bot,
  Lock,
  Database,
  Eye,
  EyeOff,
  Loader2,
  Globe,
  Cpu,
  Key,
} from 'lucide-react';
import AnimatedModal from './ui/AnimatedModal';
import Button from './ui/Button';
import { useAppStore } from '../stores/appStore';
import { cn } from '../lib/utils';
import { dialog } from './ui/ConfirmDialog';
import { getUserAISettings, saveUserAISettings, type UserAISettings, type ConversionMode } from '../lib/ai-service';
import { getSessions, removeSession, removeOtherSessions, changePassword, type UserSession } from '../lib/auth';

type SettingsTab = 'learning' | 'algorithm' | 'notification' | 'ai' | 'security' | 'data';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'learning', label: '学习设置', icon: <Target size={18} /> },
  { id: 'algorithm', label: '算法设置', icon: <Zap size={18} /> },
  { id: 'notification', label: '通知设置', icon: <Bell size={18} /> },
  { id: 'ai', label: 'AI 设置', icon: <Bot size={18} /> },
  { id: 'security', label: '账号安全', icon: <Lock size={18} /> },
  { id: 'data', label: '数据管理', icon: <Database size={18} /> },
];

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('learning');
  const { settings, updateSettings } = useAppStore();

  // AI 设置状态
  const [aiSettings, setAISettings] = useState<UserAISettings>(() => getUserAISettings());
  const [aiSettingsSaved, setAISettingsSaved] = useState(false);

  // 本地设置状态
  const [localSettings, setLocalSettings] = useState({
    ...settings,
    notifications: true,
    soundEffects: true,
  });

  // 密码修改状态
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // 会话管理状态
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  if (!isOpen) return null;

  const handleToggle = (key: string, value: boolean) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    if (key in settings) {
      updateSettings({ [key]: value } as any);
    }
  };

  const handleNumberChange = (key: string, value: number) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    if (key in settings) {
      updateSettings({ [key]: value } as any);
    }
  };

  const handleAISettingsChange = (key: string, value: any) => {
    setAISettings(prev => {
      if (key === 'conversionMode') {
        return { ...prev, conversionMode: value as ConversionMode };
      }
      return { ...prev, aiConfig: { ...prev.aiConfig, [key]: value } };
    });
    setAISettingsSaved(false);
  };

  const handleSaveAISettings = () => {
    saveUserAISettings(aiSettings);
    setAISettingsSaved(true);
    setTimeout(() => setAISettingsSaved(false), 2000);
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (!oldPassword) { setPasswordError('请输入当前密码'); return; }
    if (!newPassword || newPassword.length < 6) { setPasswordError('新密码至少需要6位'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('两次输入的密码不一致'); return; }

    setIsChangingPassword(true);
    try {
      await changePassword(oldPassword, newPassword);
      setPasswordSuccess('密码修改成功');
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : '修改失败');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const data = await getSessions();
      setSessions(data);
    } catch { /* ignore */ }
    finally { setIsLoadingSessions(false); }
  };

  const handleRemoveSession = async (sessionId: string) => {
    const confirmed = await dialog.confirm('确定要移除此设备的登录吗？', { title: '移除设备' });
    if (!confirmed) return;
    try {
      await removeSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch { /* ignore */ }
  };

  const handleRemoveOtherSessions = async () => {
    const confirmed = await dialog.confirm('确定要移除所有其他设备的登录吗？', { title: '移除其他设备' });
    if (!confirmed) return;
    try {
      await removeOtherSessions();
      setSessions(prev => prev.slice(0, 1));
    } catch { /* ignore */ }
  };

  const handleExportData = () => {
    const data = { settings: localSettings, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindforge-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearCache = async () => {
    const confirmed = await dialog.confirm('确定要清除所有缓存数据吗？', { title: '清除缓存' });
    if (confirmed) {
      localStorage.removeItem('app-cache');
      dialog.success('缓存已清除', '清除缓存');
    }
  };

  // 开关组件
  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "w-11 h-6 rounded-full transition-colors relative",
        checked ? "bg-primary-500" : "bg-gray-300"
      )}
    >
      <div className={cn(
        "w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow",
        checked ? "translate-x-5" : "translate-x-0.5"
      )} />
    </button>
  );

  // 设置项组件
  const SettingItem = ({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1 pr-4">
        <p className="font-medium text-gray-800">{title}</p>
        {desc && <p className="text-sm text-gray-500 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'learning':
        return (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">学习设置</h3>
            <SettingItem title="每日新卡片数量" desc="每天学习的新题目数量">
              <input
                type="number"
                value={localSettings.dailyNewCards}
                onChange={(e) => handleNumberChange('dailyNewCards', parseInt(e.target.value) || 20)}
                className="w-20 px-3 py-1.5 rounded-lg border text-center bg-white border-gray-200"
                min={1} max={100}
              />
            </SettingItem>
            <SettingItem title="每日复习数量" desc="每天复习的最大题目数">
              <input
                type="number"
                value={localSettings.dailyReviews}
                onChange={(e) => handleNumberChange('dailyReviews', parseInt(e.target.value) || 100)}
                className="w-20 px-3 py-1.5 rounded-lg border text-center bg-white border-gray-200"
                min={10} max={500}
              />
            </SettingItem>
            <SettingItem title="显示计时器" desc="练习时显示用时计时器">
              <Toggle checked={localSettings.showTimer} onChange={(v) => handleToggle('showTimer', v)} />
            </SettingItem>
          </div>
        );

      case 'algorithm':
        return (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">算法设置</h3>
            <SettingItem title="错题权重倍数" desc="错题在强化模式中的权重">
              <input
                type="number"
                value={localSettings.errorWeightMultiplier}
                onChange={(e) => handleNumberChange('errorWeightMultiplier', parseFloat(e.target.value) || 2.0)}
                className="w-20 px-3 py-1.5 rounded-lg border text-center bg-white border-gray-200"
                min={1} max={5} step={0.5}
              />
            </SettingItem>
            <SettingItem title="衰减权重倍数" desc="久未复习题目的权重">
              <input
                type="number"
                value={localSettings.decayWeightMultiplier}
                onChange={(e) => handleNumberChange('decayWeightMultiplier', parseFloat(e.target.value) || 1.0)}
                className="w-20 px-3 py-1.5 rounded-lg border text-center bg-white border-gray-200"
                min={0.5} max={3} step={0.5}
              />
            </SettingItem>
          </div>
        );

      case 'notification':
        return (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">通知设置</h3>
            <SettingItem title="音效" desc="答题正确/错误的提示音">
              <Toggle checked={localSettings.soundEffects} onChange={(v) => handleToggle('soundEffects', v)} />
            </SettingItem>
            <SettingItem title="学习提醒" desc="每日学习时间提醒">
              <Toggle checked={localSettings.notifications} onChange={(v) => handleToggle('notifications', v)} />
            </SettingItem>
          </div>
        );

      case 'ai':
        return (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">AI 设置</h3>
            <div className="mb-4">
              <p className="font-medium text-gray-800 mb-2">单选转多选模式</p>
              <p className="text-sm text-gray-500 mb-3">模拟考试中将单选题转换为多选题的方式</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAISettingsChange('conversionMode', 'local')}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2",
                    aiSettings.conversionMode === 'local'
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-200 text-gray-600"
                  )}
                >
                  <Cpu size={18} /> 本地转换
                </button>
                <button
                  onClick={() => handleAISettingsChange('conversionMode', 'ai')}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2",
                    aiSettings.conversionMode === 'ai'
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-200 text-gray-600"
                  )}
                >
                  <Bot size={18} /> AI 转换
                </button>
              </div>
            </div>

            {aiSettings.conversionMode === 'ai' && (
              <div className="space-y-4 p-4 rounded-lg bg-gray-50">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-1 text-gray-700">
                    <Globe size={16} /> API 地址
                  </label>
                  <input
                    type="text"
                    value={aiSettings.aiConfig.baseUrl}
                    onChange={(e) => handleAISettingsChange('baseUrl', e.target.value)}
                    placeholder="https://api.openai.com"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-1 text-gray-700">
                    <Cpu size={16} /> 模型名称
                  </label>
                  <input
                    type="text"
                    value={aiSettings.aiConfig.model}
                    onChange={(e) => handleAISettingsChange('model', e.target.value)}
                    placeholder="gpt-3.5-turbo"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-1 text-gray-700">
                    <Key size={16} /> API Key
                  </label>
                  <input
                    type="password"
                    value={aiSettings.aiConfig.apiKey}
                    onChange={(e) => handleAISettingsChange('apiKey', e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  />
                </div>
              </div>
            )}

            <Button onClick={handleSaveAISettings} className="w-full mt-4">
              {aiSettingsSaved ? '✓ 已保存' : '保存设置'}
            </Button>
          </div>
        );

      case 'security':
        return (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">账号安全</h3>
            
            {/* 修改密码 */}
            <div className="mb-6">
              <p className="font-medium text-gray-800 mb-3">修改密码</p>
              {passwordError && <div className="p-2 mb-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{passwordError}</div>}
              {passwordSuccess && <div className="p-2 mb-3 bg-green-50 border border-green-200 rounded text-green-600 text-sm">{passwordSuccess}</div>}
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showOldPassword ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="当前密码"
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200"
                  />
                  <button onClick={() => setShowOldPassword(!showOldPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="新密码（至少6位）"
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200"
                  />
                  <button onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="确认新密码"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200"
                />
                <Button onClick={handleChangePassword} disabled={isChangingPassword} className="w-full">
                  {isChangingPassword ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />修改中...</> : '确认修改'}
                </Button>
              </div>
            </div>

            {/* 登录设备 */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium text-gray-800">登录设备</p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={loadSessions} disabled={isLoadingSessions}>
                    {isLoadingSessions ? <Loader2 className="w-4 h-4 animate-spin" /> : '刷新'}
                  </Button>
                  {sessions.length > 1 && (
                    <Button variant="secondary" size="sm" onClick={handleRemoveOtherSessions} className="text-red-500">
                      移除其他
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {sessions.length === 0 ? (
                  <p className="text-sm text-center py-4 text-gray-400">点击"刷新"查看登录设备</p>
                ) : (
                  sessions.map((session) => (
                    <div key={session.id} className={cn("flex items-center justify-between p-3 rounded-lg", session.isCurrent ? "bg-green-50" : "bg-gray-50")}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-800">
                            {session.deviceName || '未知设备'}
                            {session.isCurrent && <span className="ml-2 text-xs text-green-600">(当前)</span>}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500">
                          {[session.browser, session.os].filter(Boolean).join(' · ') || '未知浏览器'}
                          {session.ipAddress && ` · ${session.ipAddress}`}
                        </p>
                        <p className="text-xs text-gray-400">
                          登录时间: {session.createdAt ? new Date(session.createdAt).toLocaleString() : '未知'}
                        </p>
                      </div>
                      {!session.isCurrent && (
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveSession(session.id)} className="text-red-500">移除</Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );

      case 'data':
        return (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">数据管理</h3>
            <SettingItem title="导出数据" desc="导出您的学习数据和设置">
              <Button variant="secondary" size="sm" onClick={handleExportData}>导出</Button>
            </SettingItem>
            <SettingItem title="清除缓存" desc="清除本地缓存数据">
              <Button variant="secondary" size="sm" onClick={handleClearCache}>清除</Button>
            </SettingItem>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-[800px] h-[560px] overflow-hidden flex">
        {/* 左侧导航 */}
        <div className="w-48 bg-gray-50/80 border-r border-gray-100 p-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-6">
            <Settings size={20} className="text-gray-600" />
            <h2 className="text-lg font-bold text-gray-800">设置</h2>
          </div>
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-white text-primary-600 shadow-sm"
                    : "text-gray-600 hover:bg-white/60"
                )}
              >
                <span className={activeTab === tab.id ? "text-primary-500" : "text-gray-400"}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 关闭按钮 */}
          <div className="flex justify-end p-4 pb-0">
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </AnimatedModal>
  );
}
