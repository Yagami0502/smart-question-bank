/**
 * 文章练习页面 - 支持跟打和默写模式
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  Keyboard,
  PenTool,
  Languages,
  RotateCcw,
  Play,
  Pause,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Progress } from '../components/ui/Progress';
import { dialog } from '../components/ui/ConfirmDialog';
import { speechService, type VoiceType } from '../lib/speech-service';
import { cn } from '../lib/utils';

// 文章练习模式
type ArticlePracticeMode = 'typing' | 'dictation';

interface ArticlePracticePageProps {
  article: {
    id: string;
    title: string;
    content: string;
    translation?: string;
  };
  onBack: () => void;
}

// 将文章分割成句子
function splitIntoSentences(text: string): string[] {
  // 按句号、问号、感叹号分割，保留分隔符
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
  return sentences;
}

export default function ArticlePracticePage({ article, onBack }: ArticlePracticePageProps) {
  // 练习状态
  const [practiceMode, setPracticeMode] = useState<ArticlePracticeMode | null>(null);
  const [sentences, setSentences] = useState<string[]>([]);
  const [translationSentences, setTranslationSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // 输入状态
  const [userInput, setUserInput] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  
  // 统计
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [startTime] = useState(Date.now());
  
  // 设置
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [voiceType, setVoiceType] = useState<VoiceType>('us');
  const [showTranslation, setShowTranslation] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentSentence = sentences[currentIndex];
  const currentTranslation = translationSentences[currentIndex];

  // 初始化句子
  useEffect(() => {
    const contentSentences = splitIntoSentences(article.content);
    setSentences(contentSentences);
    
    if (article.translation) {
      // 简单按句号分割翻译（实际应用中可能需要更智能的对齐）
      const transSentences = splitIntoSentences(article.translation);
      setTranslationSentences(transSentences);
    }
  }, [article]);

  // 自动播放发音
  useEffect(() => {
    if (currentSentence && autoPlayAudio && practiceMode === 'dictation' && !isChecked) {
      playCurrentSentence();
    }
  }, [currentIndex, practiceMode]);

  // 聚焦输入框
  useEffect(() => {
    if (practiceMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentIndex, practiceMode, isChecked]);

  // 播放当前句子
  const playCurrentSentence = useCallback(async () => {
    if (!currentSentence || isPlaying) return;
    
    setIsPlaying(true);
    try {
      await speechService.speak(currentSentence, { voiceType, rate: 0.85 });
    } catch (error) {
      console.error('播放失败:', error);
    } finally {
      setIsPlaying(false);
    }
  }, [currentSentence, voiceType, isPlaying]);

  // 停止播放
  const stopPlaying = useCallback(() => {
    speechService.stop();
    setIsPlaying(false);
  }, []);

  // 检查答案
  const checkAnswer = useCallback(() => {
    if (!currentSentence || !userInput.trim()) return;

    // 标准化比较（忽略大小写和多余空格）
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const correct = normalize(userInput) === normalize(currentSentence);
    
    setIsCorrect(correct);
    setIsChecked(true);

    if (correct) {
      setCorrectCount(prev => prev + 1);
    } else {
      setWrongCount(prev => prev + 1);
    }
  }, [currentSentence, userInput]);

  // 下一句
  const nextSentence = useCallback(() => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setIsChecked(false);
      setIsCorrect(null);
    } else {
      // 练习完成
      const duration = Math.round((Date.now() - startTime) / 1000 / 60);
      const accuracy = correctCount + wrongCount > 0 
        ? Math.round((correctCount / (correctCount + wrongCount)) * 100) 
        : 0;
      dialog.success(
        `练习完成！正确率 ${accuracy}%，用时 ${duration} 分钟`,
        '练习结束'
      );
      onBack();
    }
  }, [currentIndex, sentences.length, correctCount, wrongCount, startTime, onBack]);

  // 上一句
  const prevSentence = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setUserInput('');
      setIsChecked(false);
      setIsCorrect(null);
    }
  }, [currentIndex]);

  // 重试当前句子
  const retryCurrent = useCallback(() => {
    setUserInput('');
    setIsChecked(false);
    setIsCorrect(null);
    inputRef.current?.focus();
  }, []);

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      if (isChecked) {
        nextSentence();
      } else {
        checkAnswer();
      }
    } else if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault();
      if (isPlaying) {
        stopPlaying();
      } else {
        playCurrentSentence();
      }
    }
  }, [isChecked, nextSentence, checkAnswer, isPlaying, stopPlaying, playCurrentSentence]);

  // 计算输入差异（高亮错误部分）
  const renderDiff = () => {
    if (!isChecked || !currentSentence) return null;
    
    const expected = currentSentence;
    const actual = userInput;
    
    // 简单的字符级别对比
    const result: JSX.Element[] = [];
    const maxLen = Math.max(expected.length, actual.length);
    
    for (let i = 0; i < maxLen; i++) {
      const expectedChar = expected[i] || '';
      const actualChar = actual[i] || '';
      
      if (expectedChar.toLowerCase() === actualChar.toLowerCase()) {
        result.push(<span key={i} className="text-green-600">{expectedChar}</span>);
      } else if (actualChar) {
        result.push(<span key={i} className="text-red-500 bg-red-100">{actualChar}</span>);
      } else {
        result.push(<span key={i} className="text-gray-400 bg-yellow-100">{expectedChar}</span>);
      }
    }
    
    return <div className="font-mono text-lg">{result}</div>;
  };

  // 模式选择界面
  if (!practiceMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-8"
          >
            <ArrowLeft size={20} />
            <span>返回</span>
          </button>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">{article.title}</h1>
            <p className="text-gray-600">选择练习模式</p>
          </div>

          <div className="space-y-4">
            <Card
              className="cursor-pointer transition-all hover:shadow-lg"
              hover
              onClick={() => setPracticeMode('typing')}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Keyboard size={28} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">跟打模式</h3>
                    <p className="text-sm text-gray-600">看原文逐句输入，练习打字和记忆</p>
                  </div>
                  <ChevronRight className="text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer transition-all hover:shadow-lg"
              hover
              onClick={() => setPracticeMode('dictation')}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center">
                    <PenTool size={28} className="text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">默写模式</h3>
                    <p className="text-sm text-gray-600">听发音默写句子，强化听力和记忆</p>
                  </div>
                  <ChevronRight className="text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 文章预览 */}
          <Card className="mt-8">
            <CardContent className="p-6">
              <h4 className="font-medium text-gray-700 mb-3">文章预览</h4>
              <p className="text-gray-600 text-sm leading-relaxed line-clamp-6">
                {article.content}
              </p>
              {article.translation && (
                <>
                  <div className="border-t border-gray-200 my-4" />
                  <p className="text-gray-500 text-sm leading-relaxed line-clamp-4">
                    {article.translation}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!currentSentence) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const progress = ((currentIndex + 1) / sentences.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
      {/* 顶部栏 */}
      <div className="p-4 flex items-center justify-between border-b border-gray-200/50 bg-white/50 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft size={20} />
          <span className="hidden sm:inline">退出</span>
        </button>

        <div className="flex-1 mx-4">
          <div className="text-center text-sm text-gray-600 mb-1">
            {article.title} - 第 {currentIndex + 1}/{sentences.length} 句
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-green-600">✓ {correctCount}</span>
          <span className="text-sm text-red-500">✗ {wrongCount}</span>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          {/* 句子卡片 */}
          <Card className="mb-6">
            <CardContent className="p-8">
              {/* 跟打模式：显示原文 */}
              {practiceMode === 'typing' && (
                <div className="text-center mb-6">
                  <p className="text-xl leading-relaxed text-gray-800">
                    {currentSentence}
                  </p>
                </div>
              )}

              {/* 默写模式：显示播放按钮 */}
              {practiceMode === 'dictation' && !isChecked && (
                <div className="text-center mb-6">
                  <button
                    onClick={isPlaying ? stopPlaying : playCurrentSentence}
                    className={cn(
                      "w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all",
                      isPlaying 
                        ? "bg-red-100 hover:bg-red-200" 
                        : "bg-primary-100 hover:bg-primary-200"
                    )}
                  >
                    {isPlaying ? (
                      <Pause size={36} className="text-red-600" />
                    ) : (
                      <Play size={36} className="text-primary-600 ml-1" />
                    )}
                  </button>
                  <p className="mt-4 text-gray-500">
                    {isPlaying ? '正在播放...' : '点击播放句子'}
                  </p>
                </div>
              )}

              {/* 答案显示后显示原文 */}
              {isChecked && (
                <div className="mb-6">
                  <div className="text-sm text-gray-500 mb-2">正确答案：</div>
                  <p className="text-lg text-gray-800 bg-green-50 p-4 rounded-lg">
                    {currentSentence}
                  </p>
                </div>
              )}

              {/* 翻译对照 */}
              {showTranslation && currentTranslation && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-gray-600">{currentTranslation}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 输入区域 */}
          <div className="mb-6">
            <textarea
              ref={inputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="在此输入句子..."
              disabled={isChecked}
              rows={3}
              className={cn(
                "w-full px-6 py-4 text-lg rounded-xl border-2 outline-none transition-all resize-none",
                "bg-white",
                isChecked && isCorrect && "border-green-500 bg-green-50",
                isChecked && !isCorrect && "border-red-500 bg-red-50",
                !isChecked && "border-gray-200 focus:border-primary-500"
              )}
            />

            {/* 差异对比 */}
            {isChecked && !isCorrect && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-sm text-gray-500 mb-2">你的输入（红色为错误）：</div>
                {renderDiff()}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-center gap-3">
            {!isChecked ? (
              <>
                <Button
                  variant="ghost"
                  onClick={prevSentence}
                  disabled={currentIndex === 0}
                  leftIcon={<ChevronLeft size={18} />}
                >
                  上一句
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsChecked(true);
                    setIsCorrect(false);
                  }}
                  leftIcon={<Eye size={18} />}
                >
                  显示答案
                </Button>
                <Button
                  variant="primary"
                  onClick={checkAnswer}
                  disabled={!userInput.trim()}
                >
                  检查 (Ctrl+Enter)
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={retryCurrent}
                  leftIcon={<RotateCcw size={18} />}
                >
                  重试
                </Button>
                <Button
                  variant="primary"
                  onClick={nextSentence}
                  rightIcon={<ChevronRight size={18} />}
                >
                  {currentIndex < sentences.length - 1 ? '下一句' : '完成'} (Ctrl+Enter)
                </Button>
              </>
            )}
          </div>

          {/* 工具栏 */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={isPlaying ? stopPlaying : playCurrentSentence}
              className={cn(
                "p-3 rounded-full transition-colors",
                isPlaying ? "bg-red-100 text-red-600" : "hover:bg-white/80 text-gray-600"
              )}
              title="播放发音 (Ctrl+Space)"
            >
              {isPlaying ? <Pause size={22} /> : <Volume2 size={22} />}
            </button>
            <button
              onClick={() => setAutoPlayAudio(!autoPlayAudio)}
              className={cn(
                "p-3 rounded-full transition-colors",
                autoPlayAudio ? "bg-primary-100 text-primary-600" : "hover:bg-white/80 text-gray-600"
              )}
              title="自动播放"
            >
              {autoPlayAudio ? <Volume2 size={22} /> : <VolumeX size={22} />}
            </button>
            <button
              onClick={() => setVoiceType(voiceType === 'us' ? 'uk' : 'us')}
              className="px-3 py-2 rounded-full hover:bg-white/80 transition-colors text-sm font-medium text-gray-600"
            >
              {voiceType === 'us' ? '🇺🇸 美音' : '🇬🇧 英音'}
            </button>
            {article.translation && (
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className={cn(
                  "p-3 rounded-full transition-colors",
                  showTranslation ? "bg-primary-100 text-primary-600" : "hover:bg-white/80 text-gray-600"
                )}
                title="显示翻译"
              >
                <Languages size={22} />
              </button>
            )}
          </div>

          {/* 快捷键提示 */}
          <div className="mt-6 text-center text-xs text-gray-400">
            <span className="mr-4">Ctrl+Enter: 检查/下一句</span>
            <span>Ctrl+Space: 播放发音</span>
          </div>
        </div>
      </div>
    </div>
  );
}
