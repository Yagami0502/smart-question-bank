/**
 * 学习提醒通知系统
 * 支持设置学习提醒时间和自定义通知
 */
import { useState, useEffect } from 'react';
import { X, Bell, BellOff, Clock, Plus, Trash2, Volume2, VolumeX } from 'lucide-react';
import Button from './ui/Button';
import AnimatedModal from './ui/AnimatedModal';
import { cn } from '../lib/utils';

interface Reminder {
  id: string;
  time: string;
  days: number[];
  message: string;
  enabled: boolean;
  sound: boolean;
}

interface StudyReminderProps {
  isOpen: boolean;
  onClose: () => void;
}

const defaultReminders: Reminder[] = [
  {
    id: 'morning',
    time: '08:00',
    days: [1, 2, 3, 4, 5],
    message: '早上好！开始今天的学习吧 📚',
    enabled: true,
    sound: true,
  },
  {
    id: 'evening',
    time: '20:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    message: '晚间复习时间到！巩固今天学到的知识 🌙',
    enabled: true,
    sound: true,
  },
];

const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

// 提醒存储
const reminderStorage = {
  getReminders: (): Reminder[] => {
    const data = localStorage.getItem('study-reminders');
    return data ? JSON.parse(data) : defaultReminders;
  },
  saveReminders: (reminders: Reminder[]) => {
    localStorage.setItem('study-reminders', JSON.stringify(reminders));
  },
  getNotificationPermission: (): boolean => {
    return localStorage.getItem('notification-permission') === 'granted';
  },
  setNotificationPermission: (granted: boolean) => {
    localStorage.setItem('notification-permission', granted ? 'granted' : 'denied');
  },
};

export default function StudyReminder({ isOpen, onClose }: StudyReminderProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const [newReminder, setNewReminder] = useState<Omit<Reminder, 'id'>>({
    time: '09:00',
    days: [1, 2, 3, 4, 5],
    message: '学习时间到！',
    enabled: true,
    sound: true,
  });

  useEffect(() => {
    if (isOpen) {
      loadReminders();
      checkNotificationPermission();
    }
  }, [isOpen]);

  useEffect(() => {
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [reminders]);

  const loadReminders = () => {
    setReminders(reminderStorage.getReminders());
  };

  const checkNotificationPermission = async () => {
    if ('Notification' in window) {
      setNotificationEnabled(Notification.permission === 'granted');
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationEnabled(permission === 'granted');
      reminderStorage.setNotificationPermission(permission === 'granted');
    }
  };

  const checkReminders = () => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const currentDay = now.getDay();

    reminders.forEach(reminder => {
      if (
        reminder.enabled &&
        reminder.time === currentTime &&
        reminder.days.includes(currentDay)
      ) {
        showNotification(reminder);
      }
    });
  };

  const showNotification = (reminder: Reminder) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('智能题库 - 学习提醒', {
        body: reminder.message,
        icon: '/favicon.ico',
        tag: reminder.id,
      });

      if (reminder.sound) {
        playNotificationSound();
      }
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQMKZ6fG36NxBRRqkL7RqnkKFGGIucypfQ4WXYOzxqF+ERhdgK/Bn4ATGF1+rL6dgBYXXn2qu5uBGBdgfam5mYIZF2B/qLiYgxoXYH+ot5eDGxdhgKi3l4QbF2GAqLeXhBsXYYCot5eEGxdhgKi3l4QbF2GAqLeXhBsXYYCot5eEGxdhgKi3l4QbF2GAqLeXhBsXYQ==');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  const handleAddReminder = () => {
    const reminder: Reminder = {
      ...newReminder,
      id: `reminder_${Date.now()}`,
    };

    const updated = [...reminders, reminder];
    setReminders(updated);
    reminderStorage.saveReminders(updated);
    setShowAddForm(false);
    setNewReminder({
      time: '09:00',
      days: [1, 2, 3, 4, 5],
      message: '学习时间到！',
      enabled: true,
      sound: true,
    });
  };

  const handleUpdateReminder = (id: string, updates: Partial<Reminder>) => {
    const updated = reminders.map(r => (r.id === id ? { ...r, ...updates } : r));
    setReminders(updated);
    reminderStorage.saveReminders(updated);
  };

  const handleDeleteReminder = (id: string) => {
    const updated = reminders.filter(r => r.id !== id);
    setReminders(updated);
    reminderStorage.saveReminders(updated);
  };

  const toggleDay = (day: number, isNew = false) => {
    if (isNew) {
      setNewReminder(prev => ({
        ...prev,
        days: prev.days.includes(day)
          ? prev.days.filter(d => d !== day)
          : [...prev.days, day].sort(),
      }));
    } else if (editingReminder) {
      const newDays = editingReminder.days.includes(day)
        ? editingReminder.days.filter(d => d !== day)
        : [...editingReminder.days, day].sort();
      setEditingReminder({ ...editingReminder, days: newDays });
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose}>
      <div className="rounded-2xl shadow-2xl w-[900px] h-[700px] overflow-hidden flex flex-col bg-white">
        {/* Header */}
        <div className="p-4 border-b flex-shrink-0 border-gray-200 bg-gradient-to-r from-violet-500 to-purple-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">学习提醒</h2>
                <p className="text-xs text-white/80">设置定时提醒</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg">
              <X size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Notification Permission */}
        {!notificationEnabled && (
          <div className="p-4 border-b border-gray-100 bg-amber-50">
            <div className="flex items-center gap-3">
              <BellOff size={20} className="text-amber-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">通知已禁用</p>
                <p className="text-xs text-gray-500">开启通知以接收学习提醒</p>
              </div>
              <Button size="sm" onClick={requestNotificationPermission}>
                开启
              </Button>
            </div>
          </div>
        )}

        {/* Reminders List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {reminders.map(reminder => (
            <div
              key={reminder.id}
              className={cn(
                "p-4 rounded-xl border",
                reminder.enabled ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-gray-50"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "text-2xl font-bold min-w-[70px]",
                    reminder.enabled ? "text-amber-500" : "text-gray-400"
                  )}
                >
                  {reminder.time}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm mb-2 text-gray-900">{reminder.message}</p>
                  <div className="flex gap-1 mb-2">
                    {dayNames.map((name, index) => (
                      <span
                        key={index}
                        className={cn(
                          "w-6 h-6 rounded-full text-xs flex items-center justify-center",
                          reminder.days.includes(index)
                            ? "bg-amber-500 text-white"
                            : "bg-gray-200 text-gray-500"
                        )}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateReminder(reminder.id, { sound: !reminder.sound })}
                      className={cn(
                        "p-1.5 rounded-lg",
                        reminder.sound ? "text-amber-500" : "text-gray-400"
                      )}
                      title={reminder.sound ? "关闭声音" : "开启声音"}
                    >
                      {reminder.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleUpdateReminder(reminder.id, { enabled: !reminder.enabled })}
                    className={cn(
                      "p-2 rounded-lg",
                      reminder.enabled ? "bg-amber-500 text-white" : "bg-gray-200 text-gray-500"
                    )}
                  >
                    {reminder.enabled ? <Bell size={16} /> : <BellOff size={16} />}
                  </button>
                  <button
                    onClick={() => handleDeleteReminder(reminder.id)}
                    className="p-2 rounded-lg text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {reminders.length === 0 && (
            <div className="text-center py-8">
              <Bell size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">暂无提醒</p>
              <p className="text-sm text-gray-400">添加提醒帮助你保持学习习惯</p>
            </div>
          )}
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <h3 className="text-sm font-medium mb-3 text-gray-900">添加新提醒</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-500" />
                <input
                  type="time"
                  value={newReminder.time}
                  onChange={(e) => setNewReminder({ ...newReminder, time: e.target.value })}
                  className="px-3 py-2 rounded-lg text-sm flex-1 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs mb-2 block text-gray-500">重复</label>
                <div className="flex gap-1">
                  {dayNames.map((name, index) => (
                    <button
                      key={index}
                      onClick={() => toggleDay(index, true)}
                      className={cn(
                        "w-8 h-8 rounded-full text-xs font-medium",
                        newReminder.days.includes(index)
                          ? "bg-amber-500 text-white"
                          : "bg-gray-200 text-gray-500"
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={newReminder.message}
                onChange={(e) => setNewReminder({ ...newReminder, message: e.target.value })}
                placeholder="提醒内容..."
                className="w-full px-3 py-2 rounded-lg text-sm bg-white text-gray-900 placeholder-gray-400"
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newReminder.sound}
                  onChange={(e) => setNewReminder({ ...newReminder, sound: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-gray-600">播放提示音</span>
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setShowAddForm(false)}>
                  取消
                </Button>
                <Button className="flex-1" onClick={handleAddReminder}>
                  添加
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {!showAddForm && (
          <div className="p-4 border-t border-gray-100">
            <Button className="w-full" leftIcon={<Plus size={18} />} onClick={() => setShowAddForm(true)}>
              添加提醒
            </Button>
          </div>
        )}
      </div>
    </AnimatedModal>
  );
}

export { reminderStorage };
