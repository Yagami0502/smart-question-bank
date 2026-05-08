/**
 * 快速学习卡片组件
 * 支持翻转卡片、快速记忆（题目和单词）
 */
import { useState, useEffect } from 'react';
import { X, RotateCcw, ChevronLeft, ChevronRight, Shuffle, Check, X as XIcon, Eye, EyeOff, Layers, BookOpen, Globe, Volume2 } from 'lucide-react';
import Button from './ui/Button';
import AnimatedModal from './ui/AnimatedModal';
import { cn } from '../lib/utils';
import { db } from '../lib/database';
import { wordOperations, userVocabularyOperations } from '../lib/vocabulary-db';
import { speechService } from '../lib/speech-service';
import type { Option, QuestionContent } from '../types';
import type { Word } from '../types/vocabulary';

const getContentText = (content: string | QuestionContent | undefined): string => {
  if (!content) return '';
  if (typeof content === 'string') return content;
  return content.text || '';
};

// 卡片类型
type CardType = 'question' | 'word';

interface FlashcardData {
  id: string;
  type: CardType;
  // 题目字段
  question?: string;
  options?: { label: string; content: string; isCorrect: boolean }[];
  correctAnswer?: string;
  explanation?: string;
  tags?: string[];
  // 单词字段
  word?: string;
  phonetic?: string;
  translations?: string;
  phrases?: string[];
}

