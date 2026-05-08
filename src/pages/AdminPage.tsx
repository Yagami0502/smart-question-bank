/**
 * 管理员页面 - 系统管理控制台
 */
import { useState, useEffect } from 'react';
import {
  Users,
  BookOpen,
  FileText,
  BarChart3,
  Search,
  Ban,
  Trash2,
  Shield,
  ShieldCheck,
  Globe,
  Lock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  GraduationCap,
  Activity,
  Plus,
  Upload,
  Edit3,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Modal, ModalContent, ModalFooter } from '../components/ui/Modal';

import { dialog } from '../components/ui/ConfirmDialog';
import { authFetch } from '../lib/auth';

// 管理员页面标签类型
type AdminTab = 'overview' | 'users' | 'decks' | 'vocabulary';

interface AdminPageProps {
  initialTab?: AdminTab | null;
  onBack: () => void;
  onNavigate: (view: string, data?: any) => void;
}

// 系统概览统计类型
interface SystemStats {
  users: { total: number; active: number; banned: number; newToday: number };
  decks: { total: number; public: number };
  questions: { total: number };
  vocabulary: { totalBooks: number; builtInBooks: number; userPublicBooks: number; totalWords: number };
  today: { activeLearners: number; reviews: number };
}

// 用户类型
interface AdminUser {
  id: string;
  username: string;
  email: string;
  nickname: string;
  avatar?: string;
  role: 'user' | 'admin';
  status: 'active' | 'banned';
  createdAt: number;
  lastLoginAt?: number;
  loginCount: number;
  totalStudyDays: number;
  totalQuestionsAnswered: number;
}

// 题库类型
interface AdminDeck {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  isBuiltIn: boolean;
  questionCount: number;
  authorId: string;
  authorName: string;
  createdAt: number;
}

// 词库类型
interface AdminVocabBook {
  id: string;
  name: string;
  description?: string;
  category?: string;
  wordCount: number;
  isBuiltIn: boolean;
  isPublic: boolean;
  createdAt: number;
}

