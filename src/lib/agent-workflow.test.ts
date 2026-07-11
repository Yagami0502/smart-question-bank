import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runAgentWorkflow } from './agent-workflow';

const question = {
  content: '1 + 1 = ?', type: 'MCQ', options: ['1', '2'], correctAnswer: 'B',
  explanation: '基础加法。', tags: ['数学'], difficulty: 1, confidence: 1,
  sourceIndex: 1, sourceEvidence: { sourceName: 'sample', locator: '第1题', excerpt: '1 + 1 = ?', bbox: [] },
  needsReview: false, reviewReason: '',
};

describe('runAgentWorkflow', () => {
  beforeEach(() => {
    localStorage.setItem('smart-question-bank-ai-settings', JSON.stringify({
      conversionMode: 'ai', aiConfig: { baseUrl: 'https://api.openai.com', model: 'gpt-test', apiKey: 'test-key' },
    }));
  });

  it('hands questions through parser, solver, and reviewer in order', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({
        result: { questions: [question], summary: body.stage, ...(body.stage === 'reviewer' ? { review: { checked: 1, corrected: 0, notes: [] } } : {}) },
        trace: { stage: body.stage, responseId: body.stage, model: 'gpt-test', durationMs: 10, inputTokens: 5, outputTokens: 5, questionCount: 1, summary: body.stage },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const updates: string[] = [];
    const output = await runAgentWorkflow({ kind: 'text', name: 'sample', content: '1 + 1 = ?' }, (stage, status) => updates.push(`${stage}:${status}`));
    expect(output.traces.map(trace => trace.stage)).toEqual(['parser', 'solver', 'reviewer']);
    expect(updates).toEqual(['parser:running', 'parser:complete', 'solver:running', 'solver:complete', 'reviewer:running', 'reviewer:complete', 'challenger:skipped', 'arbitrator:skipped']);
    const solverBody = JSON.parse(String(fetchMock.mock.calls[1][1].body));
    expect(solverBody.payload.questions).toEqual([question]);
  });

  it('convenes challenger and arbitrator only for disputed questions', async () => {
    const disputed = { ...question, confidence: 0.61, needsReview: true, reviewReason: '题意存在歧义' };
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const stageQuestion = body.stage === 'reviewer' ? disputed : body.stage === 'arbitrator' ? { ...question, confidence: 0.68, needsReview: true, reviewReason: '仍需人工确认' } : disputed;
      return new Response(JSON.stringify({
        result: { questions: [stageQuestion], summary: body.stage, ...(body.stage === 'reviewer' ? { review: { checked: 1, corrected: 0, notes: [] } } : {}) },
        trace: { stage: body.stage, responseId: body.stage, model: 'gpt-test', durationMs: 10, inputTokens: 5, outputTokens: 5, questionCount: 1, summary: body.stage },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const updates: string[] = [];
    const output = await runAgentWorkflow({ kind: 'text', name: 'sample', content: 'ambiguous' }, (stage, status) => updates.push(`${stage}:${status}`));
    expect(output.traces.map(trace => trace.stage)).toEqual(['parser', 'solver', 'reviewer', 'challenger', 'arbitrator']);
    expect(output.result.review?.debated).toBe(1);
    expect(output.result.questions[0].reviewReason).toBe('仍需人工确认');
    expect(updates.slice(-4)).toEqual(['challenger:running', 'challenger:complete', 'arbitrator:running', 'arbitrator:complete']);
  });

  it('marks a failed stage and stops the handoff', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: '模型不可用' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    const updates: string[] = [];
    await expect(runAgentWorkflow({ kind: 'text', name: 'sample', content: 'question' }, (stage, status) => updates.push(`${stage}:${status}`))).rejects.toThrow('模型不可用');
    expect(updates).toEqual(['parser:running', 'parser:error']);
  });
});
