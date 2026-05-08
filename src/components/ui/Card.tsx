import * as React from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ 
  children, 
  className, 
  hover = false, 
  onClick, 
}: CardProps) {
  return (
    <div
      className={cn(
        'frosted-glass-card rounded-2xl',
        hover && 'cursor-pointer hover:scale-[1.02] transition-transform duration-200',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('px-6 py-4 border-b border-white/20', className)}>
      {children}
    </div>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={cn('px-6 py-4', className)}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn(
      'px-6 py-4 border-t rounded-b-2xl border-white/20 bg-white/10',
      className
    )}>
      {children}
    </div>
  );
}
