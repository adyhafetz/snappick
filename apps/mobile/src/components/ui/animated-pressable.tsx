import * as React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

export interface AnimatedPressableProps extends PressableProps {
  children: React.ReactNode;
  scaleTo?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * High-performance, tactile pressable component providing instant micro-interaction
 * feedback without dropping frames or requiring heavy native gesture wrappers.
 */
export function AnimatedPressable({
  children,
  scaleTo = 0.97,
  className = '',
  style,
  disabled,
  ...rest
}: AnimatedPressableProps) {
  return (
    <Pressable
      disabled={disabled}
      className={className}
      style={({ pressed }) => [
        style,
        pressed && !disabled ? { transform: [{ scale: scaleTo }], opacity: 0.92 } : null,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

