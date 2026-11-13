import * as React from 'react';
import { useState } from 'react';
import { View } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  buildPickupWindow,
  DATE_CHOICES,
  dayLabel,
  TIME_CHOICES,
  windowStillAhead,
  type DayChoice,
  type TimeChoice,
} from '@/lib/pickup/window';

/**
 * "Request Again" for a pickup that was not collected or expired. When the old pickup time has not started yet it
 * is reused; otherwise the requester picks a new day and time first.
 */
export function RequestAgain(props: {
  status: 'not_collected' | 'expired';
  windowStart: string | null;
  busy: boolean;
  onRequest: (window: { start: string; end: string } | null) => void;
}) {
  const reuse = windowStillAhead(props.windowStart);
  const [day, setDay] = useState<DayChoice>(1);
  const [time, setTime] = useState<TimeChoice>('morning');

  const message =
    props.status === 'expired'
      ? 'No collector claimed this pickup in time.'
      : 'This pickup was not collected.';

  return (
    <View className="gap-2.5 mt-2 mb-4 p-4 rounded-3xl border border-border/80 bg-card">
      <Text className="text-sm font-bold text-foreground">{message}</Text>
      {reuse ? (
        <Text className="text-xs text-muted-foreground">Ask another collector for the same pickup time.</Text>
      ) : (
        <>
          <Text className="text-xs text-muted-foreground">Choose a new pickup time.</Text>
          <View className="flex-row gap-2">
            {DATE_CHOICES.map((choice) => (
              <Chip key={choice} label={dayLabel(choice)} selected={day === choice} onPress={() => setDay(choice)} />
            ))}
          </View>
          <View className="flex-row gap-2">
            {TIME_CHOICES.map((choice) => (
              <Chip
                key={choice.id}
                label={choice.id === 'morning' ? 'Morning, 9am – 12pm' : 'Afternoon, 1pm – 4pm'}
                selected={time === choice.id}
                onPress={() => setTime(choice.id)}
              />
            ))}
          </View>
        </>
      )}
      <Button
        disabled={props.busy}
        onPress={() => {
          if (reuse) return props.onRequest(null);
          const w = buildPickupWindow(day, time);
          props.onRequest({ start: w.start, end: w.end });
        }}
        className="w-full h-12 rounded-2xl bg-primary flex-row items-center justify-center gap-2 shadow-xs"
      >
        <Text className="text-base font-bold text-white">Request Again</Text>
      </Button>
    </View>
  );
}

function Chip(props: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      className={`min-h-10 flex-1 items-center justify-center rounded-xl border px-2 ${
        props.selected ? 'border-primary bg-primary/10' : 'border-border/70 bg-card'
      }`}
    >
      <Text className={`text-xs font-bold text-center ${props.selected ? 'text-primary' : 'text-foreground'}`}>
        {props.label}
      </Text>
    </AnimatedPressable>
  );
}
