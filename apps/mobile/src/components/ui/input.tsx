import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<React.ElementRef<typeof TextInput>, TextInputProps>(
  ({ className, placeholderClassName, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        className={cn(
          'h-12 rounded-xl border border-input bg-card px-4 text-base text-foreground',
          props.editable === false && 'opacity-50 bg-muted',
          className
        )}
        placeholderTextColor="#5b7072"
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };

