import { getUserAISettings } from './ai-service';

export type AgentStage = 'parser' | 'solver' | 'reviewer' | 'challenger' | 'arbitrator';
export type AgentStatus = 'idle' | 'running' | 'complete' | 'skipped' | 'error';

export interface SourceEvidence {
  sourceName: string;
  locator: string;
  excerpt: string;
  bbox: number[];
}

export interface AgentQuestion {
  content: string;
  type: 'MCQ' | 'MULTI' | 'TRUE_FALSE' | 'FILL' | 'SHORT_ANSWER';
  options: string[];
  correctAnswer: string | string[];
  explanation: string;
  tags: string[];
  difficulty: number;
  confidence: number;
  sourceIndex: number;
  sourceEvidence: SourceEvidence;
  needsReview: boolean;
  reviewReason: string;
}

export interface AgentTrace {
  stage: AgentStage;
  responseId: string;
  model: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  questionCount: number;
  summary: string;
}

export interface ReviewResult {
  questions: AgentQuestion[];
  summary: string;
  review?: { checked: number; corrected: number; notes: string[]; debated?: number };
}

export interface WorkflowSource {
  kind: 'text' | 'table' | 'document' | 'image';
  name: string;
  content?: string;
  dataUrl?: string;
}

async function runStage(stage: AgentStage, payload: object) {
  const settings = getUserAISettings();
  const usesBrowserCredentials = Boolean(settings.aiConfig.apiKey);
  const response = await fetch('/api/import/agents/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(settings.aiConfig.apiKey ? { 'x-openai-api-key': settings.aiConfig.apiKey } : {}),
    },
    body: JSON.stringify({
      stage,
      payload,
      ...(usesBrowserCredentials ? {
        model: settings.aiConfig.model || 'gpt-5.4-mini',
        baseURL: settings.aiConfig.baseUrl || 'https://api.openai.com/v1',
      } : {}),
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `${stage} 智能体执行失败`);
  return data as { result: ReviewResult; trace: AgentTrace };
}

export async function runAgentWorkflow(
  source: WorkflowSource,
  onStage: (stage: AgentStage, status: AgentStatus, trace?: AgentTrace) => void,
): Promise<{ result: ReviewResult; traces: AgentTrace[] }> {
  const traces: AgentTrace[] = [];
  let questions: AgentQuestion[] = [];

  for (const stage of ['parser', 'solver', 'reviewer'] as AgentStage[]) {
    onStage(stage, 'running');
    try {
      const response = await runStage(stage, stage === 'parser' ? { source } : { questions });
      questions = response.result.questions;
      traces.push(response.trace);
      onStage(stage, 'complete', response.trace);
      if (stage === 'reviewer') {
        const disputed = questions.filter(question => question.needsReview || question.confidence < 0.82);
        if (disputed.length === 0) {
          onStage('challenger', 'skipped');
          onStage('arbitrator', 'skipped');
          return { result: response.result, traces };
        }

        let challenge;
        try {
          onStage('challenger', 'running');
          challenge = await runStage('challenger', { questions: disputed });
          traces.push(challenge.trace);
          onStage('challenger', 'complete', challenge.trace);
        } catch (error) {
          onStage('challenger', 'error');
          throw error;
        }

        let arbitration;
        try {
          onStage('arbitrator', 'running');
          arbitration = await runStage('arbitrator', {
            original: disputed,
            challenger: challenge.result.questions,
          });
          traces.push(arbitration.trace);
          onStage('arbitrator', 'complete', arbitration.trace);
        } catch (error) {
          onStage('arbitrator', 'error');
          throw error;
        }

        const arbitratedByIndex = new Map(arbitration.result.questions.map(question => [question.sourceIndex, question]));
        const finalQuestions = questions.map(question => arbitratedByIndex.get(question.sourceIndex) || question);
        return {
          result: {
            ...response.result,
            questions: finalQuestions,
            review: response.result.review && { ...response.result.review, debated: disputed.length },
          },
          traces,
        };
      }
    } catch (error) {
      onStage(stage, 'error');
      throw error;
    }
  }
  throw new Error('智能体工作流未生成结果');
}

export async function extractWordFile(file: File): Promise<{ text: string; warnings: string[] }> {
  const response = await fetch('/api/import/word/extract', {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name) },
    body: file,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Word 文档读取失败');
  return data;
}
