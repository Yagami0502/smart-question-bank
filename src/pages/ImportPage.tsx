import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Lenis from 'lenis';
import {
  ArrowLeft, Check, CheckCircle2, FileImage, FileSpreadsheet, FileText, FileType2,
  AlertTriangle, Eye, FileSearch, Loader2, PencilLine, RotateCcw, Sparkles, Upload, WandSparkles,
} from 'lucide-react';
import Button from '../components/ui/Button';
import AgentWorkflow, { type AgentState } from '../components/AgentWorkflow';
import { dialog } from '../components/ui/ConfirmDialog';
import { useAppStore } from '../stores/appStore';
import { parseCSV, parseExcel } from '../lib/parsers/csv-parser';
import { extractWordFile, runAgentWorkflow, type AgentQuestion, type WorkflowSource } from '../lib/agent-workflow';
import { readFileAsArrayBuffer, readFileAsDataURL, readFileContent } from '../lib/utils';
import type { Deck, Question } from '../types';

interface ImportPageProps { deck: Deck; onBack: () => void }
type View = 'source' | 'running' | 'preview' | 'complete';

const initialAgents: AgentState = {
  parser: { status: 'idle' }, solver: { status: 'idle' }, reviewer: { status: 'idle' },
  challenger: { status: 'idle' }, arbitrator: { status: 'idle' },
};

const formatItems = [
  { label: 'CSV', detail: '结构化表格', icon: FileSpreadsheet, tone: 'green' },
  { label: 'Excel', detail: '.xlsx / .xls', icon: FileSpreadsheet, tone: 'blue' },
  { label: '文本 / MD', detail: '自由排版', icon: FileText, tone: 'orange' },
  { label: 'Word', detail: '.docx / .doc', icon: FileType2, tone: 'cyan' },
  { label: '截图 / 照片', detail: '视觉识别', icon: FileImage, tone: 'red' },
];

function tableToText(headers: string[], rows: Record<string, unknown>[]) {
  return [headers.join(' | '), ...rows.map(row => headers.map(header => String(row[header] ?? '')).join(' | '))].join('\n');
}

function addLineNumbers(content: string) {
  return content.split('\n').map((line, index) => `L${index + 1}: ${line}`).join('\n');
}