// 分页类型
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminPage({ initialTab, onBack, onNavigate }: AdminPageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab ?? 'overview');
  const [loading, setLoading] = useState(false);
  
  // 概览数据
  const [stats, setStats] = useState<SystemStats | null>(null);
  
  // 用户管理
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userPagination, setUserPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('');
  
  // 题库管理
  const [decks, setDecks] = useState<AdminDeck[]>([]);
  const [deckPagination, setDeckPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [deckSearch, setDeckSearch] = useState('');
  const [deckTypeFilter, setDeckTypeFilter] = useState<string>('');
  
  // 词库管理
  const [vocabBooks, setVocabBooks] = useState<AdminVocabBook[]>([]);
  const [vocabPagination, setVocabPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [vocabSearch, setVocabSearch] = useState('');
  const [vocabTypeFilter, setVocabTypeFilter] = useState<string>('');

  // 创建内置内容
  const [showCreateDeckModal, setShowCreateDeckModal] = useState(false);
  const [showCreateVocabModal, setShowCreateVocabModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');
  const [newVocabName, setNewVocabName] = useState('');
  const [newVocabDesc, setNewVocabDesc] = useState('');

  // 编辑题库
  const [showEditDeckModal, setShowEditDeckModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState<AdminDeck | null>(null);
  const [editDeckName, setEditDeckName] = useState('');
  const [editDeckDesc, setEditDeckDesc] = useState('');

  // 编辑词库
  const [showEditVocabModal, setShowEditVocabModal] = useState(false);
  const [editingVocab, setEditingVocab] = useState<AdminVocabBook | null>(null);
  const [editVocabName, setEditVocabName] = useState('');
  const [editVocabDesc, setEditVocabDesc] = useState('');

  // 加载概览数据
  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/admin/stats/overview');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        dialog.error('获取统计数据失败');
      }
    } catch (error) {
      console.error('加载统计失败:', error);
      dialog.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载用户列表
  const loadUsers = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (userSearch) params.append('search', userSearch);
      if (userStatusFilter) params.append('status', userStatusFilter);
      
      const res = await authFetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setUserPagination(data.pagination);
      }
    } catch (error) {
      console.error('加载用户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载题库列表
  const loadDecks = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (deckSearch) params.append('search', deckSearch);
      if (deckTypeFilter === 'builtin') params.append('isBuiltIn', 'true');
      if (deckTypeFilter === 'user') params.append('isBuiltIn', 'false');
      
      const res = await authFetch(`/api/admin/decks?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDecks(data.decks);
        setDeckPagination(data.pagination);
      }
    } catch (error) {
      console.error('加载题库失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载词库列表
  const loadVocabBooks = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (vocabSearch) params.append('search', vocabSearch);
      if (vocabTypeFilter === 'builtin') params.append('isBuiltIn', 'true');
      if (vocabTypeFilter === 'user') params.append('isBuiltIn', 'false');
      
      const res = await authFetch(`/api/admin/vocabulary/books?${params}`);
      if (res.ok) {
        const data = await res.json();
        setVocabBooks(data.books);
        setVocabPagination(data.pagination);
      }
    } catch (error) {
      console.error('加载词库失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载
  useEffect(() => {
    if (activeTab === 'overview') loadStats();
    else if (activeTab === 'users') loadUsers();
    else if (activeTab === 'decks') loadDecks();
    else if (activeTab === 'vocabulary') loadVocabBooks();
  }, [activeTab]);

  // 监听题库筛选变化
  useEffect(() => {
    if (activeTab === 'decks') {
      loadDecks(1);
    }
  }, [deckTypeFilter]);

  // 监听词库筛选变化
  useEffect(() => {
    if (activeTab === 'vocabulary') {
      loadVocabBooks(1);
    }
  }, [vocabTypeFilter]);

  // 用户操作
  const handleToggleUserStatus = async (user: AdminUser) => {
    const newStatus = user.status === 'active' ? 'banned' : 'active';
    const action = newStatus === 'banned' ? '禁用' : '启用';
    
    const confirmed = await dialog.confirm(`确定要${action}用户「${user.nickname || user.username}」吗？`, {
      title: `${action}用户`,
      isDanger: newStatus === 'banned',
    });
    
    if (!confirmed) return;
    
    try {
      const res = await authFetch(`/api/admin/users/${user.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (res.ok) {
        dialog.success(`用户已${action}`);
        loadUsers(userPagination.page);
      } else {
        const data = await res.json();
        dialog.error(data.error || '操作失败');
      }
    } catch (error) {
      dialog.error('操作失败');
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    const confirmed = await dialog.confirm(
      `确定要删除用户「${user.nickname || user.username}」吗？此操作不可恢复！`,
      { title: '删除用户', isDanger: true }
    );
    
    if (!confirmed) return;
    
    try {
      const res = await authFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      if (res.ok) {
        dialog.success('用户已删除');
        loadUsers(userPagination.page);
      } else {
        const data = await res.json();
        dialog.error(data.error || '删除失败');
      }
    } catch (error) {
      dialog.error('删除失败');
    }
  };

  const handleToggleUserRole = async (user: AdminUser) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const action = newRole === 'admin' ? '设为管理员' : '取消管理员';
    
    const confirmed = await dialog.confirm(`确定要将用户「${user.nickname || user.username}」${action}吗？`, {
      title: '修改角色',
    });
    
    if (!confirmed) return;
    
    try {
      const res = await authFetch(`/api/admin/users/${user.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      
      if (res.ok) {
        dialog.success('角色已更新');
        loadUsers(userPagination.page);
      } else {
        const data = await res.json();
        dialog.error(data.error || '操作失败');
      }
    } catch (error) {
      dialog.error('操作失败');
    }
  };

  // 题库操作
  const handleToggleDeckPublic = async (deck: AdminDeck) => {
    const newIsPublic = !deck.isPublic;
    try {
      const res = await authFetch(`/api/admin/decks/${deck.id}/public`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: newIsPublic }),
      });
      
      if (res.ok) {
        dialog.success(newIsPublic ? '题库已公开' : '题库已设为私有');
        loadDecks(deckPagination.page);
      }
    } catch (error) {
      dialog.error('操作失败');
    }
  };

  const handleDeleteDeck = async (deck: AdminDeck) => {
    const confirmed = await dialog.confirm(
      `确定要删除题库「${deck.name}」吗？所有题目将被删除！`,
      { title: '删除题库', isDanger: true }
    );
    
    if (!confirmed) return;
    
    try {
      const res = await authFetch(`/api/admin/decks/${deck.id}`, { method: 'DELETE' });
      if (res.ok) {
        dialog.success('题库已删除');
        loadDecks(deckPagination.page);
      }
    } catch (error) {
      dialog.error('删除失败');
    }
  };

  // 编辑题库
  const handleEditDeck = (deck: AdminDeck) => {
    setEditingDeck(deck);
    setEditDeckName(deck.name);
    setEditDeckDesc(deck.description || '');
    setShowEditDeckModal(true);
  };

  const handleSaveEditDeck = async () => {
    if (!editingDeck || !editDeckName.trim()) {
      dialog.warning('请输入题库名称');
      return;
    }
    
    try {
      const res = await authFetch(`/api/admin/decks/${editingDeck.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editDeckName.trim(),
          description: editDeckDesc.trim() || null,
        }),
      });
      
      if (res.ok) {
        dialog.success('题库已更新');
        setShowEditDeckModal(false);
        setEditingDeck(null);
        loadDecks(deckPagination.page);
      } else {
        const data = await res.json();
        dialog.error(data.error || '更新失败');
      }
    } catch (error) {
      dialog.error('更新失败');
    }
  };

  // 词库操作
  const handleToggleVocabPublic = async (book: AdminVocabBook) => {
    const newIsPublic = !book.isPublic;
    try {
      const res = await authFetch(`/api/admin/vocabulary/books/${book.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: newIsPublic }),
      });
      
      if (res.ok) {
        dialog.success(newIsPublic ? '词库已公开' : '词库已设为私有');
        loadVocabBooks(vocabPagination.page);
      }
    } catch (error) {
      dialog.error('操作失败');
    }
  };

  const handleDeleteVocabBook = async (book: AdminVocabBook) => {
    const confirmed = await dialog.confirm(
      `确定要删除词库「${book.name}」吗？所有单词将被删除！`,
      { title: '删除词库', isDanger: true }
    );
    
    if (!confirmed) return;
    
    try {
      const res = await authFetch(`/api/admin/vocabulary/books/${book.id}`, { method: 'DELETE' });
      if (res.ok) {
        dialog.success('词库已删除');
        loadVocabBooks(vocabPagination.page);
      } else {
        const data = await res.json();
        dialog.error(data.error || '删除失败');
      }
    } catch (error) {
      dialog.error('删除失败');
    }
  };

  // 编辑词库
  const handleEditVocab = (book: AdminVocabBook) => {
    setEditingVocab(book);
    setEditVocabName(book.name);
    setEditVocabDesc(book.description || '');
    setShowEditVocabModal(true);
  };

  // 保存编辑的词库
  const handleSaveEditVocab = async () => {
    if (!editingVocab || !editVocabName.trim()) return;
    
    try {
      const res = await authFetch(`/api/admin/vocabulary/books/${editingVocab.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editVocabName.trim(),
          description: editVocabDesc.trim() || null,
        }),
      });
      
      if (res.ok) {
        dialog.success('词库已更新');
        setShowEditVocabModal(false);
        setEditingVocab(null);
        loadVocabBooks(vocabPagination.page);
      } else {
        const data = await res.json();
        dialog.error(data.error || '更新失败');
      }
    } catch (error) {
      dialog.error('更新失败');
    }
  };

  // 创建内置题库
  const handleCreateBuiltInDeck = async () => {
    if (!newDeckName.trim()) {
      dialog.warning('请输入题库名称');
      return;
    }
    
    try {
      const res = await authFetch('/api/admin/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDeckName.trim(),
          description: newDeckDesc.trim() || null,
          isBuiltIn: true,
          isPublic: true,
        }),
      });
      
      if (res.ok) {
        dialog.success('内置题库创建成功');
        setShowCreateDeckModal(false);
        setNewDeckName('');
        setNewDeckDesc('');
        loadDecks(1);
      } else {
        const data = await res.json();
        dialog.error(data.error || '创建失败');
      }
    } catch (error) {
      dialog.error('创建失败');
    }
  };

  // 创建内置词库
  const handleCreateBuiltInVocab = async () => {
    if (!newVocabName.trim()) {
      dialog.warning('请输入词库名称');
      return;
    }
    
    try {
      const res = await authFetch('/api/admin/vocabulary/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVocabName.trim(),
          description: newVocabDesc.trim() || null,
          isBuiltIn: true,
          isPublic: true,
        }),
      });
      
      if (res.ok) {
        dialog.success('内置词库创建成功');
        setShowCreateVocabModal(false);
        setNewVocabName('');
        setNewVocabDesc('');
        loadVocabBooks(1);
      } else {
        const data = await res.json();
        dialog.error(data.error || '创建失败');
      }
    } catch (error) {
      dialog.error('创建失败');
    }
  };

  // 格式化日期
  const formatDate = (timestamp: number) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // 渲染分页组件
  const renderPagination = (pagination: Pagination, onPageChange: (page: number) => void) => (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
      <span className="text-sm text-gray-600">
        共 {pagination.total} 条，第 {pagination.page}/{pagination.totalPages} 页
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
          leftIcon={<ChevronLeft size={14} />}
        >
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
          rightIcon={<ChevronRight size={14} />}
        >
          下一页
        </Button>
      </div>
    </div>
  );

  // 渲染概览页
  const renderOverview = () => (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : stats ? (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Users size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{stats.users.total}</div>
                    <div className="text-xs text-gray-500">总用户数</div>
                  </div>
                </div>
                <div className="mt-3 flex gap-3 text-xs">
                  <span className="text-green-600">活跃 {stats.users.active}</span>
                  <span className="text-red-600">禁用 {stats.users.banned}</span>
                  <span className="text-blue-600">今日新增 {stats.users.newToday}</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <BookOpen size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{stats.decks.total}</div>
                    <div className="text-xs text-gray-500">题库数量</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-600">
                  公开题库 {stats.decks.public} 个
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <FileText size={20} className="text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{stats.questions.total}</div>
                    <div className="text-xs text-gray-500">题目总数</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                    <GraduationCap size={20} className="text-orange-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{stats.vocabulary.totalWords}</div>
                    <div className="text-xs text-gray-500">单词总数</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-600">
                  词库 {stats.vocabulary.totalBooks} 个（内置 {stats.vocabulary.builtInBooks}）
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* 今日活跃 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-primary-600" />
                <span className="font-semibold">今日活跃</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50">
                  <div className="text-3xl font-bold text-blue-600">{stats.today.activeLearners}</div>
                  <div className="text-sm text-blue-600/80">活跃学习者</div>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50">
                  <div className="text-3xl font-bold text-green-600">{stats.today.reviews}</div>
                  <div className="text-sm text-green-600/80">今日复习次数</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );

  // 渲染用户管理页
  const renderUsers = () => (
    <div className="space-y-4">
      {/* 搜索和筛选 */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索用户名、邮箱或昵称..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadUsers(1)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-white/30 bg-white/50 backdrop-blur-sm outline-none focus:border-primary-500 focus:bg-white/70 transition-all"
          />
        </div>
        <select
          value={userStatusFilter}
          onChange={(e) => { setUserStatusFilter(e.target.value); }}
          className="px-3 py-2 rounded-xl border border-white/30 bg-white/50 backdrop-blur-sm outline-none focus:border-primary-500 focus:bg-white/70 transition-all"
        >
          <option value="">全部状态</option>
          <option value="active">正常</option>
          <option value="banned">已禁用</option>
        </select>
        <Button onClick={() => loadUsers(1)} leftIcon={<Search size={14} />}>搜索</Button>
      </div>
      
      {/* 用户列表 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-500">暂无用户数据</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/30 border-b border-white/20">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">邮箱</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">学习统计</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">注册时间</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center overflow-hidden">
                            {user.avatar ? (
                              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Users size={14} className="text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">{user.nickname || user.username}</div>
                            <div className="text-xs text-gray-500">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'admin' ? 'bg-purple-100/80 text-purple-700' : 'bg-gray-100/80 text-gray-600'
                        }`}>
                          {user.role === 'admin' ? <ShieldCheck size={12} /> : <Shield size={12} />}
                          {user.role === 'admin' ? '管理员' : '用户'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.status === 'active' ? 'bg-green-100/80 text-green-700' : 'bg-red-100/80 text-red-700'
                        }`}>
                          {user.status === 'active' ? '正常' : '已禁用'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div>学习 {user.totalStudyDays} 天</div>
                        <div className="text-xs text-gray-400">答题 {user.totalQuestionsAnswered} 次</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleToggleUserRole(user)}
                            className="p-1.5 rounded-lg hover:bg-white/50 text-gray-500 transition-colors"
                            title={user.role === 'admin' ? '取消管理员' : '设为管理员'}
                          >
                            {user.role === 'admin' ? <Shield size={14} /> : <ShieldCheck size={14} />}
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(user)}
                            className={`p-1.5 rounded-lg hover:bg-white/50 transition-colors ${user.status === 'active' ? 'text-orange-500' : 'text-green-500'}`}
                            title={user.status === 'active' ? '禁用' : '启用'}
                          >
                            <Ban size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {users.length > 0 && (
            <div className="px-4 pb-4">
              {renderPagination(userPagination, loadUsers)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // 渲染题库管理页（只显示公开题库）
  const renderDecks = () => (
    <div className="space-y-4">
      {/* 提示信息和创建按钮 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-700 flex-1 min-w-[200px] backdrop-blur-sm">
          <Globe size={14} className="inline mr-2" />
          管理员可以创建内置题库并导入题目，用户公开的题库也会显示在这里
        </div>
        <Button onClick={() => setShowCreateDeckModal(true)} leftIcon={<Plus size={14} />}>
          创建内置题库
        </Button>
      </div>
      
      {/* 搜索和筛选 */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索公开题库名称或描述..."
            value={deckSearch}
            onChange={(e) => setDeckSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadDecks(1)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-white/30 bg-white/50 backdrop-blur-sm outline-none focus:border-primary-500 focus:bg-white/70 transition-all"
          />
        </div>
        <select
          value={deckTypeFilter}
          onChange={(e) => { setDeckTypeFilter(e.target.value); }}
          className="px-3 py-2 rounded-xl border border-white/30 bg-white/50 backdrop-blur-sm outline-none focus:border-primary-500 focus:bg-white/70 transition-all"
        >
          <option value="">全部公开题库</option>
          <option value="builtin">内置题库</option>
          <option value="user">用户公开题库</option>
        </select>
        <Button onClick={() => loadDecks(1)} leftIcon={<Search size={14} />}>搜索</Button>
        <Button variant="outline" onClick={() => loadDecks(deckPagination.page)} leftIcon={<RefreshCw size={14} />}>刷新</Button>
      </div>
      
      {/* 题库列表 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : decks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">暂无公开题库，点击上方按钮创建内置题库</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/30 border-b border-white/20">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">题库名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">作者</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">题目数</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {decks.map(deck => (
                    <tr key={deck.id} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Globe size={14} className="text-green-500 flex-shrink-0" />
                          <div>
                            <div className="font-medium text-gray-800">{deck.name}</div>
                            {deck.description && (
                              <div className="text-xs text-gray-500 truncate max-w-xs">{deck.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{deck.authorName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{deck.questionCount} 题</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          deck.isBuiltIn ? 'bg-blue-100/80 text-blue-700' : 'bg-purple-100/80 text-purple-700'
                        }`}>
                          {deck.isBuiltIn ? '内置' : '用户公开'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(deck.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEditDeck(deck)}
                            className="p-1.5 rounded-lg hover:bg-white/50 text-blue-500 transition-colors"
                            title="编辑"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => onNavigate('import', { id: deck.id, name: deck.name })}
                            className="p-1.5 rounded-lg hover:bg-white/50 text-green-500 transition-colors"
                            title="导入题目"
                          >
                            <Upload size={14} />
                          </button>
                          {!deck.isBuiltIn && (
                            <button
                              onClick={() => handleToggleDeckPublic(deck)}
                              className="p-1.5 rounded-lg hover:bg-white/50 text-orange-500 transition-colors"
                              title="设为私有"
                            >
                              <Lock size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteDeck(deck)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {decks.length > 0 && (
            <div className="px-4 pb-4">
              {renderPagination(deckPagination, loadDecks)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // 渲染词库管理页（只显示公开词库）
  const renderVocabulary = () => (
    <div className="space-y-4">
      {/* 提示信息和创建按钮 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-700 flex-1 min-w-[200px] backdrop-blur-sm">
          <Globe size={14} className="inline mr-2" />
          管理员可以创建内置词库并导入单词，用户公开的词库也会显示在这里
        </div>
        <Button onClick={() => setShowCreateVocabModal(true)} leftIcon={<Plus size={14} />}>
          创建内置词库
        </Button>
      </div>
      
      {/* 搜索和筛选 */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索公开词库名称..."
            value={vocabSearch}
            onChange={(e) => setVocabSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadVocabBooks(1)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-white/30 bg-white/50 backdrop-blur-sm outline-none focus:border-primary-500 focus:bg-white/70 transition-all"
          />
        </div>
        <select
          value={vocabTypeFilter}
          onChange={(e) => setVocabTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-white/30 bg-white/50 backdrop-blur-sm outline-none focus:border-primary-500 focus:bg-white/70 transition-all"
        >
          <option value="">全部公开词库</option>
          <option value="builtin">内置词库</option>
          <option value="user">用户公开词库</option>
        </select>
        <Button onClick={() => loadVocabBooks(1)} leftIcon={<Search size={14} />}>搜索</Button>
      </div>
      
      {/* 词库列表 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : vocabBooks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">暂无公开词库，点击上方按钮创建内置词库</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/30 border-b border-white/20">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">词库名称</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">单词数</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {vocabBooks.map(book => (
                    <tr key={book.id} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Globe size={14} className="text-green-500 flex-shrink-0" />
                          <div>
                            <div className="font-medium text-gray-800">{book.name}</div>
                            {book.description && (
                              <div className="text-xs text-gray-500 truncate max-w-xs">{book.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{book.wordCount} 词</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          book.isBuiltIn ? 'bg-blue-100/80 text-blue-700' : 'bg-purple-100/80 text-purple-700'
                        }`}>
                          {book.isBuiltIn ? '内置' : '用户公开'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(book.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEditVocab(book)}
                            className="p-1.5 rounded-lg hover:bg-white/50 text-blue-500 transition-colors"
                            title="编辑"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => onNavigate('vocabulary-import', { bookId: book.id, bookName: book.name, sourceView: 'admin', sourceTab: 'vocabulary' })}
                            className="p-1.5 rounded-lg hover:bg-white/50 text-green-500 transition-colors"
                            title="导入单词"
                          >
                            <Upload size={14} />
                          </button>
                          {!book.isBuiltIn && (
                            <button
                              onClick={() => handleToggleVocabPublic(book)}
                              className="p-1.5 rounded-lg hover:bg-white/50 text-orange-500 transition-colors"
                              title="设为私有"
                            >
                              <Lock size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteVocabBook(book)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {vocabBooks.length > 0 && (
            <div className="px-4 pb-4">
              {renderPagination(vocabPagination, loadVocabBooks)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // 标签配置
  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: '系统概览', icon: <BarChart3 size={18} /> },
    { id: 'users', label: '用户管理', icon: <Users size={18} /> },
    { id: 'decks', label: '题库管理', icon: <BookOpen size={18} /> },
    { id: 'vocabulary', label: '词库管理', icon: <GraduationCap size={18} /> },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto fade-in">
      {/* 页面标题 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <ShieldCheck size={22} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">管理控制台</h1>
            <p className="text-sm text-gray-600">系统管理与数据统计</p>
          </div>
        </div>
      </div>

      {/* 标签导航 */}
      <div className="mb-8">
        <div className="inline-flex gap-1 p-1.5 rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 shadow-sm">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white shadow-md text-primary-600 ring-1 ring-black/5'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区域 */}
      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'decks' && renderDecks()}
        {activeTab === 'vocabulary' && renderVocabulary()}
      </div>

      {/* 创建内置题库模态框 */}
      <Modal
        isOpen={showCreateDeckModal}
        onClose={() => { setShowCreateDeckModal(false); setNewDeckName(''); setNewDeckDesc(''); }}
        title="创建内置题库"
        size="md"
      >
        <ModalContent>
          <div className="space-y-5">
            {/* 图标装饰 */}
            <div className="flex justify-center mb-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg">
                <BookOpen size={32} className="text-white" />
              </div>
            </div>
            
            {/* 题库名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                题库名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                placeholder="例如：CET-4 词汇题库"
                className="w-full px-4 py-3 rounded-xl border border-gray-200/80 bg-white/60 backdrop-blur-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
            
            {/* 描述 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                描述 <span className="text-gray-400 font-normal">（可选）</span>
              </label>
              <textarea
                value={newDeckDesc}
                onChange={(e) => setNewDeckDesc(e.target.value)}
                placeholder="题库描述"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200/80 bg-white/60 backdrop-blur-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all resize-none"
              />
            </div>

            {/* 提示信息 */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50/80 border border-blue-100">
              <span className="text-blue-500 mt-0.5">💡</span>
              <p className="text-xs text-blue-600">
                内置题库将对所有用户可见，创建后可以导入题目
              </p>
            </div>
          </div>
        </ModalContent>
        
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowCreateDeckModal(false); setNewDeckName(''); setNewDeckDesc(''); }}>
            取消
          </Button>
          <Button onClick={handleCreateBuiltInDeck} disabled={!newDeckName.trim()} leftIcon={<Plus size={16} />}>
            创建
          </Button>
        </ModalFooter>
      </Modal>

      {/* 创建内置词库模态框 */}
      <Modal
        isOpen={showCreateVocabModal}
        onClose={() => { setShowCreateVocabModal(false); setNewVocabName(''); setNewVocabDesc(''); }}
        title="创建内置词库"
        size="md"
      >
        <ModalContent>
          <div className="space-y-5">
            {/* 图标装饰 */}
            <div className="flex justify-center mb-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
                <GraduationCap size={32} className="text-white" />
              </div>
            </div>
            
            {/* 词库名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                词库名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newVocabName}
                onChange={(e) => setNewVocabName(e.target.value)}
                placeholder="例如：CET-4 核心词汇"
                className="w-full px-4 py-3 rounded-xl border border-gray-200/80 bg-white/60 backdrop-blur-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
            
            {/* 描述 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                描述 <span className="text-gray-400 font-normal">（可选）</span>
              </label>
              <textarea
                value={newVocabDesc}
                onChange={(e) => setNewVocabDesc(e.target.value)}
                placeholder="词库描述"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200/80 bg-white/60 backdrop-blur-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all resize-none"
              />
            </div>

            {/* 提示信息 */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-green-50/80 border border-green-100">
              <span className="text-green-500 mt-0.5">💡</span>
              <p className="text-xs text-green-600">
                内置词库将对所有用户可见，创建后可以导入单词
              </p>
            </div>
          </div>
        </ModalContent>
        
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowCreateVocabModal(false); setNewVocabName(''); setNewVocabDesc(''); }}>
            取消
          </Button>
          <Button onClick={handleCreateBuiltInVocab} disabled={!newVocabName.trim()} leftIcon={<Plus size={16} />}>
            创建
          </Button>
        </ModalFooter>
      </Modal>

      {/* 编辑题库模态框 */}
      <Modal
        isOpen={showEditDeckModal && !!editingDeck}
        onClose={() => { setShowEditDeckModal(false); setEditingDeck(null); }}
        title="编辑题库"
        size="md"
      >
        <ModalContent>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                题库名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editDeckName}
                onChange={(e) => setEditDeckName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200/80 bg-white/60 backdrop-blur-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                描述 <span className="text-gray-400 font-normal">（可选）</span>
              </label>
              <textarea
                value={editDeckDesc}
                onChange={(e) => setEditDeckDesc(e.target.value)}
                placeholder="题库描述"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200/80 bg-white/60 backdrop-blur-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all resize-none"
              />
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowEditDeckModal(false); setEditingDeck(null); }}>
            取消
          </Button>
          <Button onClick={handleSaveEditDeck}>
            保存
          </Button>
        </ModalFooter>
      </Modal>

      {/* 编辑词库模态框 */}
      <Modal
        isOpen={showEditVocabModal && !!editingVocab}
        onClose={() => { setShowEditVocabModal(false); setEditingVocab(null); }}
        title="编辑词库"
        size="md"
      >
        <ModalContent>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                词库名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editVocabName}
                onChange={(e) => setEditVocabName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200/80 bg-white/60 backdrop-blur-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                描述 <span className="text-gray-400 font-normal">（可选）</span>
              </label>
              <textarea
                value={editVocabDesc}
                onChange={(e) => setEditVocabDesc(e.target.value)}
                placeholder="词库描述"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200/80 bg-white/60 backdrop-blur-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all resize-none"
              />
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => { setShowEditVocabModal(false); setEditingVocab(null); }}>
            取消
          </Button>
          <Button onClick={handleSaveEditVocab}>
            保存
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
