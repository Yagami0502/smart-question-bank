/**
 * 动画模态框包装组件
 * 提供丝滑的弹入弹出动画效果
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  backdropClassName?: string;
}

export default function AnimatedModal({
  isOpen,
  onClose,
  children,
  className,
  backdropClassName,
}: AnimatedModalProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // 清理之前的定时器
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }

    if (isOpen) {
      // 打开模态框
      setShouldRender(true);
      // 使用双重 RAF 确保 DOM 已渲染
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else if (shouldRender) {
      // 关闭模态框 - 先播放退出动画
      setIsAnimating(false);
      // 等待退出动画完成后再移除 DOM
      animationTimeoutRef.current = window.setTimeout(() => {
        setShouldRender(false);
      }, 300);
    }

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [isOpen, shouldRender]);

  // 禁止背景滚动
  useEffect(() => {
    if (shouldRender) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [shouldRender]);

  // ESC 键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!shouldRender) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4",
        "transition-opacity duration-300",
        isAnimating ? "opacity-100" : "opacity-0",
        backdropClassName
      )}
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          "transition-all duration-300 ease-out",
          isAnimating 
            ? "opacity-100 scale-100 translate-y-0" 
            : "opacity-0 scale-95 translate-y-4",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