export default function ImportPage({ deck, onBack }: ImportPageProps) {
  const root = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>('source');
  const [source, setSource] = useState<WorkflowSource | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [agents, setAgents] = useState<AgentState>(initialAgents);
  const [questions, setQuestions] = useState<AgentQuestion[]>([]);
  const [review, setReview] = useState<{ checked: number; corrected: number; notes: string[]; debated?: number } | null>(null);
  const [confirmedQuestions, setConfirmedQuestions] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const { importQuestions } = useAppStore();

  useEffect(() => {
    const lenis = new Lenis({ duration: 0.9, smoothWheel: true });
    let frame = 0;
    const raf = (time: number) => { lenis.raf(time); frame = requestAnimationFrame(raf); };
    frame = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(frame); lenis.destroy(); };
  }, []);

  const accepted = '.csv,.xlsx,.xls,.txt,.md,.doc,.docx,.png,.jpg,.jpeg,.webp';
  const completedCount = useMemo(() => Object.values(agents).filter(agent => agent.status === 'complete').length, [agents]);
  const requiredConfirmations = useMemo(() => questions.filter(question => question.needsReview || question.confidence < 0.82), [questions]);
  const allRequiredConfirmed = requiredConfirmations.every(question => confirmedQuestions.has(question.sourceIndex));

  const readSource = useCallback(async (file: File): Promise<WorkflowSource> => {
    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (ext === 'csv') {
      const parsed = parseCSV(await readFileContent(file));
      return { kind: 'table', name: file.name, content: addLineNumbers(tableToText(parsed.headers, parsed.rows)) };
    }
    if (ext === 'xlsx' || ext === 'xls') {
      const parsed = parseExcel(await readFileAsArrayBuffer(file));
      return { kind: 'table', name: file.name, content: addLineNumbers(tableToText(parsed.headers, parsed.rows)) };
    }
    if (ext === 'txt' || ext === 'md') return { kind: 'text', name: file.name, content: addLineNumbers(await readFileContent(file)) };
    if (ext === 'doc' || ext === 'docx') {
      const result = await extractWordFile(file);
      return { kind: 'document', name: file.name, content: addLineNumbers(result.text) };
    }
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return { kind: 'image', name: file.name, dataUrl: await readFileAsDataURL(file) };
    throw new Error('不支持此格式，请选择 CSV、Excel、文本、Markdown、Word 或图片');
  }, []);

  const startWorkflow = useCallback(async (nextSource: WorkflowSource) => {
    setSource(nextSource); setView('running'); setAgents(initialAgents); setError(''); setQuestions([]); setConfirmedQuestions(new Set());
    try {
      const output = await runAgentWorkflow(nextSource, (stage, status, trace) => {
        setAgents(current => ({ ...current, [stage]: { status, trace } }));
      });
      setQuestions(output.result.questions);
      setReview(output.result.review || null);
      setView('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : '智能体工作流执行失败');
    }
  }, []);

  const handleFile = useCallback(async (file?: File) => {
    if (!file) return;
    setError('');
    try { await startWorkflow(await readSource(file)); }
    catch (err) { setError(err instanceof Error ? err.message : '文件读取失败'); }
  }, [readSource, startWorkflow]);

  const saveQuestions = async () => {
    const now = Date.now();
    const normalized: Question[] = questions.map((question, index) => ({
      id: `agent-${now}-${index}`, deckId: deck.id, type: question.type,
      content: { text: question.content }, answer: question.correctAnswer,
      explanation: question.explanation, tags: question.tags, difficulty: question.difficulty,
      sourceFile: `${question.sourceEvidence?.sourceName || source?.name || '未知来源'} · ${question.sourceEvidence?.locator || `第 ${question.sourceIndex} 题`}`,
      options: question.options.map((option, optionIndex) => {
        const id = String.fromCharCode(65 + optionIndex);
        return { id, content: { text: option }, isCorrect: Array.isArray(question.correctAnswer) ? question.correctAnswer.includes(id) : question.correctAnswer === id };
      }),
      createdAt: now, updatedAt: now,
    }));
    try { await importQuestions(deck.id, normalized); setView('complete'); }
    catch { dialog.error('题目写入题库失败，请重试'); }
  };

  return (
    <div ref={root} className="import-studio">
      <header className="import-studio__nav">
        <button onClick={onBack} className="import-back" aria-label="返回题库"><ArrowLeft size={18} /></button>
        <div><span>MINDFORGE /</span> 智能导题台</div>
        <span className="import-deck">目标题库 · {deck.name}</span>
      </header>

      <main className="import-studio__main">
        <div className="import-studio__intro">
          <div>
            <p className="import-eyebrow"><WandSparkles size={15} /> MULTI-AGENT QUESTION LAB</p>
            <h1>把试题交给<br /><strong>一组智能体</strong></h1>
            <p>从识别题目到推导答案，再到交叉审校。每一次交接、耗时和修正都清晰可见。</p>
          </div>
          <div className="import-score">
            <span>{completedCount}<small>/5</small></span>
            <p>智能体已完成</p>
          </div>
        </div>

        {(view === 'source' || (view === 'running' && error)) && (
          <section className="source-workbench">
            <div className={`source-drop ${dragging ? 'source-drop--active' : ''}`}
              onDragOver={event => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={event => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files[0]); }}
              onClick={() => inputRef.current?.click()}>
              <input ref={inputRef} hidden type="file" accept={accepted} onChange={event => handleFile(event.target.files?.[0])} />
              <span className="source-drop__icon"><Upload size={26} /></span>
              <h2>投放一份试题材料</h2>
              <p>拖入文件，或点击从电脑选择</p>
              <span className="source-drop__limit">单文件 · 最大 20 MB</span>
            </div>
            <div className="source-paste">
              <div className="source-paste__title"><PencilLine size={18} /><span><b>直接粘贴题目</b><small>无固定格式也可以</small></span></div>
              <textarea value={pasteText} onChange={event => setPasteText(event.target.value)} placeholder={'1. 输入或粘贴题目\nA. 选项一\nB. 选项二'} />
              <Button onClick={() => startWorkflow({ kind: 'text', name: '粘贴文本', content: addLineNumbers(pasteText) })} disabled={!pasteText.trim()} leftIcon={<Sparkles size={16} />}>启动智能体</Button>
            </div>
          </section>
        )}

        {view === 'source' && <div className="format-rack">{formatItems.map(item => <div className={`format-chip format-chip--${item.tone}`} key={item.label}><item.icon size={18} /><span><b>{item.label}</b><small>{item.detail}</small></span><Check size={14} /></div>)}</div>}

        {(view === 'running' || view === 'preview') && <AgentWorkflow states={agents} />}

        {view === 'running' && !error && (
          <div className="workflow-wait"><Loader2 className="agent-spin" size={20} /><span><b>正在处理 {source?.name}</b><small>请保持页面开启，智能体将依次完成任务</small></span></div>
        )}
        {error && <div className="workflow-error"><p>{error}</p><Button variant="outline" onClick={() => setView('source')} leftIcon={<RotateCcw size={16} />}>重新选择</Button></div>}

        {view === 'preview' && (
          <section className="result-sheet">
            <div className="result-sheet__header">
              <div><p>FINAL OUTPUT</p><h2>{questions.length} 道题已生成答案与题解</h2></div>
              <div className="review-stamp"><ShieldCheckIcon /><span><b>审校完成</b><small>{review?.corrected || 0} 处修正 · {review?.debated || 0} 题会审</small></span></div>
            </div>
            <div className="quality-summary">
              <span><CheckCircle2 size={17} /><b>{questions.length - requiredConfirmations.length}</b> 题可直接导入</span>
              <span className={requiredConfirmations.length ? 'quality-summary__warning' : ''}><AlertTriangle size={17} /><b>{requiredConfirmations.length}</b> 题需人工确认</span>
              <span><FileSearch size={17} /><b>{questions.filter(question => question.sourceEvidence?.excerpt).length}</b> 题可追溯来源</span>
            </div>
            <div className="result-list">
              {questions.map((question, index) => (
                <article className={`question-result ${question.needsReview || question.confidence < 0.82 ? 'question-result--review' : ''}`} key={`${question.content}-${index}`}>
                  <div className="question-result__number">{String(index + 1).padStart(2, '0')}</div>
                  <div className="question-result__body">
                    <div className="question-result__meta"><span>{question.type}</span><span className={`confidence confidence--${question.confidence >= .9 ? 'high' : question.confidence >= .82 ? 'medium' : 'low'}`}>可信度 {Math.round(question.confidence * 100)}%</span><span>难度 {question.difficulty}/5</span></div>
                    <h3>{question.content}</h3>
                    {question.options.length > 0 && <div className="question-options">{question.options.map((option, i) => <span key={option}>{String.fromCharCode(65 + i)}. {option}</span>)}</div>}
                    <div className="question-answer"><b>答案</b><span>{Array.isArray(question.correctAnswer) ? question.correctAnswer.join('、') : question.correctAnswer}</span></div>
                    <div className="question-explanation"><b>题解</b><p>{question.explanation}</p></div>
                    <div className="source-evidence">
                      <div><Eye size={15} /><b>来源证据</b><span>{question.sourceEvidence?.sourceName || source?.name} · {question.sourceEvidence?.locator || `第 ${question.sourceIndex} 题`}</span></div>
                      {source?.kind === 'image' && source.dataUrl && (
                        <div className="source-image-proof">
                          <img src={source.dataUrl} alt={`${question.sourceEvidence?.sourceName || source.name} 原图`} />
                          {question.sourceEvidence?.bbox?.length === 4 && <span style={{
                            left: `${question.sourceEvidence.bbox[0] / 10}%`,
                            top: `${question.sourceEvidence.bbox[1] / 10}%`,
                            width: `${(question.sourceEvidence.bbox[2] - question.sourceEvidence.bbox[0]) / 10}%`,
                            height: `${(question.sourceEvidence.bbox[3] - question.sourceEvidence.bbox[1]) / 10}%`,
                          }} />}
                        </div>
                      )}
                      <blockquote>{question.sourceEvidence?.excerpt || question.content}</blockquote>
                    </div>
                    {(question.needsReview || question.confidence < 0.82) && (
                      <label className="human-confirm">
                        <input type="checkbox" checked={confirmedQuestions.has(question.sourceIndex)} onChange={event => setConfirmedQuestions(current => {
                          const next = new Set(current); if (event.target.checked) next.add(question.sourceIndex); else next.delete(question.sourceIndex); return next;
                        })} />
                        <span><b>我已人工核对答案与题解</b><small>{question.reviewReason || '模型可信度未达到自动导入阈值'}</small></span>
                      </label>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <div className="result-actions"><Button variant="ghost" onClick={() => setView('source')} leftIcon={<RotateCcw size={16} />}>换一份材料</Button><div><small>{allRequiredConfirmed ? '所有风险题已确认' : `还需确认 ${requiredConfirmations.length - confirmedQuestions.size} 道风险题`}</small><Button onClick={saveQuestions} disabled={!allRequiredConfirmed} leftIcon={<Check size={16} />}>确认导入题库</Button></div></div>
          </section>
        )}

        {view === 'complete' && <section className="import-complete"><CheckCircle2 size={42} /><p>IMPORT COMPLETE</p><h2>{questions.length} 道题已进入「{deck.name}」</h2><Button onClick={onBack}>返回题库</Button></section>}
      </main>
    </div>
  );
}

function ShieldCheckIcon() { return <CheckCircle2 size={23} />; }
