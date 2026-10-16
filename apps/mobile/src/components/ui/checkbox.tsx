import * as CheckboxPrimitive from '@rn-primitives/checkbox';
import * as React from 'react';
import { Check } from 'lucide-react-native';
import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'h-6 w-6 shrink-0 rounded-md border-2 border-primary items-center justify-center transition-colors',
        props.checked ? 'bg-primary' : 'bg-card border-muted-foreground/40',
        props.disabled && 'opacity-50',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="items-center justify-center">
        <Check size={14} strokeWidth={3} color="#ffffff" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };

