import { useMemo, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Bot, Braces, Check, CircleDashed, Gavel, Scale, ShieldCheck, Sigma } from 'lucide-react';
import type { AgentStage, AgentStatus, AgentTrace } from '../lib/agent-workflow';

gsap.registerPlugin(useGSAP);

export type AgentState = Record<AgentStage, { status: AgentStatus; trace?: AgentTrace }>;

const agents = [
  { id: 'parser' as const, name: '解析智能体', role: '拆题与题型识别', icon: Braces, color: '#2563eb' },
  { id: 'solver' as const, name: '解题智能体', role: '推导答案与题解', icon: Sigma, color: '#e77b2e' },
  { id: 'reviewer' as const, name: '审校智能体', role: '交叉验证与纠错', icon: ShieldCheck, color: '#169873' },
  { id: 'challenger' as const, name: '挑战者智能体', role: '争议题独立重算', icon: Scale, color: '#b55a3c' },
  { id: 'arbitrator' as const, name: '裁决智能体', role: '比较推导与定案', icon: Gavel, color: '#8b6fc0' },
];

export default function AgentWorkflow({ states }: { states: AgentState }) {
  const root = useRef<HTMLDivElement>(null);
  const activeStage = useMemo(() => agents.find(agent => states[agent.id].status === 'running')?.id, [states]);

  useGSAP(() => {
    if (!activeStage || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const index = agents.findIndex(agent => agent.id === activeStage);
    const timeline = gsap.timeline({ defaults: { ease: 'power2.out' } });
    timeline
      .fromTo(`[data-agent="${activeStage}"]`, { scale: 0.97, opacity: 0.75 }, { scale: 1, opacity: 1, duration: 0.35 })
      .fromTo(`[data-flow="${Math.max(0, index - 1)}"] .agent-packet`, { xPercent: -120, opacity: 0 }, { xPercent: 180, opacity: 1, duration: 0.8 }, '<0.05');
  }, { scope: root, dependencies: [activeStage], revertOnUpdate: true });

  return (
    <section ref={root} className="agent-observatory" aria-label="智能体协作执行轨迹">
      <div className="agent-observatory__header">
        <div>
          <p className="agent-kicker"><Bot size={14} /> AGENT TRACE</p>
          <h2>智能体协作现场</h2>
        </div>
        <span className="agent-live"><i /> {activeStage ? '执行中' : '等待任务'}</span>
      </div>

      <div className="agent-lane">
        {agents.map((agent, index) => {
          const state = states[agent.id];
          const Icon = agent.icon;
          return (
            <div className="agent-lane__item" key={agent.id}>
              <article data-agent={agent.id} className={`agent-node agent-node--${state.status}`} style={{ '--agent-color': agent.color } as React.CSSProperties}>
                <div className="agent-node__top">
                  <span className="agent-node__icon"><Icon size={20} /></span>
                  <span className="agent-node__state">
                    {state.status === 'running' && <CircleDashed size={14} className="agent-spin" />}
                    {state.status === 'complete' && <Check size={14} />}
                    {state.status === 'idle' ? '待命' : state.status === 'running' ? '处理中' : state.status === 'complete' ? '已交付' : state.status === 'skipped' ? '无需介入' : '异常'}
                  </span>
                </div>
                <h3>{agent.name}</h3>
                <p>{agent.role}</p>
                <div className="agent-node__metrics">
                  <span>{state.trace ? `${state.trace.durationMs} ms` : '-- ms'}</span>
                  <span>{state.status === 'skipped' ? '0 争议' : state.trace ? `${state.trace.questionCount} 题` : '-- 题'}</span>
                </div>
                {state.trace && <p className="agent-node__summary" title={state.trace.summary}>{state.trace.summary}</p>}
              </article>
              {index < agents.length - 1 && (
                <div className={`agent-flow agent-flow--${states[agents[index + 1].id].status !== 'idle' ? 'active' : 'idle'}`} data-flow={index}>
                  <span className="agent-flow__line" />
                  <span className="agent-packet" />
                  <small>任务交接</small>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
