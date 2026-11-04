import * as React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { getStatusConfig, type PickupRole } from '@/lib/pickup/status';
import { cn } from '@/lib/utils';

export interface PickupStatusPillProps {
  status: string;
  role?: PickupRole;
  size?: 'sm' | 'md';
  className?: string;
}

export function PickupStatusPill({
  status,
  role = 'requester',
  size = 'sm',
  className,
}: PickupStatusPillProps) {
  const config = getStatusConfig(status, role);
  const isMd = size === 'md';

  return (
    <View
      className={cn(
        'items-center justify-center rounded-full border',
        isMd ? 'px-3 py-1' : 'px-2.5 py-0.5',
        config.containerClass,
        className
      )}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${config.label}`}
    >
      <Text
        className={cn(
          'font-bold tracking-tight',
          isMd ? 'text-xs' : 'text-[11px]',
          config.textClass
        )}
      >
        {config.label}
      </Text>
    </View>
  );
}

