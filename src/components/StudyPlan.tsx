/**
 * 学习计划制定器
 * 创建和管理学习计划
 */
import { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Target,
  Clock,
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  Edit2,
  Save
} from 'lucide-react';
import AnimatedModal from './ui/AnimatedModal';
import Button from './ui/Button';
import { cn } from '../lib/utils';

interface PlanItem {
  id: string;
  title: string;
  description?: string;
  targetQuestions: number;
  completedQuestions: number;
  startDate: string;
  endDate: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'paused';
}

interface StudyPlanProps {
  isOpen: boolean;
  onClose: () => void;
}

const planStorage = {
  getPlans: (): PlanItem[] => {
    const data = localStorage.getItem('study-plans');
    return data ? JSON.parse(data) : [];
  },
  savePlans: (plans: PlanItem[]) => {
    localStorage.setItem('study-plans', JSON.stringify(plans));
  },
};

const priorityColors = {
  low: { bg: 'bg-green-100', text: 'text-green-600', label: '低' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-600', label: '中' },
  high: { bg: 'bg-red-100', text: 'text-red-600', label: '高' },
};

export default function StudyPlan({ isOpen, onClose }: StudyPlanProps) {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const [newPlan, setNewPlan] = useState<{
    title: string;
    description: string;
    targetQuestions: number;
    startDate: string;
    endDate: string;
    tags: string[];
    priority: 'low' | 'medium' | 'high';
  }>({
    title: '',
    description: '',
    targetQuestions: 100,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    tags: [],
    priority: 'medium',
  });

  useEffect(() => {
    if (isOpen) loadPlans();
  }, [isOpen]);

  const loadPlans = () => setPlans(planStorage.getPlans());

  const handleAddPlan = () => {
    if (!newPlan.title.trim()) return;
    const plan: PlanItem = {
      ...newPlan,
      id: `plan_${Date.now()}`,
      completedQuestions: 0,
      status: 'active',
    };
    const updated = [...plans, plan];
    setPlans(updated);
    planStorage.savePlans(updated);
    setShowAddForm(false);
    resetForm();
  };

  const handleUpdatePlan = () => {
    if (!editingPlan) return;
    const updated = plans.map(p => p.id === editingPlan.id ? editingPlan : p);
    setPlans(updated);
    planStorage.savePlans(updated);
    setEditingPlan(null);
  };

  const handleDeletePlan = (id: string) => {
    const updated = plans.filter(p => p.id !== id);
    setPlans(updated);
    planStorage.savePlans(updated);
  };

  const handleToggleStatus = (id: string) => {
    const updated = plans.map(p => {
      if (p.id === id) {
        const newStatus: PlanItem['status'] = p.status === 'completed' ? 'active' : 'completed';
        return { ...p, status: newStatus };
      }
      return p;
    });
    setPlans(updated);
    planStorage.savePlans(updated);
  };

  const resetForm = () => {
    setNewPlan({
      title: '',
      description: '',
      targetQuestions: 100,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tags: [],
      priority: 'medium',
    });
  };

  const getProgress = (plan: PlanItem) => Math.min(100, Math.round((plan.completedQuestions / plan.targetQuestions) * 100));

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const filteredPlans = plans.filter(plan => filter === 'all' || plan.status === filter);

  const stats = {
    total: plans.length,
    active: plans.filter(p => p.status === 'active').length,
    completed: plans.filter(p => p.status === 'completed').length,
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white">
        <div className="p-4 border-b flex-shrink-0 border-gray-200 bg-gradient-to-r from-indigo-500 to-violet-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">学习计划</h2>
                <p className="text-xs text-white/80">制定和管理学习目标</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg"><X size={20} className="text-white" /></button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 p-4 border-b border-gray-100 bg-gray-50">
          <div className="p-3 rounded-xl text-center bg-white">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">总计划</p>
          </div>
          <div className="p-3 rounded-xl text-center bg-white">
            <p className="text-2xl font-bold text-blue-500">{stats.active}</p>
            <p className="text-xs text-gray-500">进行中</p>
          </div>
          <div className="p-3 rounded-xl text-center bg-white">
            <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
            <p className="text-xs text-gray-500">已完成</p>
          </div>
        </div>

        <div className="px-4 py-2 border-b flex items-center gap-2 border-gray-100">
          {(['all', 'active', 'completed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1 rounded-lg text-sm font-medium", filter === f ? "bg-indigo-500 text-white" : "text-gray-600")}>
              {f === 'all' ? '全部' : f === 'active' ? '进行中' : '已完成'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredPlans.length === 0 ? (
            <div className="text-center py-12">
              <Target size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">暂无学习计划</p>
              <p className="text-sm text-gray-400">创建计划开始有目标的学习</p>
            </div>
          ) : filteredPlans.map(plan => {
            const progress = getProgress(plan);
            const daysRemaining = getDaysRemaining(plan.endDate);
            const isOverdue = daysRemaining < 0 && plan.status === 'active';
            return (
              <div key={plan.id} className={cn("p-4 rounded-xl border", plan.status === 'completed' ? "border-green-200 bg-green-50" : isOverdue ? "border-red-200 bg-red-50" : "border-gray-200 bg-white")}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <button onClick={() => handleToggleStatus(plan.id)} className="mt-0.5">
                      {plan.status === 'completed' ? <CheckCircle size={20} className="text-green-500" /> : <Circle size={20} className="text-gray-400" />}
                    </button>
                    <div>
                      <h3 className={cn("font-medium text-gray-900", plan.status === 'completed' && "line-through opacity-60")}>{plan.title}</h3>
                      {plan.description && <p className="text-sm mt-1 text-gray-500">{plan.description}</p>}
                    </div>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium", priorityColors[plan.priority].bg, priorityColors[plan.priority].text)}>{priorityColors[plan.priority].label}优先级</span>
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-500">进度: {plan.completedQuestions}/{plan.targetQuestions} 题</span>
                    <span className={cn("font-medium", progress >= 100 ? "text-green-500" : "text-gray-900")}>{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-gray-200">
                    <div className={cn("h-full rounded-full", progress >= 100 ? "bg-green-500" : "bg-indigo-500")} style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-gray-500"><Calendar size={14} />{plan.startDate} ~ {plan.endDate}</span>
                    {plan.status === 'active' && <span className={cn("flex items-center gap-1", isOverdue ? "text-red-500" : daysRemaining <= 3 ? "text-orange-500" : "text-gray-500")}><Clock size={14} />{isOverdue ? `已逾期 ${Math.abs(daysRemaining)} 天` : `剩余 ${daysRemaining} 天`}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditingPlan(plan)} className="p-1.5 rounded-lg text-gray-500"><Edit2 size={14} /></button>
                    <button onClick={() => handleDeletePlan(plan.id)} className="p-1.5 rounded-lg text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showAddForm && (
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <h3 className="text-sm font-medium mb-3 text-gray-900">创建新计划</h3>
            <div className="space-y-3">
              <input type="text" value={newPlan.title} onChange={e => setNewPlan({ ...newPlan, title: e.target.value })} placeholder="计划名称" className="w-full px-3 py-2 rounded-lg text-sm bg-white text-gray-900" />
              <textarea value={newPlan.description} onChange={e => setNewPlan({ ...newPlan, description: e.target.value })} placeholder="描述（可选）" rows={2} className="w-full px-3 py-2 rounded-lg text-sm resize-none bg-white text-gray-900" />
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-xs mb-1 block text-gray-500">目标题数</label><input type="number" value={newPlan.targetQuestions} onChange={e => setNewPlan({ ...newPlan, targetQuestions: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg text-sm bg-white text-gray-900" /></div>
                <div><label className="text-xs mb-1 block text-gray-500">开始日期</label><input type="date" value={newPlan.startDate} onChange={e => setNewPlan({ ...newPlan, startDate: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm bg-white text-gray-900" /></div>
                <div><label className="text-xs mb-1 block text-gray-500">结束日期</label><input type="date" value={newPlan.endDate} onChange={e => setNewPlan({ ...newPlan, endDate: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm bg-white text-gray-900" /></div>
              </div>
              <div><label className="text-xs mb-1 block text-gray-500">优先级</label><div className="flex gap-2">{(['low', 'medium', 'high'] as const).map(p => (<button key={p} onClick={() => setNewPlan({ ...newPlan, priority: p })} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium", newPlan.priority === p ? cn(priorityColors[p].bg, priorityColors[p].text) : "bg-gray-200 text-gray-600")}>{priorityColors[p].label}</button>))}</div></div>
              <div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={() => setShowAddForm(false)}>取消</Button><Button className="flex-1" onClick={handleAddPlan}>创建计划</Button></div>
            </div>
          </div>
        )}

        {editingPlan && (
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <h3 className="text-sm font-medium mb-3 text-gray-900">编辑计划</h3>
            <div className="space-y-3">
              <input type="text" value={editingPlan.title} onChange={e => setEditingPlan({ ...editingPlan, title: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm bg-white text-gray-900" />
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs mb-1 block text-gray-500">已完成题数</label><input type="number" value={editingPlan.completedQuestions} onChange={e => setEditingPlan({ ...editingPlan, completedQuestions: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg text-sm bg-white text-gray-900" /></div>
                <div><label className="text-xs mb-1 block text-gray-500">目标题数</label><input type="number" value={editingPlan.targetQuestions} onChange={e => setEditingPlan({ ...editingPlan, targetQuestions: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg text-sm bg-white text-gray-900" /></div>
              </div>
              <div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={() => setEditingPlan(null)}>取消</Button><Button className="flex-1" leftIcon={<Save size={16} />} onClick={handleUpdatePlan}>保存</Button></div>
            </div>
          </div>
        )}

        {!showAddForm && !editingPlan && (
          <div className="p-4 border-t border-gray-100">
            <Button className="w-full" leftIcon={<Plus size={18} />} onClick={() => setShowAddForm(true)}>创建学习计划</Button>
          </div>
        )}
      </div>
    </AnimatedModal>
  );
}
