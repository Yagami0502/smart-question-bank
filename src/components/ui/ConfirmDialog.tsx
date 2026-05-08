/**
 * 全局确认/提示对话框组件
 * 替代原生 alert 和 confirm
 */
import { create } from 'zustand';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import Button from './Button';
import { cn } from '../../lib/utils';

type DialogType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

interface DialogState {
  isOpen: boolean;
  type: DialogType;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  isDanger: boolean; // 是否为危险操作（删除等）
  onConfirm: (() => void) | null;
  onCancel: (() => void) | null;
}

interface DialogStore extends DialogState {
  show: (options: Partial<DialogState> & { message: string }) => void;
  hide: () => void;
  confirm: (message: string, options?: { title?: string; confirmText?: string; cancelText?: string; isDanger?: boolean }) => Promise<boolean>;
  alert: (message: string, options?: { title?: string; type?: DialogType }) => Promise<void>;
}

export const useDialogStore = create<DialogStore>((set, get) => ({
  isOpen: false,
  type: 'info',
  title: '',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  isDanger: false,
  onConfirm: null,
  onCancel: null,

  show: (options) => {
    set({
      isOpen: true,
      type: options.type || 'info',
      title: options.title || '',
      message: options.message,
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      isDanger: options.isDanger || false,
      onConfirm: options.onConfirm || null,
      onCancel: options.onCancel || null,
    });
  },

  hide: () => {
    set({ isOpen: false, onConfirm: null, onCancel: null, isDanger: false });
  },

  confirm: (message, options) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        type: 'confirm',
        title: options?.title || '确认操作',
        message,
        confirmText: options?.confirmText || '确定',
        cancelText: options?.cancelText || '取消',
        isDanger: options?.isDanger || false,
        onConfirm: () => {
          get().hide();
          resolve(true);
        },
        onCancel: () => {
          get().hide();
          resolve(false);
        },
      });
    });
  },

  alert: (message, options) => {
    return new Promise((resolve) => {
      set({
        isOpen: true,
        type: options?.type || 'info',
        title: options?.title || '',
        message,
        confirmText: '确定',
        cancelText: '',
        isDanger: false,
        onConfirm: () => {
          get().hide();
          resolve();
        },
        onCancel: null,
      });
    });
  },
}));

// 便捷函数
export const dialog = {
  confirm: (message: string, options?: { title?: string; confirmText?: string; cancelText?: string; isDanger?: boolean }) => 
    useDialogStore.getState().confirm(message, options),
  alert: (message: string, options?: { title?: string; type?: DialogType }) => 
    useDialogStore.getState().alert(message, options),
  success: (message: string, title?: string) => 
    useDialogStore.getState().alert(message, { title, type: 'success' }),
  error: (message: string, title?: string) => 
    useDialogStore.getState().alert(message, { title: title || '错误', type: 'error' }),
  warning: (message: string, title?: string) => 
    useDialogStore.getState().alert(message, { title: title || '警告', type: 'warning' }),
  info: (message: string, title?: string) => 
    useDialogStore.getState().alert(message, { title: title || '提示', type: 'info' }),
};

const iconMap = {
  info: <Info className="w-6 h-6 text-blue-500" />,
  success: <CheckCircle className="w-6 h-6 text-green-500" />,
  warning: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
  error: <XCircle className="w-6 h-6 text-red-500" />,
  confirm: <AlertTriangle className="w-6 h-6 text-blue-500" />,
};

const bgColorMap = {
  info: 'bg-blue-50',
  success: 'bg-green-50',
  warning: 'bg-yellow-50',
  error: 'bg-red-50',
  confirm: 'bg-blue-50',
};

export default function ConfirmDialog() {
  const { isOpen, type, title, message, confirmText, cancelText, isDanger, onConfirm, onCancel } = useDialogStore();

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm?.();
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const handleBackdropClick = () => {
    if (type === 'confirm') {
      handleCancel();
    } else {
      handleConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm modal-backdrop-enter"
        onClick={handleBackdropClick}
      />
      
      {/* 对话框 */}
      <div className="relative w-full max-w-sm mx-4 modal-content-enter">
        <div className="rounded-2xl shadow-2xl overflow-hidden bg-white/95 backdrop-blur-md border border-white/50">
          {/* 内容 */}
          <div className="p-6">
            <div className="flex items-start gap-4">
              {/* 图标 */}
              <div className={cn('p-3 rounded-full flex-shrink-0', bgColorMap[type])}>
                {iconMap[type]}
              </div>
              
              {/* 文字 */}
              <div className="flex-1 pt-1">
                {title && (
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
                )}
                <p className="text-gray-600 text-sm leading-relaxed">{message}</p>
              </div>
            </div>
          </div>
          
          {/* 按钮 */}
          <div className="px-6 pb-6 flex gap-3 justify-end">
            {type === 'confirm' && cancelText && (
              <Button variant="ghost" onClick={handleCancel}>
                {cancelText}
              </Button>
            )}
            <Button 
              variant={(type === 'error' || isDanger) ? 'danger' : 'liquid-blue'} 
              onClick={handleConfirm}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
