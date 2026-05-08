/**
 * 语音服务 - 使用 Web Speech API 实现单词发音
 */

export type VoiceType = 'us' | 'uk';

// 语音配置
interface SpeechConfig {
  voiceType: VoiceType;
  rate: number;      // 语速 0.1 - 10
  pitch: number;     // 音调 0 - 2
  volume: number;    // 音量 0 - 1
}

const defaultConfig: SpeechConfig = {
  voiceType: 'us',
  rate: 0.9,
  pitch: 1,
  volume: 1,
};

class SpeechService {
  private synth: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  private config: SpeechConfig = defaultConfig;
  private isReady: boolean = false;

  constructor() {
    this.synth = window.speechSynthesis;
    this.loadVoices();
    
    // 某些浏览器需要等待 voiceschanged 事件
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices(): void {
    this.voices = this.synth.getVoices();
    this.isReady = this.voices.length > 0;
  }

  // 获取指定类型的语音
  private getVoice(type: VoiceType): SpeechSynthesisVoice | null {
    if (this.voices.length === 0) {
      this.loadVoices();
    }

    // 优先查找对应口音的英语语音
    const langCode = type === 'us' ? 'en-US' : 'en-GB';
    
    // 优先级：完全匹配 > 部分匹配 > 任意英语
    let voice = this.voices.find(v => v.lang === langCode);
    if (!voice) {
      voice = this.voices.find(v => v.lang.startsWith(type === 'us' ? 'en-US' : 'en-GB'));
    }
    if (!voice) {
      voice = this.voices.find(v => v.lang.startsWith('en'));
    }
    
    return voice || null;
  }

  // 朗读文本
  speak(text: string, options?: Partial<SpeechConfig>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('浏览器不支持语音合成'));
        return;
      }

      // 取消当前正在播放的语音
      this.synth.cancel();

      const config = { ...this.config, ...options };
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voice = this.getVoice(config.voiceType);
      if (voice) {
        utterance.voice = voice;
      }
      
      utterance.rate = config.rate;
      utterance.pitch = config.pitch;
      utterance.volume = config.volume;
      utterance.lang = config.voiceType === 'us' ? 'en-US' : 'en-GB';

      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        // 忽略 interrupted 错误（用户主动取消）
        if (event.error === 'interrupted') {
          resolve();
        } else {
          reject(new Error(`语音播放失败: ${event.error}`));
        }
      };

      this.synth.speak(utterance);
    });
  }

  // 朗读单词（带音标提示）
  async speakWord(word: string, voiceType?: VoiceType): Promise<void> {
    await this.speak(word, { voiceType: voiceType || this.config.voiceType });
  }

  // 停止播放
  stop(): void {
    this.synth.cancel();
  }

  // 检查是否正在播放
  isSpeaking(): boolean {
    return this.synth.speaking;
  }

  // 更新配置
  setConfig(config: Partial<SpeechConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 获取当前配置
  getConfig(): SpeechConfig {
    return { ...this.config };
  }

  // 获取可用语音列表
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter(v => v.lang.startsWith('en'));
  }

  // 检查服务是否可用
  isAvailable(): boolean {
    return 'speechSynthesis' in window && this.isReady;
  }
}

// 导出单例
export const speechService = new SpeechService();
