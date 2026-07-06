/**
 * Obsidian-style knowledge graph.
 * Visualizes deck -> tag and tag -> tag relationships from imported questions.
 */
import { useState, useEffect, useMemo } from 'react';
import { X, Network, ZoomIn, ZoomOut, Tag, BookOpen, Circle, Maximize2, Minimize2 } from 'lucide-react';
import AnimatedModal from './ui/AnimatedModal';
import { cn } from '../lib/utils';
import { db } from '../lib/database';

type GraphNodeType = 'deck' | 'tag';

interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  count: number;
  mastery: number;
  deckNames: string[];
  questionIds: string[];
  x: number;
  y: number;
  radius: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

interface KnowledgeGraphProps {
  isOpen: boolean;
  onClose: () => void;
  deckId?: string;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getMasteryLabel(mastery: number) {
  if (mastery >= 80) return '掌握稳定';
  if (mastery >= 60) return '比较熟练';
  if (mastery >= 35) return '正在学习';
  if (mastery > 0) return '薄弱知识点';
  return '待练习';
}

function getNodeTone(node: GraphNode) {
  if (node.type === 'deck') return { fill: '#38bdf8', glow: '#0ea5e9', text: '#e0f2fe' };
  if (node.mastery >= 80) return { fill: '#22c55e', glow: '#16a34a', text: '#dcfce7' };
  if (node.mastery >= 60) return { fill: '#3b82f6', glow: '#2563eb', text: '#dbeafe' };
  if (node.mastery >= 35) return { fill: '#f59e0b', glow: '#d97706', text: '#fef3c7' };
  return { fill: '#ef4444', glow: '#dc2626', text: '#fee2e2' };
}

export default function KnowledgeGraph({ isOpen, onClose, deckId }: KnowledgeGraphProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      void loadKnowledgeData();
    }
  }, [isOpen, deckId]);

  const loadKnowledgeData = async () => {
    setLoading(true);
    try {
      let questions = await db.questions.toArray();
      let cards = await db.cards.toArray();
      const decks = await db.decks.toArray();

      if (deckId) {
        questions = questions.filter(q => q.deckId === deckId);
        cards = cards.filter(c => c.deckId === deckId);
      }

      const deckMap = new Map(decks.map(deck => [deck.id, deck]));
      const cardMap = new Map(cards.map(card => [card.questionId, card]));
      const tagMap = new Map<string, {
        count: number;
        deckIds: Set<string>;
        questionIds: string[];
        mastered: number;
        reviewed: number;
      }>();
      const deckTagWeights = new Map<string, number>();
      const tagEdgeWeights = new Map<string, number>();

      questions.forEach(question => {
        const tags = Array.from(new Set((question.tags || []).filter(Boolean)));
        const card = cardMap.get(question.id);

        tags.forEach(tag => {
          const current = tagMap.get(tag) || {
            count: 0,
            deckIds: new Set<string>(),
            questionIds: [],
            mastered: 0,
            reviewed: 0,
          };
          current.count += 1;
          current.deckIds.add(question.deckId);
          current.questionIds.push(question.id);

          if (card) {
            current.reviewed += 1;
            if (card.state === 'review' || (card.correctCount || 0) > (card.errorCount || 0)) {
              current.mastered += 1;
            }
          }

          tagMap.set(tag, current);
          const deckEdgeKey = `deck:${question.deckId}::tag:${tag}`;
          deckTagWeights.set(deckEdgeKey, (deckTagWeights.get(deckEdgeKey) || 0) + 1);
        });

        tags.forEach((source, sourceIndex) => {
          tags.slice(sourceIndex + 1).forEach(target => {
            const [a, b] = [source, target].sort();
            const key = `tag:${a}::tag:${b}`;
            tagEdgeWeights.set(key, (tagEdgeWeights.get(key) || 0) + 1);
          });
        });
      });

      const topTags = Array.from(tagMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 28);
      const visibleTagIds = new Set(topTags.map(([tag]) => tag));
      const visibleDeckIds = new Set<string>();
      topTags.forEach(([, data]) => data.deckIds.forEach(id => visibleDeckIds.add(id)));

      const graphNodes: GraphNode[] = [];
      const deckIds = Array.from(visibleDeckIds).filter(id => deckMap.has(id));
      const centerX = 450;
      const centerY = 280;

      deckIds.forEach((id, index) => {
        const deck = deckMap.get(id)!;
        const angle = deckIds.length === 1 ? -Math.PI / 2 : (index / deckIds.length) * Math.PI * 2 - Math.PI / 2;
        const radius = deckIds.length === 1 ? 0 : 78;
        graphNodes.push({
          id: `deck:${id}`,
          label: deck.name,
          type: 'deck',
          count: questions.filter(q => q.deckId === id).length,
          mastery: 0,
          deckNames: [deck.name],
          questionIds: questions.filter(q => q.deckId === id).map(q => q.id),
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
          radius: 30,
        });
      });

      const maxTagCount = Math.max(...topTags.map(([, data]) => data.count), 1);
      topTags.forEach(([tag, data], index) => {
        const ring = index < 10 ? 190 : 250;
        const jitter = (hashString(tag) % 45) - 22;
        const angle = (index / topTags.length) * Math.PI * 2 - Math.PI / 2;
        const mastery = data.reviewed > 0 ? Math.round((data.mastered / data.reviewed) * 100) : 0;
        const deckNames = Array.from(data.deckIds)
          .map(id => deckMap.get(id)?.name)
          .filter((name): name is string => Boolean(name));

        graphNodes.push({
          id: `tag:${tag}`,
          label: tag,
          type: 'tag',
          count: data.count,
          mastery,
          deckNames,
          questionIds: data.questionIds,
          x: centerX + Math.cos(angle) * (ring + jitter),
          y: centerY + Math.sin(angle) * (ring + jitter),
          radius: 16 + (data.count / maxTagCount) * 26,
        });
      });

      const graphEdges: GraphEdge[] = [];
      deckTagWeights.forEach((weight, key) => {
        const [source, target] = key.split('::');
        if (graphNodes.some(n => n.id === source) && visibleTagIds.has(target.replace('tag:', ''))) {
          graphEdges.push({ source, target, weight });
        }
      });
      tagEdgeWeights.forEach((weight, key) => {
        const [source, target] = key.split('::');
        if (visibleTagIds.has(source.replace('tag:', '')) && visibleTagIds.has(target.replace('tag:', ''))) {
          graphEdges.push({ source, target, weight });
        }
      });

      setNodes(graphNodes);
      setEdges(graphEdges.sort((a, b) => a.weight - b.weight));
      setSelectedNodeId(graphNodes[0]?.id || null);
    } catch (error) {
      console.error('Failed to load knowledge graph:', error);
    } finally {
      setLoading(false);
    }
  };

  const nodeMap = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) || null : null;
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const ids = new Set<string>();
    edges.forEach(edge => {
      if (edge.source === selectedNodeId) ids.add(edge.target);
      if (edge.target === selectedNodeId) ids.add(edge.source);
    });
    return ids;
  }, [edges, selectedNodeId]);

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="w-[1040px] h-[720px] overflow-hidden flex flex-col bg-slate-950 text-slate-100 shadow-2xl rounded-2xl">
        <div className="px-5 py-4 border-b border-slate-800 flex-shrink-0 bg-slate-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-cyan-400/10 border border-cyan-300/20">
                <Network className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">知识图谱</h2>
                <p className="text-xs text-slate-400">像 Obsidian 一样查看题库、知识点和薄弱项的关系</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(z => Math.min(z + 0.12, 1.8))} className="p-2 rounded-lg text-slate-300 hover:bg-slate-800">
                <ZoomIn size={18} />
              </button>
              <button onClick={() => setZoom(z => Math.max(z - 0.12, 0.65))} className="p-2 rounded-lg text-slate-300 hover:bg-slate-800">
                <ZoomOut size={18} />
              </button>
              <button onClick={() => setShowLabels(value => !value)} className="p-2 rounded-lg text-slate-300 hover:bg-slate-800">
                {showLabels ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button onClick={onClose} className="p-2 rounded-lg text-slate-300 hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_center,#172033_0%,#020617_68%)]">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 rounded-full border-2 border-cyan-300 border-t-transparent animate-spin" />
              </div>
            ) : nodes.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <Network size={52} className="text-slate-600" />
                <p className="mt-4 text-lg font-medium text-slate-300">暂无知识节点</p>
                <p className="text-sm text-slate-500">导入题目并添加标签后，这里会形成可视化知识网络。</p>
              </div>
            ) : (
              <svg width="100%" height="100%" viewBox="0 0 900 560" className="select-none">
                <defs>
                  <pattern id="graph-grid" width="34" height="34" patternUnits="userSpaceOnUse">
                    <path d="M 34 0 L 0 0 0 34" fill="none" stroke="#1e293b" strokeWidth="0.7" opacity="0.55" />
                  </pattern>
                  <filter id="node-glow" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <rect width="900" height="560" fill="url(#graph-grid)" opacity="0.65" />
                <g transform={`translate(${450 - 450 * zoom} ${280 - 280 * zoom}) scale(${zoom})`}>
                  {edges.map((edge, index) => {
                    const source = nodeMap.get(edge.source);
                    const target = nodeMap.get(edge.target);
                    if (!source || !target) return null;
                    const isActive = selectedNodeId === edge.source || selectedNodeId === edge.target;
                    return (
                      <line
                        key={`${edge.source}-${edge.target}-${index}`}
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={isActive ? '#67e8f9' : '#475569'}
                        strokeWidth={clamp(edge.weight, 1, 5)}
                        opacity={isActive ? 0.82 : 0.28}
                      />
                    );
                  })}

                  {nodes.map(node => {
                    const tone = getNodeTone(node);
                    const isSelected = selectedNodeId === node.id;
                    const isConnected = connectedNodeIds.has(node.id);
                    const faded = selectedNodeId && !isSelected && !isConnected;
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        onClick={() => setSelectedNodeId(node.id)}
                        className="cursor-pointer"
                        opacity={faded ? 0.38 : 1}
                      >
                        <circle
                          r={node.radius + (isSelected ? 8 : 0)}
                          fill={tone.glow}
                          opacity={isSelected ? 0.34 : 0.16}
                          filter="url(#node-glow)"
                        />
                        <circle
                          r={node.radius}
                          fill={tone.fill}
                          opacity={node.type === 'deck' ? 0.9 : 0.82}
                          stroke={isSelected ? '#f8fafc' : '#0f172a'}
                          strokeWidth={isSelected ? 2.5 : 1}
                        />
                        <circle r={Math.max(3, node.radius * 0.18)} fill="#f8fafc" opacity="0.72" />
                        {showLabels && (
                          <text
                            y={node.radius + 18}
                            textAnchor="middle"
                            fill={tone.text}
                            fontSize={node.type === 'deck' ? 13 : 11}
                            fontWeight={isSelected ? 700 : 500}
                          >
                            {node.label.length > 10 ? `${node.label.slice(0, 10)}...` : node.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}

            <div className="absolute left-4 bottom-4 px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-400" />题库</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />已掌握</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />学习中</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />薄弱</span>
              </div>
            </div>
          </div>

          <div className="w-80 border-l border-slate-800 bg-slate-950 flex flex-col">
            {selectedNode ? (
              <div className="p-5 border-b border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-900 border border-slate-800">
                    {selectedNode.type === 'deck' ? <BookOpen size={19} className="text-sky-300" /> : <Tag size={19} className="text-cyan-300" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white truncate">{selectedNode.label}</h3>
                    <p className="text-xs text-slate-500 mt-1">{selectedNode.type === 'deck' ? '题库节点' : '知识点节点'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <p className="text-xs text-slate-500">题目数量</p>
                    <p className="text-2xl font-semibold text-white mt-1">{selectedNode.count}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <p className="text-xs text-slate-500">掌握状态</p>
                    <p className="text-sm font-medium text-cyan-200 mt-2">{selectedNode.type === 'deck' ? '资料中心' : getMasteryLabel(selectedNode.mastery)}</p>
                  </div>
                </div>

                {selectedNode.type === 'tag' && (
                  <div className="mt-5">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-slate-400">掌握度</span>
                      <span className="text-slate-200">{selectedNode.mastery}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-slate-800">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          selectedNode.mastery >= 80 ? 'bg-green-500' :
                          selectedNode.mastery >= 60 ? 'bg-blue-500' :
                          selectedNode.mastery >= 35 ? 'bg-amber-500' : 'bg-red-500'
                        )}
                        style={{ width: `${selectedNode.mastery}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 text-center border-b border-slate-800">
                <Circle size={38} className="mx-auto mb-3 text-slate-700" />
                <p className="text-sm text-slate-500">点击节点查看详情</p>
              </div>
            )}

            <div className="p-4 border-b border-slate-800">
              <p className="text-xs font-medium text-slate-500 mb-3">关联节点</p>
              <div className="flex flex-wrap gap-2">
                {Array.from(connectedNodeIds).slice(0, 12).map(id => {
                  const node = nodeMap.get(id);
                  if (!node) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedNodeId(id)}
                      className="px-2.5 py-1 rounded-full text-xs bg-slate-900 border border-slate-800 text-slate-300 hover:border-cyan-400/50"
                    >
                      {node.label}
                    </button>
                  );
                })}
                {connectedNodeIds.size === 0 && <span className="text-xs text-slate-600">暂无关联</span>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs font-medium text-slate-500 mb-3">全部节点 ({nodes.length})</p>
              <div className="space-y-1.5">
                {nodes.map(node => {
                  const tone = getNodeTone(node);
                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={cn(
                        'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                        selectedNodeId === node.id ? 'bg-cyan-400/10 border border-cyan-400/30' : 'bg-slate-900/60 border border-transparent hover:border-slate-700'
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tone.fill }} />
                        <span className="text-sm text-slate-200 truncate">{node.label}</span>
                      </span>
                      <span className="text-xs text-slate-500 flex-shrink-0">{node.count} 题</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedModal>
  );
}