interface QuickFlashcardProps {
  deckId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickFlashcard({ deckId, isOpen, onClose }: QuickFlashcardProps) {
  const [cards, setCards] = useState<FlashcardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  const [unknownCards, setUnknownCards] = useState<Set<string>>(new Set());
  const [showHints, setShowHints] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  // 模式切换：题目 / 单词
  const [mode, setMode] = useState<'question' | 'word'>('question');

  useEffect(() => {
    if (isOpen) {
      loadCards();
    }
  }, [isOpen, deckId, mode]);

  const loadCards = async () => {
    setIsLoading(true);
    try {
      if (mode === 'question') {
        // 加载题目
        let questions;
        if (deckId) {
          questions = await db.questions.where('deckId').equals(deckId).toArray();
        } else {
          questions = await db.questions.toArray();
        }

        const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const flashcards: FlashcardData[] = questions.map(q => {
          const options = (q.options || []).map((opt: Option, idx: number) => ({
            label: optionLabels[idx] || String(idx + 1),
            content: getContentText(opt.content),
            isCorrect: opt.isCorrect,
          }));

          const correctOptions = options.filter(opt => opt.isCorrect);
          const correctAnswer = correctOptions.length > 0
            ? correctOptions.map(opt => opt.label).join('、')
            : String(q.answer || '');

          return {
            id: q.id,
            type: 'question' as CardType,
            question: getContentText(q.content),
            options,
            correctAnswer,
            explanation: q.explanation,
            tags: q.tags,
          };
        });

        setCards(flashcards);
      } else {
        // 加载单词
        const userVocabs = await userVocabularyOperations.getAll();
        let allWords: Word[] = [];
        
        for (const vocab of userVocabs) {
          const words = await wordOperations.getByBookId(vocab.bookId);
          allWords = [...allWords, ...words];
        }
        
        // 随机打乱并取前100个
        const shuffled = allWords.sort(() => Math.random() - 0.5).slice(0, 100);
        
        const flashcards: FlashcardData[] = shuffled.map(w => ({
          id: w.id,
          type: 'word' as CardType,
          word: w.word,
          phonetic: w.phonetic?.us || w.phonetic?.uk,
          translations: w.translations.map((t: any) => `${t.type || t.pos || ''} ${t.translation || t.cn || ''}`).join('；'),
          phrases: w.phrases?.slice(0, 2).map(p => `${p.phrase} - ${p.translation}`),
        }));

        setCards(flashcards);
      }
      
      setCurrentIndex(0);
      setIsFlipped(false);
      setKnownCards(new Set());
      setUnknownCards(new Set());
    } catch (error) {
      console.error('Failed to load cards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 播放单词发音
  const playWordAudio = (word: string) => {
    speechService.speakWord(word, 'us');
  };

  const currentCard = cards[currentIndex];
  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;
  const knownCount = knownCards.size;
  const unknownCount = unknownCards.size;

  const handleFlip = () => setIsFlipped(!isFlipped);

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleKnown = () => {
    if (currentCard) {
      const newKnown = new Set(knownCards);
      newKnown.add(currentCard.id);
      setKnownCards(newKnown);
      const newUnknown = new Set(unknownCards);
      newUnknown.delete(currentCard.id);
      setUnknownCards(newUnknown);
    }
    handleNext();
  };

  const handleUnknown = () => {
    if (currentCard) {
      const newUnknown = new Set(unknownCards);
      newUnknown.add(currentCard.id);
      setUnknownCards(newUnknown);
      const newKnown = new Set(knownCards);
      newKnown.delete(currentCard.id);
      setKnownCards(newKnown);
    }
    handleNext();
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownCards(new Set());
    setUnknownCards(new Set());
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        handleFlip();
        break;
      case 'ArrowRight':
        handleNext();
        break;
      case 'ArrowLeft':
        handlePrev();
        break;
      case '1':
        handleKnown();
        break;
      case '2':
        handleUnknown();
        break;
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, isFlipped]);

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <div className={cn(
          "p-4 border-b flex items-center justify-between",
          mode === 'question' 
            ? "bg-gradient-to-r from-purple-500 to-pink-500" 
            : "bg-gradient-to-r from-blue-500 to-cyan-500"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              {mode === 'question' ? (
                <Layers className="w-5 h-5 text-white" />
              ) : (
                <Globe className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {mode === 'question' ? '快速记忆卡片' : '单词速记'}
              </h2>
              <p className="text-xs text-white/80">
                {cards.length > 0 ? `${currentIndex + 1} / ${cards.length}` : '加载中...'}
              </p>
            </div>
          </div>
          
          {/* 模式切换 */}
          <div className="flex items-center gap-2">
            <div className="flex bg-white/20 rounded-lg p-1">
              <button
                onClick={() => setMode('question')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5",
                  mode === 'question' 
                    ? "bg-white text-purple-600 shadow" 
                    : "text-white/80 hover:text-white"
                )}
              >
                <BookOpen size={14} />
                题目
              </button>
              <button
                onClick={() => setMode('word')}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5",
                  mode === 'word' 
                    ? "bg-white text-blue-600 shadow" 
                    : "text-white/80 hover:text-white"
                )}
              >
                <Globe size={14} />
                单词
              </button>
            </div>
            
            <button
              onClick={() => setShowHints(!showHints)}
              className="p-2 rounded-lg"
              title={showHints ? "隐藏提示" : "显示提示"}
            >
              {showHints ? <Eye size={18} className="text-white" /> : <EyeOff size={18} className="text-white" />}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg">
              <X size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-200">
          <div
            className={cn(
              "h-full duration-300",
              mode === 'question' 
                ? "bg-gradient-to-r from-purple-500 to-pink-500" 
                : "bg-gradient-to-r from-blue-500 to-cyan-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Stats */}
        <div className="px-4 py-2 flex items-center justify-center gap-6 text-sm border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-1">
            <Check size={14} className="text-green-500" />
            <span className="text-gray-600">
              认识: <strong className="text-green-500">{knownCount}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <XIcon size={14} className="text-red-500" />
            <span className="text-gray-600">
              不认识: <strong className="text-red-500">{unknownCount}</strong>
            </span>
          </div>
          <div className="text-xs text-gray-400">剩余: {cards.length - knownCount - unknownCount}</div>
        </div>

        {/* Card Container */}
        <div className="p-6">
          {isLoading ? (
            <div className="h-80 rounded-xl flex items-center justify-center bg-gray-100">
              <div className={cn(
                "animate-spin w-8 h-8 border-4 border-t-transparent rounded-full",
                mode === 'question' ? "border-purple-500" : "border-blue-500"
              )} />
            </div>
          ) : cards.length === 0 ? (
            <div className="h-80 rounded-xl flex flex-col items-center justify-center bg-gray-100 text-gray-500">
              {mode === 'question' ? (
                <>
                  <BookOpen size={48} className="mb-3 text-gray-300" />
                  <p>暂无题目卡片</p>
                  <p className="text-sm text-gray-400 mt-1">请先导入题目</p>
                </>
              ) : (
                <>
                  <Globe size={48} className="mb-3 text-gray-300" />
                  <p>暂无单词卡片</p>
                  <p className="text-sm text-gray-400 mt-1">请先添加词库到我的词库</p>
                </>
              )}
            </div>
          ) : currentCard?.type === 'question' ? (
            /* 题目卡片 */
            <div className="relative h-80 cursor-pointer perspective-1000" onClick={handleFlip}>
              <div
                className={cn(
                  "absolute inset-0 rounded-xl shadow-lg transition-transform duration-500 transform-style-preserve-3d",
                  isFlipped ? "rotate-y-180" : ""
                )}
              >
                {/* 正面：题目 + 选项 */}
                <div
                  className={cn(
                    "absolute inset-0 rounded-xl p-5 backface-hidden flex flex-col bg-gradient-to-br from-purple-50 to-pink-50 overflow-auto",
                    knownCards.has(currentCard?.id || '') && "ring-2 ring-green-500",
                    unknownCards.has(currentCard?.id || '') && "ring-2 ring-red-500"
                  )}
                >
                  <div className="mb-4">
                    <p className="text-base font-medium text-gray-800 leading-relaxed">{currentCard?.question}</p>
                  </div>

                  {currentCard?.options && currentCard.options.length > 0 && (
                    <div className="flex-1 space-y-2">
                      {currentCard.options.map((opt) => (
                        <div
                          key={opt.label}
                          className="flex items-start gap-2 p-2.5 rounded-lg bg-white/60 border border-gray-200/50"
                        >
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-sm font-medium flex items-center justify-center">
                            {opt.label}
                          </span>
                          <span className="text-sm text-gray-700 leading-relaxed">{opt.content}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentCard?.tags && currentCard.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-gray-200/50">
                      {currentCard.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-white/80 text-gray-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {showHints && <p className="text-center text-xs mt-3 text-gray-400">点击卡片查看答案</p>}
                </div>

                {/* 背面：答案 + 解析 */}
                <div className="absolute inset-0 rounded-xl p-5 backface-hidden rotate-y-180 flex flex-col bg-gradient-to-br from-green-50 to-emerald-50 overflow-auto">
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Check size={18} className="text-green-500" />
                      <span className="text-sm font-medium text-gray-600">正确答案</span>
                    </div>
                    <div className="p-3 rounded-lg bg-green-100/80 border border-green-200">
                      <p className="text-lg font-bold text-green-700">{currentCard?.correctAnswer || '无'}</p>
                    </div>
                  </div>

                  {currentCard?.explanation && (
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye size={16} className="text-gray-500" />
                        <span className="text-sm font-medium text-gray-600">解析</span>
                      </div>
                      <div className="p-3 rounded-lg bg-white/60 border border-gray-200/50">
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {currentCard.explanation}
                        </p>
                      </div>
                    </div>
                  )}

                  {showHints && <p className="text-center text-xs mt-3 text-gray-400">点击卡片返回题目</p>}
                </div>
              </div>
            </div>
          ) : (
            /* 单词卡片 */
            <div className="relative h-80 cursor-pointer perspective-1000" onClick={handleFlip}>
              <div
                className={cn(
                  "absolute inset-0 rounded-xl shadow-lg transition-transform duration-500 transform-style-preserve-3d",
                  isFlipped ? "rotate-y-180" : ""
                )}
              >
                {/* 正面：单词 + 音标 */}
                <div
                  className={cn(
                    "absolute inset-0 rounded-xl p-6 backface-hidden flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50",
                    knownCards.has(currentCard?.id || '') && "ring-2 ring-green-500",
                    unknownCards.has(currentCard?.id || '') && "ring-2 ring-red-500"
                  )}
                >
                  <h2 className="text-5xl font-bold text-gray-800 mb-4">{currentCard?.word}</h2>
                  
                  {currentCard?.phonetic && (
                    <p className="text-xl text-gray-500 mb-4">/{currentCard.phonetic}/</p>
                  )}
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentCard?.word) playWordAudio(currentCard.word);
                    }}
                    className="p-3 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors"
                  >
                    <Volume2 size={24} />
                  </button>

                  {showHints && <p className="text-center text-xs mt-6 text-gray-400">点击卡片查看释义</p>}
                </div>

                {/* 背面：释义 + 短语 */}
                <div className="absolute inset-0 rounded-xl p-6 backface-hidden rotate-y-180 flex flex-col bg-gradient-to-br from-green-50 to-emerald-50 overflow-auto">
                  <div className="text-center mb-4">
                    <h3 className="text-2xl font-bold text-gray-800 mb-1">{currentCard?.word}</h3>
                    {currentCard?.phonetic && (
                      <p className="text-gray-500">/{currentCard.phonetic}/</p>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="p-4 rounded-xl bg-white/60 border border-gray-200/50 mb-4">
                      <p className="text-lg text-gray-700 leading-relaxed">{currentCard?.translations}</p>
                    </div>
                    
                    {currentCard?.phrases && currentCard.phrases.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-2">常用短语</p>
                        <div className="space-y-2">
                          {currentCard.phrases.map((phrase, idx) => (
                            <div key={idx} className="p-2 rounded-lg bg-white/40 text-sm text-gray-600">
                              {phrase}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {showHints && <p className="text-center text-xs mt-3 text-gray-400">点击卡片返回单词</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="flex justify-center gap-4 mb-4">
            <Button
              variant="secondary"
              onClick={handleUnknown}
              disabled={!currentCard}
              className="flex-1 max-w-32 bg-red-50 text-red-600 border-red-200"
              leftIcon={<XIcon size={18} />}
            >
              不认识
            </Button>
            <Button
              variant="secondary"
              onClick={handleKnown}
              disabled={!currentCard}
              className="flex-1 max-w-32 bg-green-50 text-green-600 border-green-200"
              leftIcon={<Check size={18} />}
            >
              认识
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button onClick={handleShuffle} className="p-2 rounded-lg text-gray-600" title="随机打乱">
                <Shuffle size={18} />
              </button>
              <button onClick={handleReset} className="p-2 rounded-lg text-gray-600" title="重新开始">
                <RotateCcw size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className={cn("p-2 rounded-lg text-gray-600", currentIndex === 0 ? "opacity-50 cursor-not-allowed" : "")}
              >
                <ChevronLeft size={24} />
              </button>
              <span className="text-sm font-medium min-w-[60px] text-center text-gray-700">
                {cards.length > 0 ? `${currentIndex + 1}/${cards.length}` : '-'}
              </span>
              <button
                onClick={handleNext}
                disabled={currentIndex === cards.length - 1}
                className={cn(
                  "p-2 rounded-lg text-gray-600",
                  currentIndex === cards.length - 1 ? "opacity-50 cursor-not-allowed" : ""
                )}
              >
                <ChevronRight size={24} />
              </button>
            </div>

            <div className="text-xs text-gray-400">←→ 翻页 | 1 认识 | 2 不认识</div>
          </div>
        </div>
      </div>
    </AnimatedModal>
  );
}
