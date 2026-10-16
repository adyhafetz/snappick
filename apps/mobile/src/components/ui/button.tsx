import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Pressable } from 'react-native';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'group flex flex-row items-center justify-center rounded-lg active:opacity-80 transition-opacity',
  {
    variants: {
      variant: {
        default: 'bg-primary active:opacity-90',
        destructive: 'bg-destructive active:opacity-90',
        outline: 'border border-input bg-card active:bg-accent',
        secondary: 'bg-secondary active:opacity-85',
        ghost: 'active:bg-accent',
        link: '',
      },
      size: {
        default: 'h-12 px-5 py-2.5 rounded-xl',
        sm: 'h-9 rounded-lg px-3',
        lg: 'h-14 rounded-xl px-8',
        icon: 'h-10 w-10 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva('text-base font-medium text-foreground', {
  variants: {
    variant: {
      default: 'text-primary-foreground font-semibold',
      destructive: 'text-destructive-foreground font-semibold',
      outline: 'text-foreground font-medium',
      secondary: 'text-secondary-foreground font-medium',
      ghost: 'text-foreground font-medium',
      link: 'text-primary underline',
    },
    size: {
      default: 'text-base font-semibold',
      sm: 'text-sm font-medium',
      lg: 'text-lg font-semibold',
      icon: '',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

type ButtonProps = React.ComponentPropsWithoutRef<typeof Pressable> &
  VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <TextClassContext.Provider
        value={cn(
          props.disabled && 'opacity-60',
          buttonTextVariants({ variant, size })
        )}
      >
        <Pressable
          className={cn(
            props.disabled && 'opacity-60',
            buttonVariants({ variant, size, className })
          )}
          ref={ref}
          role='button'
          {...props}
        />
      </TextClassContext.Provider>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };

