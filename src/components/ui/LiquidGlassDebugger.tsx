/**
 * 液态玻璃调试面板
 * 通过 CSS 变量实时调整全局液态玻璃效果
 */
import { useState, useEffect } from 'react';
import { X, RotateCcw, Sliders } from 'lucide-react';

interface GlassConfig {
  // 模糊效果
  blurAmount: number;
  // 饱和度
  saturation: number;
  // 背景透明度
  bgOpacity: number;
  // 边框透明度
  borderOpacity: number;
  // 高光强度
  highlightOpacity: number;
  // 阴影强度
  shadowOpacity: number;
  // 圆角
  borderRadius: number;
}

const defaultConfig: GlassConfig = {
  blurAmount: 12,
  saturation: 110,
  bgOpacity: 0.2,
  borderOpacity: 0.3,
  highlightOpacity: 0.8,
  shadowOpacity: 0.08,
  borderRadius: 16,
};

// 从 localStorage 加载配置
const loadConfig = (): GlassConfig => {
  try {
    const saved = localStorage.getItem('liquid-glass-config');
    if (saved) {
      return { ...defaultConfig, ...JSON.parse(saved) };
    }
  } catch {
    // ignore
  }
  return defaultConfig;
};

// 保存配置到 localStorage
const saveConfig = (config: GlassConfig) => {
  localStorage.setItem('liquid-glass-config', JSON.stringify(config));
};

// 应用 CSS 变量到 document
const applyConfig = (config: GlassConfig) => {
  const root = document.documentElement;
  
  // 设置 CSS 变量
  root.style.setProperty('--glass-blur', `${config.blurAmount}px`);
  root.style.setProperty('--glass-saturation', `${config.saturation}%`);
  root.style.setProperty('--glass-bg-opacity', config.bgOpacity.toString());
  root.style.setProperty('--glass-border-opacity', config.borderOpacity.toString());
  root.style.setProperty('--glass-highlight-opacity', config.highlightOpacity.toString());
  root.style.setProperty('--glass-shadow-opacity', config.shadowOpacity.toString());
  root.style.setProperty('--glass-border-radius', `${config.borderRadius}px`);
};

interface LiquidGlassDebuggerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LiquidGlassDebugger({ isOpen, onClose }: LiquidGlassDebuggerProps) {
  const [config, setConfig] = useState<GlassConfig>(loadConfig);

  // 初始化时应用配置
  useEffect(() => {
    applyConfig(config);
  }, []);

  const updateConfig = (key: keyof GlassConfig, value: number) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    applyConfig(newConfig);
    saveConfig(newConfig);
  };

  const resetConfig = () => {
    setConfig(defaultConfig);
    applyConfig(defaultConfig);
    saveConfig(defaultConfig);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-16 right-4 z-[9999] w-72">
      <div className="frosted-glass-card rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/20 bg-white/10">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-primary-500" />
            <h3 className="font-semibold text-sm text-gray-800">玻璃效果调试</h3>
          </div>
          <div className="flex gap-1">
            <button
              onClick={resetConfig}
              className="p-1.5 rounded-lg hover:bg-white/30 transition-colors text-gray-500"
              title="重置默认"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/30 transition-colors text-gray-500"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 space-y-4 text-xs">
          {/* 模糊程度 */}
          <div>
            <label className="flex justify-between mb-1.5">
              <span className="font-medium text-gray-700">模糊程度</span>
              <span className="text-gray-500">{config.blurAmount}px</span>
            </label>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={config.blurAmount}
              onChange={(e) => updateConfig('blurAmount', Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer accent-primary-500"
            />
          </div>

          {/* 饱和度 */}
          <div>
            <label className="flex justify-between mb-1.5">
              <span className="font-medium text-gray-700">饱和度</span>
              <span className="text-gray-500">{config.saturation}%</span>
            </label>
            <input
              type="range"
              min="50"
              max="200"
              step="5"
              value={config.saturation}
              onChange={(e) => updateConfig('saturation', Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer accent-primary-500"
            />
          </div>

          {/* 背景透明度 */}
          <div>
            <label className="flex justify-between mb-1.5">
              <span className="font-medium text-gray-700">背景透明度</span>
              <span className="text-gray-500">{(config.bgOpacity * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              value={config.bgOpacity}
              onChange={(e) => updateConfig('bgOpacity', Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer accent-primary-500"
            />
          </div>

          {/* 边框透明度 */}
          <div>
            <label className="flex justify-between mb-1.5">
              <span className="font-medium text-gray-700">边框透明度</span>
              <span className="text-gray-500">{(config.borderOpacity * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.borderOpacity}
              onChange={(e) => updateConfig('borderOpacity', Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer accent-primary-500"
            />
          </div>

          {/* 高光强度 */}
          <div>
            <label className="flex justify-between mb-1.5">
              <span className="font-medium text-gray-700">高光强度</span>
              <span className="text-gray-500">{(config.highlightOpacity * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.highlightOpacity}
              onChange={(e) => updateConfig('highlightOpacity', Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer accent-primary-500"
            />
          </div>

          {/* 阴影强度 */}
          <div>
            <label className="flex justify-between mb-1.5">
              <span className="font-medium text-gray-700">阴影强度</span>
              <span className="text-gray-500">{(config.shadowOpacity * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="0.3"
              step="0.01"
              value={config.shadowOpacity}
              onChange={(e) => updateConfig('shadowOpacity', Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer accent-primary-500"
            />
          </div>

          {/* 圆角 */}
          <div>
            <label className="flex justify-between mb-1.5">
              <span className="font-medium text-gray-700">圆角大小</span>
              <span className="text-gray-500">{config.borderRadius}px</span>
            </label>
            <input
              type="range"
              min="0"
              max="32"
              step="2"
              value={config.borderRadius}
              onChange={(e) => updateConfig('borderRadius', Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer accent-primary-500"
            />
          </div>
        </div>

        {/* 提示 */}
        <div className="px-4 py-2 bg-gray-50/50 border-t border-white/20">
          <p className="text-[10px] text-gray-400 text-center">
            调整后自动保存，刷新页面后生效
          </p>
        </div>
      </div>
    </div>
  );
}

// 导出初始化函数，在应用启动时调用
export function initLiquidGlassConfig() {
  const config = loadConfig();
  applyConfig(config);
}
