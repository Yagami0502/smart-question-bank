/**
 * 题目笔记组件
 * 允许用户为题目添加个人笔记
 */
import { useState, useEffect } from 'react';
import { StickyNote, Save, X, Trash2, Edit3, Clock, Tag } from 'lucide-react';
import Button from './ui/Button';
import { cn } from '../lib/utils';
import { dialog } from './ui/ConfirmDialog';

interface Note {
  id: string;
  questionId: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

interface QuestionNotesProps {
  questionId: string;
  isOpen: boolean;
  onClose: () => void;
}

const notesStorage = {
  getAll: (): Note[] => {
    const data = localStorage.getItem('question-notes');
    return data ? JSON.parse(data) : [];
  },
  getByQuestionId: (questionId: string): Note | null => {
    const notes = notesStorage.getAll();
    return notes.find(n => n.questionId === questionId) || null;
  },
  save: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Note => {
    const notes = notesStorage.getAll();
    const existingIndex = notes.findIndex(n => n.questionId === note.questionId);

    const newNote: Note = {
      ...note,
      id: existingIndex >= 0 ? notes[existingIndex].id : `note_${Date.now()}`,
      createdAt: existingIndex >= 0 ? notes[existingIndex].createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      notes[existingIndex] = newNote;
    } else {
      notes.push(newNote);
    }

    localStorage.setItem('question-notes', JSON.stringify(notes));
    return newNote;
  },
  delete: (questionId: string): void => {
    const notes = notesStorage.getAll().filter(n => n.questionId !== questionId);
    localStorage.setItem('question-notes', JSON.stringify(notes));
  },
};

export default function QuestionNotes({ questionId, isOpen, onClose }: QuestionNotesProps) {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [existingNote, setExistingNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen && questionId) {
      const note = notesStorage.getByQuestionId(questionId);
      if (note) {
        setExistingNote(note);
        setContent(note.content);
        setTags(note.tags);
        setIsEditing(false);
      } else {
        setExistingNote(null);
        setContent('');
        setTags([]);
        setIsEditing(true);
      }
      setIsSaved(false);
    }
  }, [isOpen, questionId]);

  const handleSave = () => {
    if (!content.trim()) return;

    const savedNote = notesStorage.save({
      questionId,
      content: content.trim(),
      tags,
    });

    setExistingNote(savedNote);
    setIsEditing(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleDelete = async () => {
    const confirmed = await dialog.confirm('确定要删除这条笔记吗？', { title: '删除笔记', isDanger: true });
    if (confirmed) {
      notesStorage.delete(questionId);
      setExistingNote(null);
      setContent('');
      setTags([]);
      setIsEditing(true);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddTag();
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
              <StickyNote className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">题目笔记</h2>
              {existingNote && (
                <p className="text-xs text-gray-500">
                  <Clock size={10} className="inline mr-1" />
                  更新于 {formatDate(existingNote.updatedAt)}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg">
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {isEditing ? (
            <div>
              <label className="text-sm font-medium mb-2 block text-gray-700">笔记内容</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="记录你对这道题的理解、易错点、解题技巧..."
                className="w-full h-40 p-3 rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white border-gray-300 text-gray-900 placeholder-gray-400"
              />
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50">
              <p className="whitespace-pre-wrap text-sm text-gray-800">{content}</p>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="text-sm font-medium mb-2 block text-gray-700">
              <Tag size={14} className="inline mr-1" />
              标签
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(tag => (
                <span key={tag} className="px-2 py-1 rounded-full text-xs flex items-center gap-1 bg-gray-100 text-gray-700">
                  {tag}
                  {isEditing && (
                    <button onClick={() => handleRemoveTag(tag)}>
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
              {tags.length === 0 && !isEditing && <span className="text-xs text-gray-400">暂无标签</span>}
            </div>

            {isEditing && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入标签后按回车添加"
                  className="flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                />
                <Button size="sm" onClick={handleAddTag}>
                  添加
                </Button>
              </div>
            )}
          </div>

          {/* Suggested Tags */}
          {isEditing && (
            <div>
              <p className="text-xs mb-2 text-gray-500">推荐标签</p>
              <div className="flex flex-wrap gap-2">
                {['易错', '重点', '公式', '概念', '技巧', '记忆'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => {
                      if (!tags.includes(tag)) {
                        setTags([...tags, tag]);
                      }
                    }}
                    disabled={tags.includes(tag)}
                    className={cn(
                      "px-2 py-1 rounded-full text-xs",
                      tags.includes(tag)
                        ? "bg-primary-100 text-primary-600 cursor-not-allowed"
                        : "bg-gray-100 text-gray-600"
                    )}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between border-gray-200 bg-gray-50">
          <div>
            {existingNote && !isEditing && (
              <button onClick={handleDelete} className="flex items-center gap-1 text-sm text-red-500">
                <Trash2 size={14} />
                删除笔记
              </button>
            )}
            {isSaved && <span className="text-green-500 text-sm">✓ 已保存</span>}
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                {existingNote && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setContent(existingNote.content);
                      setTags(existingNote.tags);
                      setIsEditing(false);
                    }}
                  >
                    取消
                  </Button>
                )}
                <Button onClick={handleSave} leftIcon={<Save size={16} />}>
                  保存笔记
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} leftIcon={<Edit3 size={16} />}>
                编辑笔记
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { notesStorage };
export type { Note };
