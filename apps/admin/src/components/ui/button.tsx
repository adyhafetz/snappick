import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]';

    const variants = {
      default:
        'bg-primary text-white hover:bg-primary-dark shadow-sm shadow-primary/20',
      secondary:
        'bg-secondary text-foreground hover:bg-secondary/80 border border-border/60',
      outline:
        'border border-border bg-white text-foreground hover:bg-muted/50 hover:border-slate-300',
      destructive:
        'bg-destructive text-white hover:bg-destructive/90 shadow-sm shadow-destructive/20',
      ghost:
        'text-foreground hover:bg-muted/60',
      link:
        'text-primary underline-offset-4 hover:underline p-0 h-auto',
    };

    const sizes = {
      default: 'h-11 px-4 py-2 rounded-2xl',
      sm: 'h-9 px-3 rounded-xl text-xs',
      lg: 'h-12 px-6 rounded-2xl text-base',
      icon: 'h-10 w-10 rounded-2xl p-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

