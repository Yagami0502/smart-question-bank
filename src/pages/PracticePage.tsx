import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from '../hooks/useAsyncQuery';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  Target,
  Flame,
  Brain,
  Bookmark,
  BookmarkCheck,
  Zap,
  GraduationCap,
  AlertTriangle,
  Timer,
  Volume2,
  VolumeX,
  Keyboard,
  Star,
  Award,
  Flag,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { CircularProgress } from '../components/ui/Progress';
import { useAppStore } from '../stores/appStore';
import { questionOperations } from '../lib/database';
import { favoriteOperations } from '../lib/database-mysql';
import { convertSingleToMulti } from '../lib/ai-service';
import { cn, formatDuration } from '../lib/utils';

interface PracticePageProps {
  onBack: () => void;
}

// 模式配置
const MODE_CONFIG = {
  smart: {
    name: '智能复习',
    icon: Brain,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    description: '基于艾宾浩斯遗忘曲线，智能安排复习',
    showMemoryStrength: true,
    showNextReview: true,
    canSkip: true,
    showAnswerImmediately: true,
    hasTimeLimit: false,
  },
  new: {
    name: '学习新题',
    icon: Sparkles,
    color: 'from-yellow-500 to-amber-500',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-200',
    description: '探索未知领域，开启全新学习旅程',
    showMemoryStrength: false,
    showNextReview: true,
    canSkip: true,
    showAnswerImmediately: true,
    hasTimeLimit: false,
  },
  review: {
    name: '一键刷题',
    icon: RefreshCw,
    color: 'from-blue-500 to-indigo-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    description: '复习题库中所有题目，全面巩固知识体系',
    showMemoryStrength: true,
    showNextReview: true,
    canSkip: true,
    showAnswerImmediately: true,
    hasTimeLimit: false,
  },
  cram: {
    name: '强化突击',
    icon: Zap,
    color: 'from-orange-500 to-red-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    description: '错题优先，快速突破薄弱环节',
    showMemoryStrength: false,
    showNextReview: false,
    canSkip: true,
    showAnswerImmediately: true,
    hasTimeLimit: false,
  },
  exam: {
    name: '模拟考试',
    icon: GraduationCap,
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    description: '模拟真实考试，答完后统一显示结果',
    showMemoryStrength: false,
    showNextReview: false,
    canSkip: true, // 可以跳题
    showAnswerImmediately: false,
    hasTimeLimit: true,
    totalTimeMinutes: 60, // 总时长60分钟
  },
};

