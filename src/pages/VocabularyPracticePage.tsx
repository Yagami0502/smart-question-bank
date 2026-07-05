/**
 * 单词练习页面 - 支持跟打/复习/默写三种模式，智能/自由学习模式
 * 跟打模式：实时显示每个字母的正确/错误状态
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Star,
  StarOff,
  Check,
  X,
  SkipForward,
  Keyboard,
  Brain,
  PenTool,
  ChevronRight,
  Sparkles,
  Shuffle,
  RotateCcw,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { dialog } from '../components/ui/ConfirmDialog';
import { speechService, type VoiceType } from '../lib/speech-service';
import { keyboardSound } from '../lib/keyboard-sound';
import {
  wordOperations,
  wordProgressOperations,
  wrongWordOperations,
  favoriteWordOperations,
  masteredWordOperations,
  userVocabularyOperations,
  vocabularySettingsOperations,
} from '../lib/vocabulary-db';
import { initSampleVocabulary } from '../lib/vocabulary-loader';
import type { Word, PracticeType, LearningMode } from '../types/vocabulary';
import { cn } from '../lib/utils';

interface VocabularyPracticePageProps {
  bookId: string;
  bookName: string;
  onBack: () => void;
}

// 练习模式配置
const practiceModes: { type: PracticeType; label: string; desc: string; icon: typeof Keyboard }[] = [
  { type: 'typing', label: '跟打模式', desc: '看单词拼写，练习打字', icon: Keyboard },
  { type: 'review', label: '复习模式', desc: '看释义回忆单词', icon: Brain },
  { type: 'dictation', label: '默写模式', desc: '听发音默写单词', icon: PenTool },
];

// 学习模式配置
const learningModes: { type: LearningMode; label: string; desc: string; icon: typeof Sparkles }[] = [
  { type: 'smart', label: '智能模式', desc: '根据记忆曲线自动安排复习', icon: Sparkles },
  { type: 'free', label: '自由模式', desc: '随机学习，不受限制', icon: Shuffle },
];

export default function VocabularyPracticePage({ bookId, bookName, onBack }: VocabularyPracticePageProps) {
  // 模式选择状态
  const [learningMode, setLearningMode] = useState<LearningMode | null>(null);
  const [practiceType, setPracticeType] = useState<PracticeType | null>(null);
  
  // 练习状态
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // 输入状态
  const [userInput, setUserInput] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  
  // 跟打模式状态
  const [typingInput, setTypingInput] = useState(''); // 跟打输入
  const [typingErrors, setTypingErrors] = useState<Set<number>>(new Set()); // 错误位置
  const [typingComplete, setTypingComplete] = useState(false); // 是否完成当前单词
  
  // 统计
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [startTime] = useState(Date.now());
  
  // 设置
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [voiceType, setVoiceType] = useState<VoiceType>('us');
  const [showPhonetic, setShowPhonetic] = useState(true);
  
  // 收藏状态
  const [isFavorite, setIsFavorite] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const typingContainerRef = useRef<HTMLDivElement>(null);
  const currentWord = words[currentIndex];

  // 加载用户设置
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await vocabularySettingsOperations.get();
      setAutoPlayAudio(settings.autoPlayAudio);
      setVoiceType(settings.voiceType);
      setShowPhonetic(settings.showPhonetic);
      
      // 配置键盘音效
      keyboardSound.setConfig({
        enabled: settings.keyboardSound,
        type: settings.keyboardSoundType,
        volume: 0.3,
      });
    };
    loadSettings();
  }, []);

  // 加载单词
  useEffect(() => {
    const loadWords = async () => {
      try {
        setLoading(true);
        
        // 先尝试加载已有数据
        let allWords = await wordOperations.getByBookId(bookId);
        
        // 如果没有数据，初始化示例数据
        if (allWords.length === 0) {
          await initSampleVocabulary(bookId, bookName);
          allWords = await wordOperations.getByBookId(bookId);
        }
        
        if (allWords.length === 0) {
          dialog.warning('该词库暂无单词数据');
          onBack();
          return;
        }

        let selectedWords: Word[] = [];
        
        if (learningMode === 'smart') {
          // 智能模式：优先复习到期单词，然后学习新单词
          const settings = await vocabularySettingsOperations.get();
          
          // 获取待复习单词
          const dueProgress = await wordProgressOperations.getDueWords(bookId, settings.dailyReviewWords);
          const dueWordIds = new Set(dueProgress.map(p => p.wordId));
          const dueWords = allWords.filter(w => dueWordIds.has(w.id));
          
          // 获取新单词
          const learnedWordIds = new Set(
            (await wordProgressOperations.getNewWords(bookId, 1000)).map(p => p.wordId)
          );
          const newWords = allWords
            .filter(w => !learnedWordIds.has(w.id) && !dueWordIds.has(w.id))
            .slice(0, settings.dailyNewWords);
          
          // 初始化新单词的进度
          for (const word of newWords) {
            await wordProgressOperations.initProgress(word.id, bookId, word.word);
          }
          
          selectedWords = [...dueWords, ...newWords];
          
          if (selectedWords.length === 0) {
            dialog.success('今日学习任务已完成！明天再来吧~', '学习完成');
            onBack();
            return;
          }
        } else {
          // 自由模式：随机打乱
          const shuffled = [...allWords].sort(() => Math.random() - 0.5);
          selectedWords = shuffled.slice(0, 50);
          
          // 初始化进度
          for (const word of selectedWords) {
            await wordProgressOperations.initProgress(word.id, bookId, word.word);
          }
        }
        
        setWords(selectedWords);
      } catch (error) {
        console.error('加载单词失败:', error);
        dialog.error('加载单词失败');
      } finally {
        setLoading(false);
      }
    };

    if (practiceType && learningMode) {
      loadWords();
    }
  }, [bookId, bookName, practiceType, learningMode, onBack]);

  // 检查收藏状态
  useEffect(() => {
    const checkFavorite = async () => {
      if (currentWord) {
        const fav = await favoriteWordOperations.isFavorite(currentWord.id);
        setIsFavorite(fav);
      }
    };
    checkFavorite();
  }, [currentWord]);

  // 自动播放发音
  useEffect(() => {
    if (currentWord && autoPlayAudio && practiceType) {
      // 跟打模式和默写模式自动播放
      if (practiceType === 'typing' || practiceType === 'dictation') {
        speechService.speakWord(currentWord.word, voiceType);
      }
    }
  }, [currentWord, autoPlayAudio, practiceType, voiceType]);

  // 聚焦输入框
  useEffect(() => {
    if (practiceType && inputRef.current) {
      inputRef.current.focus();
    }
    // 跟打模式聚焦容器
    if (practiceType === 'typing' && typingContainerRef.current) {
      typingContainerRef.current.focus();
    }
  }, [currentIndex, practiceType, showAnswer]);

  // 重置跟打状态
  useEffect(() => {
    setTypingInput('');
    setTypingErrors(new Set());
    setTypingComplete(false);
  }, [currentIndex]);

  // 播放发音
  const playAudio = useCallback(() => {
    if (currentWord) {
      speechService.speakWord(currentWord.word, voiceType);
    }
  }, [currentWord, voiceType]);

  // 跟打模式键盘处理
  const handleTypingKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    if (!currentWord) return;
    
    // 完成后按 Enter 进入下一个
    if (typingComplete && e.key === 'Enter') {
      e.preventDefault();
      nextWord();
      return;
    }
    
    if (typingComplete) return;
    
    const targetWord = currentWord.word.toLowerCase();
    const currentPos = typingInput.length;
    
    // 处理退格键
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (typingInput.length > 0) {
        setTypingInput(prev => prev.slice(0, -1));
        setTypingErrors(prev => {
          const newErrors = new Set(prev);
          newErrors.delete(typingInput.length - 1);
          return newErrors;
        });
        keyboardSound.playKeySound();
      }
      return;
    }
    
    // 忽略功能键
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
      // 允许 Ctrl+Space 播放发音
      if (e.key === ' ' && e.ctrlKey) {
        e.preventDefault();
        playAudio();
      }
      return;
    }
    
    e.preventDefault();
    const typedChar = e.key.toLowerCase();
    const expectedChar = targetWord[currentPos];
    
    // 检查是否正确
    const isCharCorrect = typedChar === expectedChar;
    
    if (!isCharCorrect) {
      // 记录错误位置
      setTypingErrors(prev => new Set(prev).add(currentPos));
      keyboardSound.playErrorSound();
      // 输错字母时重新播放单词发音
      speechService.speakWord(currentWord.word, voiceType);
    } else {
      keyboardSound.playKeySound();
    }
    
    // 更新输入
    const newInput = typingInput + typedChar;
    setTypingInput(newInput);
    
    // 检查是否完成
    if (newInput.length === targetWord.length) {
      setTypingComplete(true);
      const hasErrors = typingErrors.size > 0 || !isCharCorrect;
      setIsCorrect(!hasErrors);
      setShowAnswer(true);
      
      if (!hasErrors) {
        keyboardSound.playCorrectSound();
        setCorrectCount(prev => prev + 1);
        await wordProgressOperations.updateProgress(currentWord.id, true);
      } else {
        setWrongCount(prev => prev + 1);
        await wordProgressOperations.updateProgress(currentWord.id, false);
        await wrongWordOperations.add(currentWord.id, bookId, currentWord.word, newInput);
      }
      
      await userVocabularyOperations.updateProgress(bookId);
    }
  }, [currentWord, typingInput, typingComplete, typingErrors, bookId, playAudio]);

  // 重试当前单词（跟打模式）
  const retryTyping = useCallback(() => {
    setTypingInput('');
    setTypingErrors(new Set());
    setTypingComplete(false);
    setShowAnswer(false);
    setIsCorrect(null);
    typingContainerRef.current?.focus();
  }, []);

  // 检查答案
  const checkAnswer = useCallback(async () => {
    if (!currentWord || !userInput.trim()) return;

    const correct = userInput.trim().toLowerCase() === currentWord.word.toLowerCase();
    setIsCorrect(correct);
    setShowAnswer(true);

    // 播放音效反馈
    if (correct) {
      keyboardSound.playCorrectSound();
      setCorrectCount(prev => prev + 1);
      await wordProgressOperations.updateProgress(currentWord.id, true);
    } else {
      keyboardSound.playErrorSound();
      setWrongCount(prev => prev + 1);
      await wordProgressOperations.updateProgress(currentWord.id, false);
      await wrongWordOperations.add(currentWord.id, bookId, currentWord.word, userInput);
    }

    // 更新词库进度
    await userVocabularyOperations.updateProgress(bookId);
  }, [currentWord, userInput, bookId]);

  // 下一个单词
  const nextWord = useCallback(() => {
    if (currentIndex < words.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setShowAnswer(false);
      setIsCorrect(null);
    } else {
      // 练习完成
      const duration = Math.round((Date.now() - startTime) / 1000 / 60);
      dialog.success(
        `练习完成！正确 ${correctCount} 个，错误 ${wrongCount} 个，用时 ${duration} 分钟`,
        '练习结束'
      );
      onBack();
    }
  }, [currentIndex, words.length, correctCount, wrongCount, startTime, onBack]);

  // 跳过当前单词
  const skipWord = useCallback(() => {
    setShowAnswer(true);
    setIsCorrect(false);
    setWrongCount(prev => prev + 1);
  }, []);

  // 切换收藏
  const toggleFavorite = useCallback(async () => {
    if (!currentWord) return;
    const result = await favoriteWordOperations.toggle(currentWord.id, bookId, currentWord.word);
    setIsFavorite(result);
  }, [currentWord, bookId]);

  // 标记为已掌握
  const markAsMastered = useCallback(async () => {
    if (!currentWord) return;
    await masteredWordOperations.add(currentWord.id, bookId, currentWord.word);
    dialog.success('已标记为掌握');
    nextWord();
  }, [currentWord, bookId, nextWord]);

  // 键盘事件处理
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (showAnswer) {
        nextWord();
      } else {
        checkAnswer();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setShowAnswer(true);
    } else if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault();
      playAudio();
    }
  }, [showAnswer, nextWord, checkAnswer, playAudio]);

  // 模式选择界面
  if (!learningMode || !practiceType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
        <div className="max-w-2xl mx-auto">
          {/* 返回按钮 */}
          <button
            onClick={() => {
              if (practiceType && !learningMode) {
                setPracticeType(null);
              } else {
                onBack();
              }
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-8"
          >
            <ArrowLeft size={20} />
            <span>返回</span>
          </button>

          {/* 标题 */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">{bookName}</h1>
            <p className="text-gray-600">
              {!practiceType ? '选择练习模式' : '选择学习模式'}
            </p>
          </div>

          {/* 练习模式选择 */}
          {!practiceType && (
            <div className="space-y-4">
              {practiceModes.map(mode => (
                <Card
                  key={mode.type}
                  className="cursor-pointer transition-all hover:shadow-lg"
                  hover
                  onClick={() => setPracticeType(mode.type)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-primary-100 flex items-center justify-center">
                        <mode.icon size={28} className="text-primary-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800">{mode.label}</h3>
                        <p className="text-sm text-gray-600">{mode.desc}</p>
                      </div>
                      <ChevronRight className="text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 学习模式选择 */}
          {practiceType && !learningMode && (
            <div className="space-y-4">
              {learningModes.map(mode => (
                <Card
                  key={mode.type}
                  className="cursor-pointer transition-all hover:shadow-lg"
                  hover
                  onClick={() => setLearningMode(mode.type)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-14 h-14 rounded-xl flex items-center justify-center",
                        mode.type === 'smart' ? "bg-purple-100" : "bg-green-100"
                      )}>
                        <mode.icon size={28} className={
                          mode.type === 'smart' ? "text-purple-600" : "text-green-600"
                        } />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-800">{mode.label}</h3>
                        <p className="text-sm text-gray-600">{mode.desc}</p>
                      </div>
                      <ChevronRight className="text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 加载中
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-gray-600">加载单词中...</p>
        </div>
      </div>
    );
  }

  if (!currentWord) {
    return null;
  }

  const progress = ((currentIndex + 1) / words.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
      {/* 顶部栏 */}
      <div className="px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        {/* 左侧：退出按钮 */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium hidden sm:inline">退出练习</span>
        </button>

        {/* 中间：进度 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100">
            <span className="text-sm font-semibold text-gray-700">
              {currentIndex + 1}
            </span>
            <span className="text-gray-400">/</span>
            <span className="text-sm text-gray-500">{words.length}</span>
          </div>
          <div className="w-40 hidden sm:block">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* 右侧：统计 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50">
            <Check size={14} className="text-green-600" />
            <span className="text-sm font-semibold text-green-600">{correctCount}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50">
            <X size={14} className="text-red-500" />
            <span className="text-sm font-semibold text-red-500">{wrongCount}</span>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xl">
          {/* 单词卡片 */}
          <Card className="mb-6">
            <CardContent className="p-8 text-center">
              {/* 跟打模式 - 实时显示每个字母状态 */}
              {practiceType === 'typing' && (
                <div
                  ref={typingContainerRef}
                  tabIndex={0}
                  onKeyDown={handleTypingKeyDown}
                  className="outline-none"
                >
                  {/* 释义提示 */}
                  <div className="mb-6 space-y-1">
                    {currentWord.translations.map((t: any, i) => (
                      <p key={i} className="text-lg text-gray-600">
                        <span className="text-gray-400 text-sm mr-2">{t.type || t.pos || ''}</span>
                        {t.translation || t.cn || ''}
                      </p>
                    ))}
                  </div>
                  
                  {/* 跟打区域 */}
                  <div className="flex justify-center items-center gap-1 mb-4 flex-wrap">
                    {currentWord.word.split('').map((char, index) => {
                      const isTyped = index < typingInput.length;
                      const typedChar = typingInput[index];
                      const isError = typingErrors.has(index);
                      const isCurrent = index === typingInput.length && !typingComplete;
                      
                      return (
                        <span
                          key={index}
                          className={cn(
                            "text-4xl font-mono font-bold px-1 py-2 rounded-lg transition-all duration-150 min-w-[2.5rem] inline-block",
                            // 未输入
                            !isTyped && !isCurrent && "text-gray-300 bg-gray-100",
                            // 当前位置（光标）
                            isCurrent && "text-gray-400 bg-primary-50 border-b-4 border-primary-500 animate-pulse",
                            // 正确输入
                            isTyped && !isError && "text-green-600 bg-green-50",
                            // 错误输入
                            isTyped && isError && "text-red-600 bg-red-50 line-through"
                          )}
                        >
                          {isTyped ? typedChar : char}
                        </span>
                      );
                    })}
                  </div>
                  
                  {/* 音标 */}
                  {showPhonetic && currentWord.phonetic && (
                    <p className="text-lg text-gray-500 mb-4">
                      {currentWord.phonetic.us && `/${currentWord.phonetic.us}/`}
                    </p>
                  )}
                  
                  {/* 提示文字 */}
                  {!typingComplete && (
                    <p className="text-sm text-gray-400 mt-4">
                      直接输入单词，按 Backspace 删除
                    </p>
                  )}
                  
                  {/* 完成状态 */}
                  {typingComplete && (
                    <div className={cn(
                      "mt-4 p-4 rounded-xl flex items-center justify-center gap-2",
                      isCorrect ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    )}>
                      {isCorrect ? (
                        <>
                          <Check size={24} />
                          <span className="font-medium">正确！</span>
                        </>
                      ) : (
                        <>
                          <X size={24} />
                          <span className="font-medium">有错误，正确拼写：{currentWord.word}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {practiceType === 'review' && (
                <>
                  {!showAnswer ? (
                    <div className="space-y-2">
                      {currentWord.translations.map((t: any, i) => (
                        <p key={i} className="text-xl text-gray-700">
                          <span className="text-gray-400 text-sm mr-2">{t.type || t.pos || ''}</span>
                          {t.translation || t.cn || ''}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <>
                      <h2 className="text-4xl font-bold text-gray-800 mb-4">{currentWord.word}</h2>
                      {showPhonetic && currentWord.phonetic && (
                        <p className="text-lg text-gray-500">
                          {currentWord.phonetic.us && `/${currentWord.phonetic.us}/`}
                        </p>
                      )}
                    </>
                  )}
                </>
              )}

              {practiceType === 'dictation' && (
                <>
                  {showAnswer ? (
                    <>
                      <h2 className="text-4xl font-bold text-gray-800 mb-4">{currentWord.word}</h2>
                      {showPhonetic && currentWord.phonetic && (
                        <p className="text-lg text-gray-500 mb-4">
                          {currentWord.phonetic.us && `/${currentWord.phonetic.us}/`}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="py-8">
                      <button
                        onClick={playAudio}
                        className="w-20 h-20 rounded-full bg-primary-100 hover:bg-primary-200 flex items-center justify-center mx-auto transition-colors"
                      >
                        <Volume2 size={36} className="text-primary-600" />
                      </button>
                      <p className="mt-4 text-gray-500">点击播放发音</p>
                    </div>
                  )}
                </>
              )}

              {/* 释义（答案显示后，非跟打模式） */}
              {showAnswer && practiceType !== 'typing' && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="space-y-2 text-left">
                    {currentWord.translations.map((t: any, i) => (
                      <p key={i} className="text-gray-700">
                        <span className="text-gray-400 text-sm mr-2">{t.type || t.pos || ''}</span>
                        {t.translation || t.cn || ''}
                      </p>
                    ))}
                  </div>
                  
                  {/* 短语示例 */}
                  {currentWord.phrases && currentWord.phrases.length > 0 && (
                    <div className="mt-4 text-left">
                      <p className="text-sm text-gray-500 mb-2">常用短语：</p>
                      <div className="space-y-1">
                        {currentWord.phrases.slice(0, 3).map((p, i) => (
                          <p key={i} className="text-sm text-gray-600">
                            <span className="text-primary-600">{p.phrase}</span>
                            <span className="mx-2">-</span>
                            {p.translation}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* 跟打模式完成后显示短语 */}
              {typingComplete && practiceType === 'typing' && currentWord.phrases && currentWord.phrases.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200 text-left">
                  <p className="text-sm text-gray-500 mb-2">常用短语：</p>
                  <div className="space-y-1">
                    {currentWord.phrases.slice(0, 3).map((p, i) => (
                      <p key={i} className="text-sm text-gray-600">
                        <span className="text-primary-600">{p.phrase}</span>
                        <span className="mx-2">-</span>
                        {p.translation}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 输入区域 - 仅非跟打模式显示 */}
          {practiceType !== 'typing' && (
            <div className="mb-6">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={(e) => {
                    setUserInput(e.target.value);
                    keyboardSound.playKeySound();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="输入你的答案..."
                  disabled={showAnswer}
                  className={cn(
                    "w-full px-6 py-4 text-xl text-center rounded-xl border-2 outline-none transition-all",
                    "bg-white",
                    showAnswer && isCorrect && "border-green-500 bg-green-50",
                    showAnswer && !isCorrect && "border-red-500 bg-red-50",
                    !showAnswer && "border-gray-200 focus:border-primary-500"
                  )}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                
                {/* 答案反馈图标 */}
                {showAnswer && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {isCorrect ? (
                      <Check size={28} className="text-green-500" />
                    ) : (
                      <X size={28} className="text-red-500" />
                    )}
                  </div>
                )}
              </div>

              {/* 错误提示 */}
              {showAnswer && !isCorrect && userInput && (
                <p className="mt-2 text-center text-red-500">
                  你的输入: <span className="line-through">{userInput}</span>
                </p>
              )}
            </div>
          )}

          {/* 操作按钮 - 跟打模式 */}
          {practiceType === 'typing' && (
            <div className="flex items-center justify-center gap-3">
              {!typingComplete ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={skipWord}
                    leftIcon={<SkipForward size={18} />}
                  >
                    跳过
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={playAudio}
                    leftIcon={<Volume2 size={18} />}
                  >
                    发音
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={retryTyping}
                    leftIcon={<RotateCcw size={18} />}
                  >
                    重试
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={toggleFavorite}
                    leftIcon={isFavorite ? <Star size={18} className="fill-yellow-400 text-yellow-400" /> : <StarOff size={18} />}
                  >
                    {isFavorite ? '已收藏' : '收藏'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={markAsMastered}
                    leftIcon={<Check size={18} />}
                  >
                    已掌握
                  </Button>
                  <Button
                    variant="primary"
                    onClick={nextWord}
                    rightIcon={<ChevronRight size={18} />}
                  >
                    下一个 (Enter)
                  </Button>
                </>
              )}
            </div>
          )}

          {/* 操作按钮 - 非跟打模式 */}
          {practiceType !== 'typing' && (
            <div className="flex items-center justify-center gap-3">
              {!showAnswer ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={skipWord}
                    leftIcon={<SkipForward size={18} />}
                  >
                    跳过
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowAnswer(true)}
                    leftIcon={<Eye size={18} />}
                  >
                    显示答案
                  </Button>
                  <Button
                    variant="primary"
                    onClick={checkAnswer}
                    disabled={!userInput.trim()}
                  >
                    确认 (Enter)
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={toggleFavorite}
                    leftIcon={isFavorite ? <Star size={18} className="fill-yellow-400 text-yellow-400" /> : <StarOff size={18} />}
                  >
                    {isFavorite ? '已收藏' : '收藏'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={markAsMastered}
                    leftIcon={<Check size={18} />}
                  >
                    已掌握
                  </Button>
                  <Button
                    variant="primary"
                    onClick={nextWord}
                    rightIcon={<ChevronRight size={18} />}
                  >
                    下一个 (Enter)
                  </Button>
                </>
              )}
            </div>
          )}

          {/* 工具栏 */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={playAudio}
              className="p-3 rounded-full hover:bg-white/80 transition-colors"
              title="播放发音 (Ctrl+Space)"
            >
              <Volume2 size={22} className="text-gray-600" />
            </button>
            <button
              onClick={() => setAutoPlayAudio(!autoPlayAudio)}
              className={cn(
                "p-3 rounded-full transition-colors",
                autoPlayAudio ? "bg-primary-100 text-primary-600" : "hover:bg-white/80 text-gray-600"
              )}
              title="自动播放发音"
            >
              {autoPlayAudio ? <Volume2 size={22} /> : <VolumeX size={22} />}
            </button>
            <button
              onClick={() => setVoiceType(voiceType === 'us' ? 'uk' : 'us')}
              className="px-3 py-2 rounded-full hover:bg-white/80 transition-colors text-sm font-medium text-gray-600"
              title="切换发音"
            >
              {voiceType === 'us' ? '🇺🇸 美音' : '🇬🇧 英音'}
            </button>
            <button
              onClick={() => setShowPhonetic(!showPhonetic)}
              className={cn(
                "p-3 rounded-full transition-colors",
                showPhonetic ? "bg-primary-100 text-primary-600" : "hover:bg-white/80 text-gray-600"
              )}
              title="显示音标"
            >
              {showPhonetic ? <Eye size={22} /> : <EyeOff size={22} />}
            </button>
          </div>

          {/* 快捷键提示 */}
          <div className="mt-6 text-center text-xs text-gray-400">
            {practiceType === 'typing' ? (
              <>
                <span className="mr-4">直接输入: 跟打单词</span>
                <span className="mr-4">Backspace: 删除</span>
                <span className="mr-4">Enter: 下一个</span>
                <span>Ctrl+Space: 播放发音</span>
              </>
            ) : (
              <>
                <span className="mr-4">Enter: 确认/下一个</span>
                <span className="mr-4">Tab: 显示答案</span>
                <span>Ctrl+Space: 播放发音</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
