/**
 * 知识点关联图
 * 可视化展示知识点之间的关系
 */
import { useState, useEffect, useMemo } from 'react';
import { X, Network, ZoomIn, ZoomOut, Tag, ChevronRight, Circle } from 'lucide-react';
import AnimatedModal from './ui/AnimatedModal';
import { cn } from '../lib/utils';
import { db } from '../lib/database';

interface KnowledgeNode {
  id: string;
  name: string;
  count: number;
  mastery: number;
  connections: string[];
}

interface KnowledgeGraphProps {
  isOpen: boolean;
  onClose: () => void;
  deckId?: string;
}

export default function KnowledgeGraph({ isOpen, onClose, deckId }: KnowledgeGraphProps) {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadKnowledgeData();
    }
  }, [isOpen, deckId]);

  const loadKnowledgeData = async () => {
    setLoading(true);
    try {
      let questions = await db.questions.toArray();
      if (deckId) {
        questions = questions.filter(q => q.deckId === deckId);
      }

      let cards = await db.cards.toArray();
      if (deckId) {
        cards = cards.filter(c => c.deckId === deckId);
      }

      const tagMap = new Map<string, { count: number; questionIds: string[]; correctCount: number; totalCount: number }>();
      questions.forEach(q => {
        const tags = q.tags || [];
        tags.forEach(tag => {
          const existing = tagMap.get(tag) || { count: 0, questionIds: [], correctCount: 0, totalCount: 0 };
          existing.count++;
          existing.questionIds.push(q.id);
          tagMap.set(tag, existing);
        });
      });

      const filteredTagMap = new Map<string, { count: number; questionIds: string[]; correctCount: number; totalCount: number }>();
      tagMap.forEach((data, tag) => {
        if (data.count >= 3) {
          filteredTagMap.set(tag, data);
        }
      });

      cards.forEach(card => {
        const question = questions.find(q => q.id === card.questionId);
        if (question && question.tags) {
          question.tags.forEach(tag => {
            const tagData = filteredTagMap.get(tag);
            if (tagData) {
              tagData.totalCount++;
              if (card.state === 'review') {
                tagData.correctCount++;
              }
            }
          });
        }
      });

      const connectionMap = new Map<string, Set<string>>();
      questions.forEach(q => {
        const tags = (q.tags || []).filter(tag => filteredTagMap.has(tag));
        tags.forEach(tag1 => {
          tags.forEach(tag2 => {
            if (tag1 !== tag2) {
              const connections = connectionMap.get(tag1) || new Set();
              connections.add(tag2);
              connectionMap.set(tag1, connections);
            }
          });
        });
      });

      const knowledgeNodes: KnowledgeNode[] = [];
      filteredTagMap.forEach((data, tag) => {
        const mastery = data.totalCount > 0 ? Math.round((data.correctCount / data.totalCount) * 100) : 0;
        knowledgeNodes.push({
          id: tag,
          name: tag,
          count: data.count,
          mastery,
          connections: Array.from(connectionMap.get(tag) || []),
        });
      });

      knowledgeNodes.sort((a, b) => b.count - a.count);
      const topNodes = knowledgeNodes.slice(0, 15);
      setNodes(topNodes);
    } catch (error) {
      console.error('Failed to load knowledge data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMasteryColor = (mastery: number) => {
    if (mastery >= 80) return 'bg-green-500';
    if (mastery >= 60) return 'bg-blue-500';
    if (mastery >= 40) return 'bg-yellow-500';
    if (mastery >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getMasteryLabel = (mastery: number) => {
    if (mastery >= 80) return '精通';
    if (mastery >= 60) return '熟练';
    if (mastery >= 40) return '掌握';
    if (mastery >= 20) return '学习中';
    return '待学习';
  };

  const getNodeSize = (count: number) => {
    const maxCount = Math.max(...nodes.map(n => n.count), 1);
    const minSize = 40;
    const maxSize = 100;
    return minSize + (count / maxCount) * (maxSize - minSize);
  };

  const nodePositions = useMemo(() => {
    if (nodes.length === 0) return [];
    const centerX = 300;
    const centerY = 250;
    const radius = 180;

    return nodes.slice(0, 12).map((node, index) => {
      const angle = (index / Math.min(nodes.length, 12)) * 2 * Math.PI - Math.PI / 2;
      const r = radius * (0.6 + Math.random() * 0.4);
      return {
        node,
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      };
    });
  }, [nodes]);

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b flex-shrink-0 border-gray-200 bg-gradient-to-r from-cyan-500 to-teal-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Network className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">知识图谱</h2>
                <p className="text-xs text-white/80">可视化知识点关联</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="p-2 rounded-lg text-white">
                <ZoomIn size={18} />
              </button>
              <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} className="p-2 rounded-lg text-white">
                <ZoomOut size={18} />
              </button>
              <button onClick={onClose} className="p-2 rounded-lg">
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Graph Area */}
          <div className="flex-1 relative overflow-hidden bg-gray-50">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
              </div>
            ) : nodes.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Network size={48} className="text-gray-300" />
                <p className="mt-4 text-lg font-medium text-gray-500">暂无知识点数据</p>
                <p className="text-sm text-gray-400">导入题目并添加标签后显示</p>
              </div>
            ) : (
              <svg
                width="100%"
                height="500"
                viewBox="0 0 600 500"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
              >
                {/* 连接线 */}
                {nodePositions.map((pos1) =>
                  pos1.node.connections.slice(0, 3).map((connId, j) => {
                    const pos2 = nodePositions.find(p => p.node.id === connId);
                    if (!pos2) return null;
                    return (
                      <line
                        key={`${pos1.node.id}-${connId}-${j}`}
                        x1={pos1.x}
                        y1={pos1.y}
                        x2={pos2.x}
                        y2={pos2.y}
                        stroke="#e5e7eb"
                        strokeWidth="2"
                        opacity="0.5"
                      />
                    );
                  })
                )}

                {/* 节点 */}
                {nodePositions.map((pos) => {
                  const size = getNodeSize(pos.node.count);
                  const isSelected = selectedNode?.id === pos.node.id;
                  return (
                    <g
                      key={pos.node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onClick={() => setSelectedNode(isSelected ? null : pos.node)}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle
                        r={size / 2}
                        className={cn(getMasteryColor(pos.node.mastery))}
                        opacity={isSelected ? 1 : 0.8}
                        stroke={isSelected ? "#fff" : "none"}
                        strokeWidth={isSelected ? 3 : 0}
                      />
                      <text
                        textAnchor="middle"
                        dy="0.35em"
                        fill="white"
                        fontSize={Math.max(10, size / 5)}
                        fontWeight="500"
                      >
                        {pos.node.name.length > 6 ? pos.node.name.slice(0, 6) + '...' : pos.node.name}
                      </text>
                      <text textAnchor="middle" dy={size / 4 + 8} fill="white" fontSize="10" opacity="0.8">
                        {pos.node.count}题
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* 图例 */}
            <div className="absolute bottom-4 left-4 p-3 rounded-lg bg-white/90">
              <p className="text-xs font-medium mb-2 text-gray-600">掌握程度</p>
              <div className="flex flex-col gap-1">
                {[
                  { color: 'bg-green-500', label: '精通 ≥80%' },
                  { color: 'bg-blue-500', label: '熟练 ≥60%' },
                  { color: 'bg-yellow-500', label: '掌握 ≥40%' },
                  { color: 'bg-orange-500', label: '学习中 ≥20%' },
                  { color: 'bg-red-500', label: '待学习 <20%' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", item.color)} />
                    <span className="text-xs text-gray-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="w-72 border-l flex flex-col border-gray-200 bg-white">
            {selectedNode ? (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Tag size={18} className="text-cyan-500" />
                  <h3 className="font-medium text-gray-900">{selectedNode.name}</h3>
                </div>
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-600">题目数量</span>
                      <span className="font-bold text-gray-900">{selectedNode.count} 题</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-600">掌握程度</span>
                      <span
                        className={cn(
                          "font-bold",
                          selectedNode.mastery >= 60 ? "text-green-500" :
                          selectedNode.mastery >= 40 ? "text-yellow-500" : "text-red-500"
                        )}
                      >
                        {selectedNode.mastery}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">状态</span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          getMasteryColor(selectedNode.mastery),
                          "text-white"
                        )}
                      >
                        {getMasteryLabel(selectedNode.mastery)}
                      </span>
                    </div>
                  </div>

                  {selectedNode.connections.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2 text-gray-600">关联知识点</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.connections.slice(0, 8).map(conn => (
                          <button
                            key={conn}
                            onClick={() => {
                              const node = nodes.find(n => n.id === conn);
                              if (node) setSelectedNode(node);
                            }}
                            className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600"
                          >
                            {conn}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-500">学习进度</span>
                      <span className="text-gray-600">{selectedNode.mastery}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-gray-200">
                      <div
                        className={cn("h-full rounded-full", getMasteryColor(selectedNode.mastery))}
                        style={{ width: `${selectedNode.mastery}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center">
                <Circle size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500">点击知识点节点查看详情</p>
              </div>
            )}

            {/* 知识点列表 */}
            <div className="flex-1 border-t overflow-y-auto border-gray-200">
              <div className="p-3">
                <p className="text-xs font-medium mb-2 text-gray-500">所有知识点 ({nodes.length})</p>
                <div className="space-y-1">
                  {nodes.slice(0, 20).map(node => (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-lg text-left",
                        selectedNode?.id === node.id ? "bg-cyan-50" : ""
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", getMasteryColor(node.mastery))} />
                        <span className="text-sm truncate max-w-[120px] text-gray-700">{node.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{node.count}题</span>
                        <ChevronRight size={14} className="text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedModal>
  );
}