export default function PracticePage({ onBack }: PracticePageProps) {
  const { session, submitAnswer, rateCard, nextCard, endSession } = useAppStore();
  
  // 基础状态
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [textAnswer, setTextAnswer] = useState(''); // 简答题文本答案
  const [fillAnswers, setFillAnswers] = useState<string[]>([]); // 填空题答案数组
  const [showAnswer, setShowAnswer] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionStats, setSessionStats] = useState<{
    total: number;
    correct: number;
    accuracy: number;
    duration: number;
  } | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<{
    isCorrect: boolean;
    message: string;
    tip: string;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // 新增功能状态
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [, setShowHint] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [comboCount, setComboCount] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [examTimeLeft, setExamTimeLeft] = useState(0);
  const [examAnswers, setExamAnswers] = useState<Map<string, string[]>>(new Map());
  const [showExamReview, setShowExamReview] = useState(false);
  const [markedQuestions, setMarkedQuestions] = useState<Set<string>>(new Set());
  const [showQuestionNav, setShowQuestionNav] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [, setExamStartTime] = useState<number | null>(null);
  const examStartTimeRef = useRef<number | null>(null);
  const [examResults, setExamResults] = useState<{
    answers: Map<string, { 
      selected: string[]; 
      correct: string[]; 
      correctAnswer: string; 
      isCorrect: boolean; 
      explanation?: string;
      isConverted?: boolean;
      questionContent?: string;
      questionOptions?: Array<{ id: string; text: string; isCorrect: boolean }>;
      originalAnswer?: string;
    }>;
    score: number;
    total: number;
    timeTaken: number;
  } | null>(null);
  
  // 考试模式：转换后的多选题数据
  const [convertedQuestions, setConvertedQuestions] = useState<Map<string, {
    content: string;
    options: string[];
    correctAnswer: string[];
    explanation: string;
    originalAnswer: string;
  }>>(new Map());
  const [isConvertingQuestions, setIsConvertingQuestions] = useState(false);
  const [conversionProgress, setConversionProgress] = useState({ current: 0, total: 0 });
  
  // 获取模式配置
  const mode = session?.mode || 'smart';
  const modeConfig = MODE_CONFIG[mode as keyof typeof MODE_CONFIG] || MODE_CONFIG.smart;
  const ModeIcon = modeConfig.icon;

  // 获取当前卡片对应的问题
  const currentCard = session?.cards[session.currentIndex];
  const currentQuestion = useLiveQuery(
    () => currentCard ? questionOperations.getById(currentCard.questionId) : undefined,
    [currentCard?.questionId]
  );

  // 计时器 - 持续计时直到会话结束
  useEffect(() => {
    if (!sessionComplete && !examSubmitted) {
      const timer = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
      return () => clearInterval(timer);
    }
  }, [startTime, sessionComplete, examSubmitted]);

  // 考试模式：初始化时转换多选题
  useEffect(() => {
    if (mode === 'exam' && session && session.convertedQuestions && session.convertedQuestions.size > 0 && !isConvertingQuestions && convertedQuestions.size === 0) {
      const convertQuestions = async () => {
        setIsConvertingQuestions(true);
        const toConvert: Array<{ id: string; question: any }> = [];
        
        // 收集需要转换的题目
        session.convertedQuestions!.forEach((data: any, questionId: string) => {
          if (data.needsConversion && data.originalQuestion) {
            toConvert.push({ id: questionId, question: data.originalQuestion });
          }
        });
        
        if (toConvert.length === 0) {
          setIsConvertingQuestions(false);
          return;
        }
        
        setConversionProgress({ current: 0, total: toConvert.length });
        
        const newConverted = new Map<string, any>();
        
        // 辅助函数：安全获取文本内容
        const getTextContent = (content: any): string => {
          if (!content) return '';
          if (typeof content === 'string') return content;
          if (typeof content === 'object' && content.text) return content.text;
          return String(content);
        };
        
        // 辅助函数：安全获取选项文本数组
        const getOptionsText = (options: any[]): string[] => {
          if (!Array.isArray(options)) return [];
          return options.map(o => {
            if (!o) return '';
            // 选项可能是 { id, content: { text }, isCorrect } 或 { id, content: string, isCorrect }
            if (o.content) {
              return getTextContent(o.content);
            }
            if (o.text) return o.text;
            return String(o);
          });
        };
        
        // 辅助函数：获取正确答案字母
        const getCorrectAnswerLetter = (question: any): string => {
          // 优先使用 answer 字段
          if (question.answer) {
            const ans = Array.isArray(question.answer) ? question.answer[0] : question.answer;
            // 如果已经是字母，直接返回
            if (/^[A-Z]$/i.test(ans)) return ans.toUpperCase();
          }
          // 从选项中找正确答案
          if (Array.isArray(question.options)) {
            const correctIndex = question.options.findIndex((o: any) => o.isCorrect);
            if (correctIndex >= 0) {
              return String.fromCharCode(65 + correctIndex); // A, B, C, D...
            }
          }
          return 'A'; // 默认
        };
        
        for (let i = 0; i < toConvert.length; i++) {
          const { id, question } = toConvert[i];
          setConversionProgress({ current: i + 1, total: toConvert.length });
          
          try {
            const contentText = getTextContent(question.content);
            const optionsText = getOptionsText(question.options);
            const correctAnswer = getCorrectAnswerLetter(question);
            
            console.log(`转换题目 ${i + 1}/${toConvert.length}:`, { contentText: contentText.substring(0, 50), optionsText, correctAnswer });
            
            if (!contentText || optionsText.length === 0) {
              console.warn('题目内容或选项为空，跳过:', id);
              continue;
            }
            
            const result = await convertSingleToMulti(
              contentText,
              optionsText,
              correctAnswer,
              question.explanation
            );
            
            if (result) {
              newConverted.set(id, {
                content: result.content,
                options: result.options,
                correctAnswer: result.correctAnswer,
                explanation: result.explanation,
                originalAnswer: result.originalAnswer,
              });
              console.log(`题目 ${id} 转换成功`);
            } else {
              console.log(`题目 ${id} 不适合反转，保持单选题`);
            }
          } catch (error) {
            console.error('转换题目失败:', id, error);
          }
        }
        
        setConvertedQuestions(newConverted);
        setIsConvertingQuestions(false);
        console.log(`转换完成，共 ${newConverted.size} 道题`);
      };
      
      convertQuestions();
    }
  }, [mode, session?.convertedQuestions, isConvertingQuestions, convertedQuestions.size]);

  // 当新考试开始时重置开始时间
  useEffect(() => {
    if (mode === 'exam' && session?.startTime) {
      // 使用 session.startTime 作为考试开始时间的基准
      examStartTimeRef.current = session.startTime;
      setExamStartTime(session.startTime);
    }
  }, [mode, session?.startTime]);

  // 模拟考试倒计时
  useEffect(() => {
    if (mode === 'exam' && session && !examSubmitted && !sessionComplete) {
      // 使用考试配置中的时间限制，如果没有配置则每题1分钟
      const examConfig = session.examConfig;
      const timeLimitMinutes = examConfig?.timeLimit || 0;
      
      // 如果时间限制为0，表示无限制
      if (timeLimitMinutes === 0) {
        setExamTimeLeft(0); // 0表示无限制
        return;
      }
      
      const totalSeconds = timeLimitMinutes * 60;
      setExamTimeLeft(totalSeconds);
      
      const timer = setInterval(() => {
        setExamTimeLeft(prev => {
          if (prev <= 1) {
            // 时间到，自动交卷
            handleExamSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [mode, session?.startTime, examSubmitted, sessionComplete]);

  // 重置题目状态
  useEffect(() => {
    if (currentCard && mode !== 'exam') {
      setSelectedOptions([]);
      setTextAnswer(''); // 重置简答题答案
      setFillAnswers([]); // 重置填空题答案
      setShowAnswer(false);
      // 不重置 startTime，保持会话开始时间不变
    }
    // 考试模式：恢复之前的答案
    if (currentCard && mode === 'exam') {
      const savedAnswer = examAnswers.get(currentCard.questionId);
      setSelectedOptions(savedAnswer || []);
      setTextAnswer('');
      setFillAnswers([]);
      setShowAnswer(false);
    }
  }, [currentCard?.id, mode]);
  
  // 从题目内容中提取填空数量
  const getFillBlanksCount = (content: string): number => {
    // 匹配 （ ）、( )、____、___、__ 等填空标记
    const patterns = [
      /（\s*）/g,
      /\(\s*\)/g,
      /_{2,}/g,
      /\[\s*\]/g,
    ];
    let count = 0;
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) count += matches.length;
    }
    return Math.max(count, 1); // 至少1个空
  };

  // 检查当前题目是否已收藏
  useEffect(() => {
    if (currentCard) {
      favoriteOperations.isFavorite(currentCard.questionId)
        .then(isFav => setIsBookmarked(isFav))
        .catch(() => setIsBookmarked(false));
    }
  }, [currentCard?.questionId]);

  // 切换收藏状态
  const toggleFavorite = async () => {
    if (!currentCard || !session) return;
    try {
      if (isBookmarked) {
        await favoriteOperations.remove(currentCard.questionId);
        setIsBookmarked(false);
      } else {
        await favoriteOperations.add(currentCard.questionId, session.deckId);
        setIsBookmarked(true);
      }
    } catch (error) {
      console.error('收藏操作失败:', error);
    }
  };

  // 检查会话是否结束
  useEffect(() => {
    if (session && session.currentIndex >= session.cards.length) {
      const stats = endSession();
      if (stats) {
        setSessionStats({
          total: stats.totalCards,
          correct: stats.correctCount,
          accuracy: stats.accuracy,
          duration: elapsedTime // 使用实际经过的时间，与答题页面顶部显示一致
        });
      }
      setSessionComplete(true);
    }
  }, [session?.currentIndex, elapsedTime]);

  // 考试模式：跳转到指定题目（移到键盘事件之前）
  const goToQuestion = useCallback((index: number) => {
    if (!session || index < 0 || index >= session.cards.length) return;
    // 保存当前答案
    if (currentCard && selectedOptions.length > 0) {
      setExamAnswers(prev => new Map(prev).set(currentCard.questionId, selectedOptions));
    }
    // 手动设置 session 的 currentIndex
    useAppStore.setState(state => ({
      session: state.session ? { ...state.session, currentIndex: index } : null
    }));
  }, [session, currentCard, selectedOptions]);

  // 考试模式：标记题目
  const toggleMarkQuestion = useCallback(() => {
    if (!currentCard) return;
    setMarkedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(currentCard.questionId)) {
        newSet.delete(currentCard.questionId);
      } else {
        newSet.add(currentCard.questionId);
      }
      return newSet;
    });
  }, [currentCard]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showKeyboardHelp || sessionComplete || examSubmitted) return;
      
      // 考试模式下的特殊处理
      const isExamMode = mode === 'exam';
      
      // 数字键选择选项
      if (['1', '2', '3', '4', '5', '6'].includes(e.key) && currentQuestion) {
        // 非考试模式下，已显示答案时不能选择
        if (!isExamMode && showAnswer) return;
        
        // 获取当前显示的选项（可能是转换后的多选题）
        const displayOptions = currentCard && convertedQuestions.has(currentCard.questionId)
          ? convertedQuestions.get(currentCard.questionId)!.options.map((_, idx) => ({
              id: String.fromCharCode(65 + idx)
            }))
          : currentQuestion.options;
        
        const index = parseInt(e.key) - 1;
        if (index < displayOptions.length) {
          const optionId = displayOptions[index].id;
          handleOptionClick(optionId);
        }
      }
      
      // Enter 确认答案 / 下一题
      if (e.key === 'Enter') {
        e.preventDefault();
        if (isExamMode) {
          // 考试模式：跳转到下一题
          if (session && session.currentIndex < session.cards.length - 1) {
            goToQuestion(session.currentIndex + 1);
          }
        } else if (!showAnswer && selectedOptions.length > 0) {
          // 非考试模式：显示答案
          handleShowAnswer();
        } else if (showAnswer) {
          // 非考试模式：下一题
          handleNext();
        }
      }
      
      // 空格键下一题
      if (e.key === ' ') {
        e.preventDefault();
        if (isExamMode) {
          // 考试模式：跳转到下一题
          if (session && session.currentIndex < session.cards.length - 1) {
            goToQuestion(session.currentIndex + 1);
          }
        } else if (showAnswer) {
          handleNext();
        }
      }
      
      // 左右箭头键切换题目（考试模式）
      if (isExamMode && session) {
        if (e.key === 'ArrowLeft' && session.currentIndex > 0) {
          e.preventDefault();
          goToQuestion(session.currentIndex - 1);
        }
        if (e.key === 'ArrowRight' && session.currentIndex < session.cards.length - 1) {
          e.preventDefault();
          goToQuestion(session.currentIndex + 1);
        }
      }
      
      // B 收藏
      if (e.key === 'b' || e.key === 'B') {
        toggleFavorite();
      }
      
      // H 显示提示
      if (e.key === 'h' || e.key === 'H') {
        setShowHint((prev: boolean) => !prev);
      }
      
      // M 标记题目（考试模式）
      if ((e.key === 'm' || e.key === 'M') && isExamMode) {
        toggleMarkQuestion();
      }
      
      // ? 显示快捷键帮助
      if (e.key === '?') {
        setShowKeyboardHelp(true);
      }
      
      // Esc 关闭弹窗
      if (e.key === 'Escape') {
        setShowKeyboardHelp(false);
        setShowHint(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, currentCard, showAnswer, selectedOptions, showKeyboardHelp, sessionComplete, examSubmitted, mode, session, convertedQuestions, goToQuestion]);

  const handleOptionClick = (optionId: string) => {
    if (showAnswer && mode !== 'exam') return;
    if (examSubmitted) return;
    
    // 检查是否是转换后的多选题或原本就是多选题
    const isMultiChoice = currentQuestion?.type === 'MULTI' || 
      (currentCard && convertedQuestions.has(currentCard.questionId));
    
    let newSelection: string[];
    if (isMultiChoice) {
      // 多选
      newSelection = selectedOptions.includes(optionId) 
        ? selectedOptions.filter(id => id !== optionId)
        : [...selectedOptions, optionId];
    } else {
      // 单选
      newSelection = [optionId];
    }
    
    setSelectedOptions(newSelection);
    
    // 考试模式：保存答案
    if (mode === 'exam' && currentCard) {
      setExamAnswers(prev => new Map(prev).set(currentCard.questionId, newSelection));
    }
  };

  // 考试模式：交卷
  const handleExamSubmit = useCallback(async () => {
    if (!session || examSubmitted) return;
    
    // 保存当前答案
    if (currentCard && selectedOptions.length > 0) {
      examAnswers.set(currentCard.questionId, selectedOptions);
    }
    
    setExamSubmitted(true);
    
    // 计算成绩
    const results = new Map<string, { 
      selected: string[]; 
      correct: string[]; 
      correctAnswer: string; 
      isCorrect: boolean; 
      explanation?: string; 
      isConverted?: boolean;
      questionContent?: string;
      questionOptions?: Array<{ id: string; text: string; isCorrect: boolean }>;
      originalAnswer?: string;
    }>();
    let correctCount = 0;
    
    for (const card of session.cards) {
      const question = await questionOperations.getById(card.questionId);
      if (!question) continue;
      
      const selected = examAnswers.get(card.questionId) || [];
      
      // 检查是否是转换后的多选题
      const convertedData = convertedQuestions.get(card.questionId);
      
      let correct: string[];
      let correctAnswer: string;
      let explanation: string | undefined;
      let isConverted = false;
      
      if (convertedData) {
        // 转换后的多选题
        correct = convertedData.correctAnswer;
        correctAnswer = correct.join(', ');
        explanation = convertedData.explanation;
        isConverted = true;
      } else {
        // 原始题目
        correct = question.options.filter(o => o.isCorrect).map(o => o.id);
        correctAnswer = Array.isArray(question.answer) 
          ? question.answer.join(', ') 
          : (question.answer || correct.join(', '));
        explanation = question.explanation;
      }
      
      // 未作答一律算错；有作答时才比对答案
      const isCorrect = selected.length > 0 && 
        correct.length > 0 &&
        selected.length === correct.length && 
        selected.every(id => correct.includes(id));
      
      // 获取题目内容和选项
      const questionContent = convertedData 
        ? convertedData.content 
        : (typeof question.content === 'string' ? question.content : question.content.text);
      
      const questionOptions = convertedData
        ? convertedData.options.map((text, idx) => ({
            id: String.fromCharCode(65 + idx),
            text,
            isCorrect: convertedData.correctAnswer.includes(String.fromCharCode(65 + idx))
          }))
        : question.options.map(opt => ({
            id: opt.id,
            text: typeof opt.content === 'string' ? opt.content : opt.content.text,
            isCorrect: opt.isCorrect
          }));
      
      results.set(card.questionId, { 
        selected, 
        correct, 
        correctAnswer,
        isCorrect,
        explanation,
        isConverted,
        questionContent,
        questionOptions,
        originalAnswer: convertedData?.originalAnswer
      });
      if (isCorrect) correctCount++;
    }
    
    // 使用实际经过的时间（更准确）
    const timeTaken = examStartTimeRef.current 
      ? Math.floor((Date.now() - examStartTimeRef.current) / 1000)
      : Math.max(0, session.cards.length * 60 - examTimeLeft);
    
    setExamResults({
      answers: results,
      score: correctCount,
      total: session.cards.length,
      timeTaken
    });
  }, [session, currentCard, selectedOptions, examAnswers, examTimeLeft, examSubmitted, convertedQuestions]);

  // 自动分析答案并评分
  const handleShowAnswer = async () => {
    if (!currentQuestion) return;
    
    setIsAnalyzing(true);
    setShowAnswer(true);
    
    // 检查答案是否正确
    let isAnswerCorrect = false;
    
    if (currentQuestion.type === 'SHORT_ANSWER') {
      // 简答题：简单的文本匹配（忽略大小写和首尾空格）
      const userAnswer = textAnswer.trim().toLowerCase();
      const correctAnswer = Array.isArray(currentQuestion.answer) 
        ? currentQuestion.answer.map(a => a.trim().toLowerCase())
        : [currentQuestion.answer.trim().toLowerCase()];
      
      // 检查用户答案是否包含任一正确答案（宽松匹配）
      isAnswerCorrect = correctAnswer.some(ans => 
        userAnswer.includes(ans) || ans.includes(userAnswer)
      );
    } else if (currentQuestion.type === 'FILL') {
      // 填空题：逐个检查每个空的答案
      const correctAnswers = Array.isArray(currentQuestion.answer) 
        ? currentQuestion.answer 
        : [currentQuestion.answer];
      
      // 所有填空都正确才算正确
      isAnswerCorrect = correctAnswers.every((correct, index) => {
        const userAns = (fillAnswers[index] || '').trim().toLowerCase();
        const correctAns = correct.trim().toLowerCase();
        return userAns === correctAns;
      });
    } else {
      // 选择题：检查选项
      const correctOptions = currentQuestion.options
        .filter(o => o.isCorrect)
        .map(o => o.id);
      
      isAnswerCorrect = 
        selectedOptions.length === correctOptions.length &&
        selectedOptions.every(id => correctOptions.includes(id));
    }
    
    // 生成AI反馈
    let feedback: { isCorrect: boolean; message: string; tip: string };
    
    if (isAnswerCorrect) {
      const messages = [
        { message: '太棒了！完全正确！', tip: '继续保持这种状态，你正在进步！' },
        { message: '答对了！你很棒！', tip: '知识掌握得很好，再接再厉！' },
        { message: '正确！做得好！', tip: '这道题你已经掌握了，可以挑战更难的题目。' },
        { message: '完美！', tip: '你的理解非常到位！' },
      ];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      feedback = { isCorrect: true, ...randomMsg };
    } else {
      const messages = [
        { message: '这道题答错了', tip: '不要灰心，仔细看看解析，下次一定能答对！' },
        { message: '还需要加强', tip: '错误是学习的机会，记住这个知识点！' },
        { message: '答案不正确', tip: '建议多复习这类题目，加深印象。' },
        { message: '继续努力', tip: '每一次错误都是进步的阶梯！' },
      ];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      feedback = { isCorrect: false, ...randomMsg };
    }
    
    setAnswerFeedback(feedback);
    setIsAnalyzing(false);
    
    // 更新连击计数
    if (isAnswerCorrect) {
      setComboCount(prev => {
        const newCombo = prev + 1;
        if (newCombo > maxCombo) setMaxCombo(newCombo);
        return newCombo;
      });
      // 计算获得的经验值 (基础10 + 连击奖励)
      const baseXp = 10;
      const comboBonus = Math.min(comboCount * 2, 20);
      setXpGained(prev => prev + baseXp + comboBonus);
    } else {
      setComboCount(0);
    }
    
    // 先提交答案记录
    submitAnswer(selectedOptions);
    
    // 根据答案正确性自动评分
    const autoRating = isAnswerCorrect ? 'good' : 'again';
    await rateCard(autoRating);
  };
  
  // 进入下一题
  const handleNext = () => {
    setAnswerFeedback(null);
    nextCard();
  };


  const isSelected = (optionId: string) => {
    return selectedOptions.includes(optionId);
  };

  // 会话完成页面
  if (sessionComplete && sessionStats) {
    // 计算评价等级
    const getGrade = () => {
      if (sessionStats.accuracy >= 0.9) return { grade: 'S', color: 'from-yellow-400 to-amber-500', text: '完美表现！' };
      if (sessionStats.accuracy >= 0.8) return { grade: 'A', color: 'from-green-400 to-emerald-500', text: '非常出色！' };
      if (sessionStats.accuracy >= 0.7) return { grade: 'B', color: 'from-blue-400 to-cyan-500', text: '表现不错！' };
      if (sessionStats.accuracy >= 0.6) return { grade: 'C', color: 'from-orange-400 to-amber-500', text: '继续加油！' };
      return { grade: 'D', color: 'from-red-400 to-pink-500', text: '需要更多练习' };
    };
    const gradeInfo = getGrade();
    
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center p-6",
        mode === 'smart' && "bg-gradient-to-br from-blue-50 to-cyan-50",
        mode === 'cram' && "bg-gradient-to-br from-orange-50 to-red-50",
        mode === 'exam' && "bg-gradient-to-br from-purple-50 to-pink-50"
      )}>
        <Card className="max-w-lg w-full">
          <CardContent className="py-8 text-center">
            {/* 模式标识 */}
            <div className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4",
              modeConfig.bgColor
            )}>
              <ModeIcon size={16} className={modeConfig.textColor} />
              <span className={cn("text-sm font-medium", modeConfig.textColor)}>
                {modeConfig.name}
              </span>
            </div>
            
            {/* 评级展示 */}
            <div className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg bg-gradient-to-br",
              gradeInfo.color
            )}>
              <span className="text-4xl font-black text-white">{gradeInfo.grade}</span>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-1">练习完成！</h2>
            <p className="text-gray-500 mb-6">{gradeInfo.text}</p>
            
            {/* Stats Grid - 6格展示 */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-3 bg-gray-50 rounded-xl">
                <Target className="w-5 h-5 text-primary-500 mx-auto mb-1" />
                <div className="text-xl font-bold text-gray-900">{sessionStats.total}</div>
                <div className="text-xs text-gray-500">完成题目</div>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
                <div className="text-xl font-bold text-green-600">
                  {Math.round(sessionStats.accuracy * 100)}%
                </div>
                <div className="text-xs text-gray-500">正确率</div>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <Clock className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                <div className="text-xl font-bold text-blue-600">
                  {formatDuration(sessionStats.duration)}
                </div>
                <div className="text-xs text-gray-500">用时</div>
              </div>
              <div className="p-3 bg-yellow-50 rounded-xl">
                <Flame className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
                <div className="text-xl font-bold text-yellow-600">{maxCombo}</div>
                <div className="text-xs text-gray-500">最大连击</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl">
                <Star className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                <div className="text-xl font-bold text-purple-600">+{xpGained}</div>
                <div className="text-xs text-gray-500">获得经验</div>
              </div>
              <div className="p-3 bg-pink-50 rounded-xl">
                <Award className="w-5 h-5 text-pink-500 mx-auto mb-1" />
                <div className="text-xl font-bold text-pink-600">{sessionStats.correct}</div>
                <div className="text-xs text-gray-500">答对题数</div>
              </div>
            </div>

            {/* Accuracy Ring */}
            <div className="mb-6">
              <CircularProgress 
                value={sessionStats.accuracy * 100} 
                size={100}
                strokeWidth={10}
                color={sessionStats.accuracy >= 0.8 ? '#22c55e' : sessionStats.accuracy >= 0.6 ? '#f59e0b' : '#ef4444'}
              />
            </div>
            
            {/* 鼓励语 */}
            {maxCombo >= 5 && (
              <div className="mb-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200">
                <div className="flex items-center justify-center gap-2 text-yellow-700">
                  <Sparkles size={16} />
                  <span className="text-sm font-medium">🎉 太厉害了！{maxCombo}连击！</span>
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <Button variant="secondary" onClick={onBack} className="min-w-[140px]">
                返回首页
              </Button>
              <Button onClick={onBack} className="min-w-[140px]">
                继续学习
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 考试结果页面
  if (mode === 'exam' && examSubmitted && examResults) {
    const percentage = Math.round((examResults.score / examResults.total) * 100);
    const getGrade = () => {
      if (percentage >= 90) return { grade: 'A', color: 'from-green-400 to-emerald-500', text: '优秀！' };
      if (percentage >= 80) return { grade: 'B', color: 'from-blue-400 to-cyan-500', text: '良好！' };
      if (percentage >= 70) return { grade: 'C', color: 'from-yellow-400 to-amber-500', text: '中等' };
      if (percentage >= 60) return { grade: 'D', color: 'from-orange-400 to-red-400', text: '及格' };
      return { grade: 'F', color: 'from-red-500 to-pink-500', text: '不及格' };
    };
    // 计算单选题和多选题的分别统计
    let singleCorrect = 0, singleTotal = 0;
    let multiCorrect = 0, multiTotal = 0;
    examResults.answers.forEach((result: any) => {
      if (result.isConverted) {
        multiTotal++;
        if (result.isCorrect) multiCorrect++;
      } else {
        singleTotal++;
        if (result.isCorrect) singleCorrect++;
      }
    });
    const gradeInfo = getGrade();
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-6">
        <div className="max-w-4xl mx-auto">
          {/* 成绩卡片 */}
          <Card className="mb-6">
            <CardContent className="py-8 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full mb-6">
                <GraduationCap size={20} className="text-purple-600" />
                <span className="font-medium text-purple-700">模拟考试结果</span>
              </div>
              
              {/* 分数展示 */}
              <div className={cn(
                "w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg bg-gradient-to-br",
                gradeInfo.color
              )}>
                <div className="text-center">
                  <span className="text-4xl font-black text-white">{percentage}</span>
                  <span className="text-xl text-white/80">分</span>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{gradeInfo.text}</h2>
              <p className="text-gray-500 mb-6">
                共 {examResults.total} 题，答对 {examResults.score} 题
              </p>
              
              {/* 统计信息 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <div className="text-xs text-blue-600 mb-1">单选题</div>
                  <div className="text-2xl font-bold text-blue-700">{singleCorrect}/{singleTotal}</div>
                  <div className="text-sm text-gray-500">
                    {singleTotal > 0 ? Math.round(singleCorrect / singleTotal * 100) : 0}%
                  </div>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl">
                  <div className="text-xs text-purple-600 mb-1">多选题</div>
                  <div className="text-2xl font-bold text-purple-700">{multiCorrect}/{multiTotal}</div>
                  <div className="text-sm text-gray-500">
                    {multiTotal > 0 ? Math.round(multiCorrect / multiTotal * 100) : 0}%
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-600">{examResults.score}</div>
                  <div className="text-sm text-gray-500">正确</div>
                </div>
                <div className="p-4 bg-red-50 rounded-xl">
                  <XCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-red-600">{examResults.total - examResults.score}</div>
                  <div className="text-sm text-gray-500">错误</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl">
                  <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-600">{formatDuration(examResults.timeTaken * 1000)}</div>
                  <div className="text-sm text-gray-500">用时</div>
                </div>
              </div>
              
              <div className="flex gap-3 justify-center">
                <Button variant="secondary" onClick={onBack}>
                  返回首页
                </Button>
                <Button onClick={() => setShowExamReview(true)}>
                  查看答题详情
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* 答题详情 */}
          {showExamReview && (
            <Card>
              <CardContent className="py-6">
                <h3 className="font-semibold text-lg mb-4">答题详情</h3>
                <div className="space-y-6">
                  {session?.cards.map((card, index) => {
                    const result = examResults.answers.get(card.questionId) as any;
                    const isWrong = !result?.isCorrect;
                    const isConvertedQuestion = result?.isConverted;
                    return (
                      <div key={card.id} className={cn(
                        "p-4 rounded-xl border-2",
                        isWrong ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
                      )}>
                        {/* 题目头部 */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                            isWrong ? "bg-red-500" : "bg-green-500"
                          )}>
                            {isWrong ? (
                              <XCircle size={16} className="text-white" />
                            ) : (
                              <CheckCircle size={16} className="text-white" />
                            )}
                          </div>
                          <span className="font-medium text-gray-700">第 {index + 1} 题</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            isConvertedQuestion ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                          )}>
                            {isConvertedQuestion ? '多选题' : '单选题'}
                          </span>
                          {isConvertedQuestion && (
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                              由单选转换
                            </span>
                          )}
                        </div>
                        
                        {/* 题目内容 */}
                        <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                          <p className="text-gray-800">{result?.questionContent || '题目内容加载失败'}</p>
                        </div>
                        
                        {/* 选项列表 */}
                        {result?.questionOptions && (
                          <div className="space-y-2 mb-4">
                            {result.questionOptions.map((opt: any) => {
                              const isSelected = result.selected?.includes(opt.id);
                              const isCorrectOption = result.correct?.includes(opt.id);
                              return (
                                <div 
                                  key={opt.id}
                                  className={cn(
                                    "flex items-start gap-2 p-2 rounded-lg border",
                                    isCorrectOption && "bg-green-100 border-green-300",
                                    isSelected && !isCorrectOption && "bg-red-100 border-red-300",
                                    !isSelected && !isCorrectOption && "bg-white border-gray-200"
                                  )}
                                >
                                  <span className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0",
                                    isCorrectOption && "bg-green-500 text-white",
                                    isSelected && !isCorrectOption && "bg-red-500 text-white",
                                    !isSelected && !isCorrectOption && "bg-gray-200 text-gray-600"
                                  )}>
                                    {opt.id}
                                  </span>
                                  <span className={cn(
                                    "flex-1 text-sm",
                                    isCorrectOption && "text-green-700 font-medium",
                                    isSelected && !isCorrectOption && "text-red-700",
                                    !isSelected && !isCorrectOption && "text-gray-600"
                                  )}>
                                    {opt.text}
                                  </span>
                                  {isCorrectOption && (
                                    <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                                  )}
                                  {isSelected && !isCorrectOption && (
                                    <XCircle size={16} className="text-red-500 flex-shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* 答案对比 */}
                        <div className={cn(
                          "p-3 rounded-lg text-sm",
                          isWrong ? "bg-red-100" : "bg-green-100"
                        )}>
                          <div className="flex flex-wrap gap-4">
                            <div>
                              <span className="text-gray-600">你的答案：</span>
                              <span className={cn(
                                "font-medium ml-1",
                                isWrong ? "text-red-600" : "text-green-600"
                              )}>
                                {result?.selected?.length > 0 ? result.selected.join(', ') : '未作答'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">正确答案：</span>
                              <span className="font-medium text-green-600 ml-1">
                                {result?.correctAnswer || '无'}
                              </span>
                            </div>
                            {isConvertedQuestion && result?.originalAnswer && (
                              <div>
                                <span className="text-gray-500">原单选答案：</span>
                                <span className="text-gray-600 ml-1">{result.originalAnswer}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* 解析 */}
                        {result?.explanation && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="text-xs font-medium text-blue-700 mb-1">解析</div>
                            <div className="text-sm text-blue-800 whitespace-pre-line">{result.explanation}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  if (!session || !currentCard || !currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  // 考试模式：显示题目转换进度
  if (mode === 'exam' && isConvertingQuestions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="w-8 h-8 text-purple-600 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">正在准备考试题目</h2>
          <p className="text-gray-500 mb-6">AI 正在生成多选题，请稍候...</p>
          <div className="w-full bg-purple-100 rounded-full h-3 mb-2">
            <div 
              className="bg-purple-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${conversionProgress.total > 0 ? (conversionProgress.current / conversionProgress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-sm text-purple-600">
            {conversionProgress.current} / {conversionProgress.total} 道多选题
          </p>
        </div>
      </div>
    );
  }

  const progress = (session.currentIndex / session.cards.length) * 100;

  // 计算记忆强度 (用于智能复习模式)
  const memoryStrength = currentCard ? Math.min(100, (currentCard.easeFactor / 2.5) * (currentCard.reps / 5) * 100) : 0;
  
  // 获取难度标签
  const getDifficultyLabel = () => {
    if (!currentCard) return null;
    if (currentCard.lapses >= 3) return { label: '困难', color: 'bg-red-100 text-red-700' };
    if (currentCard.lapses >= 1) return { label: '较难', color: 'bg-orange-100 text-orange-700' };
    if (currentCard.reps >= 5) return { label: '熟练', color: 'bg-green-100 text-green-700' };
    if (currentCard.state === 'new') return { label: '新题', color: 'bg-blue-100 text-blue-700' };
    return null;
  };

  const difficultyInfo = getDifficultyLabel();

  return (
    <div className={cn(
      "min-h-screen transition-colors",
      mode === 'smart' && "bg-gradient-to-br from-blue-50 to-cyan-50",
      mode === 'cram' && "bg-gradient-to-br from-orange-50 to-red-50",
      mode === 'exam' && "bg-gradient-to-br from-purple-50 to-pink-50"
    )}>
      {/* Header - 液态玻璃效果 */}
      <header
        className="liquid-glass-wrapper liquid-glass-header sticky top-0 z-10"
        style={{ '--border-radius': '0' } as React.CSSProperties}
      >
        <div className="liquid-glass-outer" />
        <div className="liquid-glass-cover" />
        <div className="liquid-glass-sharp" />
        <div className="liquid-glass-reflect" />
        <div className="liquid-glass-content">
          <div className="max-w-4xl mx-auto px-6 py-3">
            {/* 顶部栏 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
              
                {/* 模式标识 */}
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full",
                modeConfig.bgColor
              )}>
                <ModeIcon size={16} className={modeConfig.textColor} />
                <span className={cn("text-sm font-medium", modeConfig.textColor)}>
                  {modeConfig.name}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* 连击显示 */}
              {comboCount > 1 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 rounded-full animate-pulse">
                  <Flame size={14} className="text-yellow-600" />
                  <span className="text-xs font-bold text-yellow-700">{comboCount}连击!</span>
                </div>
              )}
              
              {/* 计时器 - 考试模式显示倒计时（如果有时间限制）或已用时间 */}
              {mode === 'exam' ? (
                session?.examConfig?.timeLimit && session.examConfig.timeLimit > 0 ? (
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full font-mono",
                    examTimeLeft <= 300 ? "bg-red-500 text-white animate-pulse" : "bg-red-100 text-red-700"
                  )}>
                    <Timer size={18} />
                    <span className="text-base font-bold">
                      {Math.floor(examTimeLeft / 60)}:{String(examTimeLeft % 60).padStart(2, '0')}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700">
                    <Clock size={16} />
                    <span className="text-sm font-medium">{formatDuration(elapsedTime)}</span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 text-gray-600">
                  <Clock size={16} />
                  <span className="text-sm font-medium">{formatDuration(elapsedTime)}</span>
                </div>
              )}
              
              {/* 进度 */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/70 rounded-full">
                <Target size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  {session.currentIndex + 1} / {session.cards.length}
                </span>
              </div>
              
              {/* 工具栏按钮 */}
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleFavorite}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    isBookmarked ? "bg-yellow-100 text-yellow-600" : "hover:bg-white/50 text-gray-500"
                  )}
                  title="收藏题目"
                >
                  {isBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                </button>
                
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors text-gray-500"
                  title={soundEnabled ? "关闭音效" : "开启音效"}
                >
                  {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                
                <button
                  onClick={() => setShowKeyboardHelp(true)}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors text-gray-500"
                  title="键盘快捷键"
                >
                  <Keyboard size={18} />
                </button>
              </div>
            </div>
          </div>
          
          {/* 智能复习模式 - 记忆强度指示器 */}
          {mode === 'smart' && modeConfig.showMemoryStrength && (
            <div className="flex items-center gap-3 mt-2 px-2">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs text-blue-600">记忆强度</span>
                <div className="flex-1 h-2 bg-blue-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-500"
                    style={{ width: `${memoryStrength}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-blue-700">{Math.round(memoryStrength)}%</span>
              </div>
              {currentCard && currentCard.reps > 0 && (
                <div className="text-xs text-blue-600">
                  已复习 {currentCard.reps} 次
                </div>
              )}
            </div>
          )}
          
          {/* 强化突击模式 - 错题优先提示 */}
          {mode === 'cram' && currentCard && currentCard.lapses > 0 && (
            <div className="flex items-center gap-2 mt-2 px-2 py-1.5 bg-orange-100 rounded-lg">
              <AlertTriangle size={14} className="text-orange-600" />
              <span className="text-xs text-orange-700">
                这道题你已经错过 {currentCard.lapses} 次，要特别注意！
              </span>
            </div>
          )}
          
          {/* 模拟考试模式 - 倒计时警告（仅在有时间限制时显示） */}
          {mode === 'exam' && session?.examConfig?.timeLimit && session.examConfig.timeLimit > 0 && examTimeLeft > 0 && examTimeLeft < 10 && (
            <div className="flex items-center gap-2 mt-2 px-2 py-1.5 bg-red-100 rounded-lg animate-pulse">
              <Timer size={14} className="text-red-600" />
              <span className="text-xs text-red-700 font-medium">
                剩余 {examTimeLeft} 秒！
              </span>
            </div>
          )}
          </div>
          
          {/* Progress Bar */}
          <div className={cn(
            "h-1 w-full",
            mode === 'smart' && "bg-blue-100",
            mode === 'cram' && "bg-orange-100",
            mode === 'exam' && "bg-purple-100"
          )}>
            <div 
              className={cn(
                "h-full transition-all duration-300",
                mode === 'smart' && "bg-gradient-to-r from-blue-400 to-cyan-400",
                mode === 'cram' && "bg-gradient-to-r from-orange-400 to-red-400",
                mode === 'exam' && "bg-gradient-to-r from-purple-400 to-pink-400"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>
      
      {/* 键盘快捷键帮助弹窗 */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowKeyboardHelp(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">键盘快捷键</h3>
              <button onClick={() => setShowKeyboardHelp(false)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">选择选项 A</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">1</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">选择选项 B</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">2</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">选择选项 C</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">3</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">选择选项 D</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">4</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">确认答案</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">Enter</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">下一题</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">Space</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">收藏题目</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">B</kbd>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">显示提示</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">H</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Question Card */}
        <Card className="mb-6">
          <CardContent className="py-8">
            {/* Question Type Badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'px-2 py-1 rounded-full text-xs font-medium',
                  // 检查是否是转换后的多选题
                  (convertedQuestions.has(currentCard.questionId) || currentQuestion.type === 'MULTI') && 'bg-purple-100 text-purple-700',
                  !convertedQuestions.has(currentCard.questionId) && currentQuestion.type === 'MCQ' && 'bg-blue-100 text-blue-700',
                  currentQuestion.type === 'TRUE_FALSE' && 'bg-green-100 text-green-700',
                  currentQuestion.type === 'FILL' && 'bg-orange-100 text-orange-700',
                  currentQuestion.type === 'SHORT_ANSWER' && 'bg-teal-100 text-teal-700'
                )}>
                  {convertedQuestions.has(currentCard.questionId) && '多选题'}
                  {!convertedQuestions.has(currentCard.questionId) && currentQuestion.type === 'MCQ' && '单选题'}
                  {!convertedQuestions.has(currentCard.questionId) && currentQuestion.type === 'MULTI' && '多选题'}
                  {currentQuestion.type === 'TRUE_FALSE' && '判断题'}
                  {currentQuestion.type === 'FILL' && '填空题'}
                  {currentQuestion.type === 'SHORT_ANSWER' && '简答题'}
                </span>
                
                {/* 难度标签 */}
                {difficultyInfo && (
                  <span className={cn('px-2 py-1 rounded-full text-xs font-medium', difficultyInfo.color)}>
                    {difficultyInfo.label}
                  </span>
                )}
                
                {currentCard.lapses > 0 && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 flex items-center gap-1">
                    <Flame size={12} />
                    错{currentCard.lapses}次
                  </span>
                )}
              </div>
              
              {/* 快捷键提示 */}
              <div className="hidden md:flex items-center gap-1 text-xs text-gray-400">
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">1-4</kbd>
                <span>选择</span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 ml-2">Enter</kbd>
                <span>确认</span>
              </div>
            </div>

            {/* Question Text */}
            <div className="text-lg text-gray-800 leading-relaxed mb-6">
              {/* 如果是转换后的多选题，显示转换后的题干 */}
              {convertedQuestions.has(currentCard.questionId) 
                ? convertedQuestions.get(currentCard.questionId)!.content
                : currentQuestion.content.text}
            </div>

            {/* Options */}
            <div className="space-y-3">
              {/* 填空题：显示多个输入框 */}
              {currentQuestion.type === 'FILL' ? (
                <div className="space-y-4">
                  {(() => {
                    const blanksCount = getFillBlanksCount(currentQuestion.content.text);
                    const correctAnswers = Array.isArray(currentQuestion.answer) 
                      ? currentQuestion.answer 
                      : [currentQuestion.answer];
                    
                    return Array.from({ length: blanksCount }, (_, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={fillAnswers[index] || ''}
                          onChange={(e) => {
                            const newAnswers = [...fillAnswers];
                            newAnswers[index] = e.target.value;
                            setFillAnswers(newAnswers);
                          }}
                          disabled={showAnswer}
                          placeholder={`第 ${index + 1} 空`}
                          className={cn(
                            'flex-1 px-4 py-3 border-2 rounded-xl text-gray-800 transition-all',
                            'focus:outline-none focus:ring-2 focus:ring-primary-500/20',
                            showAnswer ? 'bg-gray-50 cursor-not-allowed' : 'bg-white hover:border-primary-300',
                            !showAnswer && 'border-gray-200 focus:border-primary-500',
                            showAnswer && fillAnswers[index]?.trim().toLowerCase() === correctAnswers[index]?.trim().toLowerCase() && 'border-green-500 bg-green-50',
                            showAnswer && fillAnswers[index]?.trim().toLowerCase() !== correctAnswers[index]?.trim().toLowerCase() && 'border-red-500 bg-red-50'
                          )}
                        />
                        {showAnswer && (
                          <div className="flex items-center gap-2">
                            {fillAnswers[index]?.trim().toLowerCase() === correctAnswers[index]?.trim().toLowerCase() ? (
                              <CheckCircle size={20} className="text-green-500" />
                            ) : (
                              <>
                                <XCircle size={20} className="text-red-500" />
                                <span className="text-sm text-green-600 font-medium">
                                  {correctAnswers[index] || ''}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              ) : currentQuestion.type === 'SHORT_ANSWER' ? (
                /* 简答题：显示文本输入框 */
                <div className="space-y-3">
                  <textarea
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    disabled={showAnswer}
                    placeholder="请输入你的答案..."
                    className={cn(
                      'w-full min-h-[150px] p-4 border-2 rounded-xl text-gray-800 resize-y transition-all',
                      'focus:outline-none focus:ring-2 focus:ring-primary-500/20',
                      showAnswer ? 'bg-gray-50 cursor-not-allowed' : 'bg-white hover:border-primary-300',
                      !showAnswer && 'border-gray-200 focus:border-primary-500'
                    )}
                  />
                  {/* 显示正确答案 */}
                  {showAnswer && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                      <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                        <CheckCircle size={16} />
                        参考答案
                      </h4>
                      <div className="text-green-700 whitespace-pre-line">
                        {Array.isArray(currentQuestion.answer) 
                          ? currentQuestion.answer.join('\n') 
                          : currentQuestion.answer}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
              /* 选择题：显示选项列表 */
              /* 根据是否是转换题目来决定显示哪些选项 */
              (convertedQuestions.has(currentCard.questionId) 
                ? convertedQuestions.get(currentCard.questionId)!.options.map((optText, idx) => ({
                    id: String.fromCharCode(65 + idx),
                    content: { text: optText },
                    isCorrect: convertedQuestions.get(currentCard.questionId)!.correctAnswer.includes(String.fromCharCode(65 + idx))
                  }))
                : currentQuestion.options
              ).map(option => {
                // 判断选项是否正确
                const optionIsCorrect = convertedQuestions.has(currentCard.questionId)
                  ? convertedQuestions.get(currentCard.questionId)!.correctAnswer.includes(option.id)
                  : option.isCorrect;
                
                return (
                  <div
                    key={option.id}
                    onClick={() => handleOptionClick(option.id)}
                    className={cn(
                      'option-card flex items-start gap-3',
                      isSelected(option.id) && !showAnswer && 'selected',
                      showAnswer && optionIsCorrect && 'correct',
                      showAnswer && isSelected(option.id) && !optionIsCorrect && 'incorrect'
                    )}
                  >
                    <span className={cn(
                      'flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all',
                      isSelected(option.id) && !showAnswer && 'border-primary-500 bg-primary-500 text-white',
                      showAnswer && optionIsCorrect && 'border-green-500 bg-green-500 text-white',
                      showAnswer && isSelected(option.id) && !optionIsCorrect && 'border-red-500 bg-red-500 text-white',
                      !isSelected(option.id) && !showAnswer && 'border-gray-300 text-gray-500'
                    )}>
                      {showAnswer ? (
                        optionIsCorrect ? <CheckCircle size={14} /> : 
                        isSelected(option.id) ? <XCircle size={14} /> : option.id
                      ) : option.id}
                    </span>
                    <span className="flex-1 pt-0.5">
                      {typeof option.content === 'string' ? option.content : option.content.text}
                    </span>
                  </div>
                );
              })
              )}
            </div>

            {/* Explanation */}
            {showAnswer && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h4 className="font-medium text-blue-800 mb-2">解析</h4>
                <div className="text-blue-700 text-sm whitespace-pre-line">
                  {convertedQuestions.has(currentCard.questionId)
                    ? convertedQuestions.get(currentCard.questionId)!.explanation
                    : currentQuestion.explanation}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {mode === 'exam' ? (
          /* 考试模式操作区 */
          <div className="space-y-4">
            {/* 题目导航 */}
            <Card className="bg-white/80">
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">答题卡</span>
                  <button
                    onClick={() => setShowQuestionNav(!showQuestionNav)}
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    {showQuestionNav ? '收起' : '展开'}
                  </button>
                </div>
                
                {showQuestionNav && (
                  <div className="grid grid-cols-10 gap-2 mb-4">
                    {session.cards.map((card, index) => {
                      const hasAnswer = examAnswers.has(card.questionId);
                      const isMarked = markedQuestions.has(card.questionId);
                      const isCurrent = index === session.currentIndex;
                      return (
                        <button
                          key={card.id}
                          onClick={() => goToQuestion(index)}
                          className={cn(
                            "w-8 h-8 rounded-lg text-xs font-medium transition-all relative",
                            isCurrent && "ring-2 ring-purple-500 ring-offset-1",
                            hasAnswer && !isCurrent && "bg-green-100 text-green-700",
                            !hasAnswer && !isCurrent && "bg-gray-100 text-gray-500",
                            isCurrent && "bg-purple-500 text-white"
                          )}
                        >
                          {index + 1}
                          {isMarked && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>已答 {examAnswers.size} / {session.cards.length} 题</span>
                  <span>标记 {markedQuestions.size} 题</span>
                </div>
              </CardContent>
            </Card>
            
            {/* 操作按钮 */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button 
                  variant="secondary"
                  onClick={() => goToQuestion(session.currentIndex - 1)}
                  disabled={session.currentIndex === 0}
                >
                  <ArrowLeft size={18} className="mr-1" />
                  上一题
                </Button>
                <Button 
                  variant="secondary"
                  onClick={toggleMarkQuestion}
                  className={markedQuestions.has(currentCard.questionId) ? "bg-orange-100 text-orange-700" : ""}
                >
                  <Flag size={18} className="mr-1" />
                  {markedQuestions.has(currentCard.questionId) ? '取消标记' : '标记'}
                </Button>
              </div>
              
              <div className="flex gap-2">
                {session.currentIndex < session.cards.length - 1 ? (
                  <Button onClick={() => goToQuestion(session.currentIndex + 1)}>
                    下一题
                    <ChevronRight size={18} className="ml-1" />
                  </Button>
                ) : (
                  <Button 
                    onClick={handleExamSubmit}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <GraduationCap size={18} className="mr-1" />
                    交卷
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : !showAnswer ? (
          <div className="flex justify-center">
            <Button 
              size="lg"
              onClick={handleShowAnswer}
              disabled={
                (currentQuestion?.type === 'SHORT_ANSWER' 
                  ? textAnswer.trim().length === 0
                  : currentQuestion?.type === 'FILL'
                    ? fillAnswers.filter(a => a?.trim()).length === 0
                    : selectedOptions.length === 0) 
                || isAnalyzing
              }
              className="min-w-[200px]"
            >
              {isAnalyzing ? '分析中...' : '确认答案'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* AI 反馈卡片 */}
            {answerFeedback && (
              <div className={cn(
                'p-4 rounded-xl border-2 transition-all',
                answerFeedback.isCorrect 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      answerFeedback.isCorrect ? 'bg-green-500' : 'bg-red-500'
                    )}>
                      {answerFeedback.isCorrect 
                        ? <CheckCircle className="w-6 h-6 text-white" />
                        : <XCircle className="w-6 h-6 text-white" />
                      }
                    </div>
                    <div>
                      <p className={cn(
                        'font-bold text-lg',
                        answerFeedback.isCorrect ? 'text-green-700' : 'text-red-700'
                      )}>
                        {answerFeedback.message}
                      </p>
                    </div>
                  </div>
                  {/* 下一题按钮 - 放在反馈卡片右侧 */}
                  <Button 
                    onClick={handleNext}
                    className="gap-2 min-w-[120px]"
                  >
                    <span>下一题</span>
                    <ChevronRight size={18} />
                  </Button>
                </div>
                <div className={cn(
                  'flex items-start gap-2 mt-3 p-3 rounded-lg',
                  answerFeedback.isCorrect ? 'bg-green-100' : 'bg-red-100'
                )}>
                  <Brain className={cn(
                    'w-5 h-5 mt-0.5 flex-shrink-0',
                    answerFeedback.isCorrect ? 'text-green-600' : 'text-red-600'
                  )} />
                  <p className={cn(
                    'text-sm',
                    answerFeedback.isCorrect ? 'text-green-700' : 'text-red-700'
                  )}>
                    {answerFeedback.tip}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
