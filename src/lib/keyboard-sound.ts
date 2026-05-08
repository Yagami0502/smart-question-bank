/**
 * 键盘音效服务 - 支持多种音效类型和真实音频文件
 */

export type SoundType = 'mechanical' | 'typewriter' | 'soft' | 'none';

interface KeyboardSoundConfig {
  enabled: boolean;
  type: SoundType;
  volume: number;
}

// 音效文件映射 - 每种类型对应的音频文件
const SOUND_FILES: Record<Exclude<SoundType, 'none'>, string[]> = {
  // 机械键盘音效
  mechanical: [
    '/sound/key-sounds/keyboard typing 3(01).mp3',
    '/sound/key-sounds/keyboard typing 3(02).mp3',
    '/sound/key-sounds/keyboard typing 3(03).mp3',
  ],
  // 打字机音效
  typewriter: [
    '/sound/key-sounds/keyboard typing 3(04).mp3',
    '/sound/key-sounds/keyboard typing 3(05).mp3',
  ],
  // 轻柔音效
  soft: [
    '/sound/key-sounds/keyboard typing 3(06).mp3',
  ],
};

class KeyboardSoundService {
  private config: KeyboardSoundConfig = {
    enabled: false,
    type: 'mechanical',
    volume: 0.5,
  };
  
  // 缓存已加载的音频
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  
  // 音频池 - 用于快速连续播放
  private audioPool: Map<string, HTMLAudioElement[]> = new Map();
  private poolSize = 5;

  constructor() {
    // 延迟预加载音效，避免阻塞初始化
    if (typeof window !== 'undefined') {
      // 使用 requestIdleCallback 或 setTimeout 延迟加载
      const loadSounds = () => {
        try {
          this.preloadAllSounds();
        } catch (error) {
          console.warn('预加载音效失败:', error);
        }
      };
      
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(loadSounds);
      } else {
        setTimeout(loadSounds, 1000);
      }
    }
  }

  // 预加载所有音效文件
  private preloadAllSounds(): void {
    Object.values(SOUND_FILES).flat().forEach(path => {
      this.preloadSound(path);
    });
  }

  // 预加载单个音效
  private preloadSound(path: string): void {
    if (this.audioCache.has(path)) return;
    
    const audio = new Audio(path);
    audio.preload = 'auto';
    audio.volume = this.config.volume;
    this.audioCache.set(path, audio);
    
    // 创建音频池
    const pool: HTMLAudioElement[] = [];
    for (let i = 0; i < this.poolSize; i++) {
      const poolAudio = new Audio(path);
      poolAudio.preload = 'auto';
      poolAudio.volume = this.config.volume;
      pool.push(poolAudio);
    }
    this.audioPool.set(path, pool);
  }

  // 设置配置
  setConfig(config: Partial<KeyboardSoundConfig>): void {
    this.config = { ...this.config, ...config };
    
    // 更新所有缓存音频的音量
    if (config.volume !== undefined) {
      this.updateVolume(config.volume);
    }
  }

  // 获取配置
  getConfig(): KeyboardSoundConfig {
    return { ...this.config };
  }

  // 更新音量
  private updateVolume(volume: number): void {
    this.audioCache.forEach(audio => {
      audio.volume = volume;
    });
    this.audioPool.forEach(pool => {
      pool.forEach(audio => {
        audio.volume = volume;
      });
    });
  }

  // 从音频池获取可用的音频元素
  private getAvailableAudio(path: string): HTMLAudioElement | null {
    const pool = this.audioPool.get(path);
    if (!pool) return null;
    
    // 找到一个已结束或未播放的音频
    for (const audio of pool) {
      if (audio.paused || audio.ended) {
        audio.currentTime = 0;
        return audio;
      }
    }
    
    // 如果都在播放，返回第一个（会重新开始）
    const first = pool[0];
    if (first) {
      first.currentTime = 0;
      return first;
    }
    
    return null;
  }

  // 播放指定路径的音效
  private playSound(path: string): void {
    try {
      const audio = this.getAvailableAudio(path);
      if (audio) {
        audio.volume = this.config.volume;
        audio.play().catch(() => {
          // 忽略播放错误（如用户未交互）
        });
      }
    } catch (error) {
      console.warn('播放音效失败:', error);
    }
  }

  // 获取当前类型的随机音效文件
  private getRandomSoundFile(): string | null {
    if (this.config.type === 'none') return null;
    
    const files = SOUND_FILES[this.config.type];
    if (!files || files.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * files.length);
    return files[randomIndex];
  }

  // 播放按键音效
  playKeySound(): void {
    if (!this.config.enabled || this.config.type === 'none') return;
    
    const soundFile = this.getRandomSoundFile();
    if (soundFile) {
      this.playSound(soundFile);
    }
  }

  // 预览音效 - 用于设置面板切换时播放
  previewSound(type: SoundType): void {
    if (type === 'none') return;
    
    const files = SOUND_FILES[type];
    if (!files || files.length === 0) return;
    
    // 播放该类型的第一个音效作为预览
    this.playSound(files[0]);
  }

  // 播放正确音效
  playCorrectSound(): void {
    if (!this.config.enabled) return;
    // 使用轻柔音效作为正确提示
    const files = SOUND_FILES.soft;
    if (files && files.length > 0) {
      this.playSound(files[0]);
    }
  }

  // 播放错误音效
  playErrorSound(): void {
    if (!this.config.enabled) return;
    // 使用机械音效作为错误提示
    const files = SOUND_FILES.mechanical;
    if (files && files.length > 0) {
      this.playSound(files[0]);
    }
  }
}

// 导出单例
export const keyboardSound = new KeyboardSoundService();
