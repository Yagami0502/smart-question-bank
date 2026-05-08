import * as React from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  /** 是否启用液态玻璃效果 */
  glassEffect?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  glassEffect = true
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw] max-h-[90vh]'
  };

  const modalContent = (
    <>
      {/* Header */}
      {(title || showCloseButton) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20">
          {title && (
            <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          )}
          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-white/30 transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
      )}
      {/* Content */}
      <div className="overflow-y-auto max-h-[70vh]">
        {children}
      </div>
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Modal */}
      {glassEffect ? (
        <div
          className={cn(
            'liquid-glass-wrapper liquid-glass-modal relative w-full mx-4 fade-in',
            sizes[size]
          )}
          style={{ '--border-radius': '20px' } as React.CSSProperties}
        >
          <div className="liquid-glass-outer" />
          <div className="liquid-glass-cover" />
          <div className="liquid-glass-sharp" />
          <div className="liquid-glass-reflect" />
          <div className="liquid-glass-content">
            {modalContent}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'relative rounded-2xl shadow-2xl w-full mx-4 fade-in overflow-hidden bg-white/90 backdrop-blur-md',
            sizes[size]
          )}
        >
          {modalContent}
        </div>
      )}
    </div>,
    document.body
  );
}

interface ModalContentProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function ModalContent({ children, className, title }: ModalContentProps) {
  return (
    <div className={cn('px-6 py-4', className)}>
      {title && (
        <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
      )}
      {children}
    </div>
  );
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div className={cn(
      'px-6 py-4 border-t flex justify-end gap-3 border-white/20 bg-white/10',
      className
    )}>
      {children}
    </div>
  );
}
