import { useMemo } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Text } from '@/components/ui/text';
import {
  CHECKLIST_REASONS,
  CONDITIONS,
  type ChecklistCondition,
  type ChecklistReason,
  type ChecklistRow,
} from '@/lib/pickup/checklist';

const reasonLabels: Record<ChecklistReason, string> = {
  contaminated: 'Contaminated',
  missing: 'Missing',
  unsafe: 'Unsafe',
  access_issue: 'Access issue',
  other: 'Other',
};

const conditionLabels: Record<ChecklistCondition, string> = {
  clean_dry: 'Clean',
  contaminated_wet: 'Wet',
  broken_unsafe: 'Broken',
  unknown: 'Unsure',
};

export function CollectionChecklist({
  rows,
  onChange,
}: {
  rows: ChecklistRow[];
  onChange: (rows: ChecklistRow[]) => void;
}) {
  const total = useMemo(() => rows.reduce((sum, row) => sum + row.collectedQuantity, 0), [rows]);

  const updateQuantity = (index: number, nextQty: number) => {
    const clamped = Math.max(0, nextQty);
    const next = [...rows];
    next[index] = { ...rows[index], collectedQuantity: clamped };
    onChange(next);
  };

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-foreground">Items Checklist</Text>
        <Text className="text-xs font-bold text-primary">{total} collected</Text>
      </View>

      {rows.map((row, index) => (
        <View key={row.id} className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold text-foreground">
              Item #{index + 1} · {row.requesterQuantity} requested
            </Text>
            <Text className="text-xs text-muted-foreground font-medium">
              {conditionLabels[row.condition]}
            </Text>
          </View>

          {/* Tactile Stepper */}
          <View className="mt-3 flex-row items-center justify-between py-2 border-y border-border/40">
            <Text className="text-xs font-bold text-muted-foreground">Quantity Collected</Text>
            <View className="flex-row items-center gap-2">
              <AnimatedPressable
                onPress={() => updateQuantity(index, row.collectedQuantity - 1)}
                className="h-9 w-9 rounded-xl bg-secondary/80 border border-border items-center justify-center shadow-xs"
              >
                <Minus size={15} color="#183e48" />
              </AnimatedPressable>

              <View className="h-9 w-14 rounded-xl bg-secondary/30 border border-border/80 items-center justify-center">
                <TextInput
                  accessibilityLabel={`Collected quantity ${index + 1}`}
                  keyboardType="number-pad"
                  value={String(row.collectedQuantity)}
                  onChangeText={(value) => {
                    const quantity = Number.parseInt(value || '0', 10);
                    updateQuantity(index, Number.isFinite(quantity) ? quantity : 0);
                  }}
                  style={{
                    paddingVertical: 0,
                    textAlignVertical: 'center',
                    includeFontPadding: false,
                  }}
                  className="w-full text-center text-sm font-bold text-foreground"
                />
              </View>

              <AnimatedPressable
                onPress={() => updateQuantity(index, row.collectedQuantity + 1)}
                className="h-9 w-9 rounded-xl bg-primary items-center justify-center shadow-xs"
              >
                <Plus size={15} color="#ffffff" />
              </AnimatedPressable>
            </View>
          </View>

          {/* Condition Pills */}
          <View className="mt-3 flex-row gap-1.5">
            {CONDITIONS.map((condition) => {
              const active = row.condition === condition;
              return (
                <AnimatedPressable
                  key={condition}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    const next = [...rows];
                    next[index] = { ...row, condition };
                    onChange(next);
                  }}
                  className={`flex-1 py-1.5 rounded-xl border items-center justify-center ${
                    active ? 'border-primary bg-primary' : 'border-border/70 bg-secondary/30'
                  }`}
                >
                  <Text
                    className={`text-[11px] font-bold ${
                      active ? 'text-white' : 'text-foreground'
                    }`}
                  >
                    {conditionLabels[condition]}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>

          {/* Reason Pills if partial/zero */}
          {row.collectedQuantity < row.requesterQuantity && (
            <View className="mt-3">
              <Text className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1.5">
                Reason for variance
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {CHECKLIST_REASONS.map((reason) => {
                  const active = row.reason === reason;
                  return (
                    <AnimatedPressable
                      key={reason}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        const next = [...rows];
                        next[index] = { ...row, reason };
                        onChange(next);
                      }}
                      className={`rounded-xl border px-2.5 py-1.5 ${
                        active ? 'border-amber-600 bg-amber-500/20' : 'border-border/70 bg-card'
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-semibold ${
                          active ? 'text-amber-900 font-bold' : 'text-muted-foreground'
                        }`}
                      >
                        {reasonLabels[reason]}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
