import React, { useState } from 'react';
import { View, Text, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { BookOpen, AlertTriangle, ChevronRight } from 'lucide-react-native';
import { getRecyclingGuide } from '@/lib/guidance/recyclingGuides';
import { RecyclingAnimation } from './RecyclingAnimation';

interface RecyclingGuideCardProps {
  itemClass: string;
}

export function RecyclingGuideCard({ itemClass }: RecyclingGuideCardProps) {
  const guide = getRecyclingGuide(itemClass);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const cardWidth = 200;
    const index = Math.round(x / cardWidth);
    if (index >= 0 && index < guide.steps.length) {
      setActiveStepIndex(index);
    }
  };

  return (
    <View className="bg-card border border-border rounded-2xl p-4 gap-3 shadow-2xs">
      {/* Header */}
      <View className="flex-row items-center justify-between pb-2 border-b border-border/60">
        <View className="flex-row items-center gap-2">
          <View className="h-7 w-7 rounded-lg bg-primary/10 items-center justify-center">
            <BookOpen size={16} className="text-primary" />
          </View>
          <Text className="text-base font-bold text-foreground">Guide</Text>
        </View>

        <View
          className={`px-2.5 py-1 rounded-full border ${
            guide.isRecyclable
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <Text
            className={`text-xs font-bold ${
              guide.isRecyclable ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {guide.category}
          </Text>
        </View>
      </View>

      {/* Centered Animation (Seamlessly embedded into card, no extra borders) */}
      <View className="w-full items-center justify-center py-0.5">
        <RecyclingAnimation recyclingClass={guide.className} size={140} />
      </View>

      {/* Swipable Separation Steps */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between px-1">
          <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Preparation Steps
          </Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-[11px] text-muted-foreground font-medium">Swipe</Text>
            <ChevronRight size={12} className="text-muted-foreground" />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: 2, gap: 10 }}
        >
          {guide.steps.map((step, idx) => (
            <View
              key={step.stepNumber}
              className={`w-[200px] p-3 rounded-xl border ${
                activeStepIndex === idx
                  ? 'bg-primary/5 border-primary/40 shadow-xs'
                  : 'bg-background border-border/80'
              }`}
            >
              <View className="flex-row items-center justify-between mb-1.5">
                <View
                  className={`h-5 w-5 rounded-full items-center justify-center ${
                    activeStepIndex === idx ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      activeStepIndex === idx ? 'text-primary-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.stepNumber}
                  </Text>
                </View>
                <Text className="text-[10px] font-bold text-muted-foreground">
                  Step {step.stepNumber} of 3
                </Text>
              </View>

              <Text className="text-xs font-bold text-foreground mb-1">{step.title}</Text>
              <Text className="text-xs text-muted-foreground leading-relaxed" numberOfLines={2}>
                {step.detail}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Step Indicator Dots */}
        <View className="flex-row justify-center items-center gap-1.5 mt-0.5">
          {guide.steps.map((_, idx) => (
            <View
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                activeStepIndex === idx ? 'w-4 bg-primary' : 'w-1.5 bg-border'
              }`}
            />
          ))}
        </View>
      </View>

      {/* Important Note */}
      <View className="flex-row items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
        <AlertTriangle size={14} className="text-amber-600 shrink-0" />
        <Text className="text-[11px] text-amber-800 dark:text-amber-300 flex-1 leading-snug">
          {guide.importantNote}
        </Text>
      </View>
    </View>
  );
}
