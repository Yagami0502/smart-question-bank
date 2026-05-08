import * as React from 'react';
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'outline' | 'liquid-blue' | 'liquid-glass' | 'liquid-glass-blue';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, disabled, children, ...props }, ref) => {
    
    // 所有按钮都使用液态玻璃样式
    const sizeClass = size === 'sm' ? 'liquid-btn-sm' : size === 'lg' ? 'liquid-btn-lg' : '';
    
    // 根据变体确定颜色类
    const getColorClass = () => {
      switch (variant) {
        case 'primary':
        case 'liquid-blue':
        case 'liquid-glass-blue':
          return 'liquid-btn-blue';
        case 'danger':
          return 'liquid-btn-danger';
        case 'success':
          return 'liquid-btn-success';
        case 'ghost':
          return 'liquid-btn-ghost';
        case 'secondary':
        case 'outline':
        case 'liquid-glass':
        default:
          return '';
      }
    };
    
    return (
      <div className={cn('liquid-btn-wrap', disabled && 'opacity-50 pointer-events-none')}>
        <button
          ref={ref}
          className={cn('liquid-btn', sizeClass, getColorClass(), className)}
          disabled={disabled || isLoading}
          {...props}
        >
          <span className="liquid-btn-text">
            {isLoading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : leftIcon}
            {children}
            {rightIcon}
          </span>
        </button>
        <div className="liquid-btn-shadow" />
      </div>
    );
  }
);

Button.displayName = 'Button';

export default Button;
