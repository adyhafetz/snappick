import { useMemo } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { CHECKLIST_REASONS, CONDITIONS, type ChecklistCondition, type ChecklistReason, type ChecklistRow } from '@/lib/pickup/checklist';

const reasonLabels: Record<ChecklistReason, string> = { contaminated: 'Contaminated', missing: 'Missing', unsafe: 'Unsafe', access_issue: 'Access issue', other: 'Other' };
const conditionLabels: Record<ChecklistCondition, string> = { clean_dry: 'Clean and dry', contaminated_wet: 'Wet / contaminated', broken_unsafe: 'Broken / unsafe', unknown: 'Unknown' };

export function CollectionChecklist({ rows, onChange }: { rows: ChecklistRow[]; onChange: (rows: ChecklistRow[]) => void }) {
  const total = useMemo(() => rows.reduce((sum, row) => sum + row.collectedQuantity, 0), [rows]);
  return <View className="gap-3">
    <Text className="text-sm font-semibold text-foreground">Collection checklist · {total} collected</Text>
    {rows.map((row, index) => <View key={row.id} className="rounded-lg border border-border p-3">
      <View className="flex-row items-center justify-between"><Text className="text-sm font-semibold text-foreground">{row.requesterQuantity} requested</Text><Text className="text-xs text-muted-foreground">{conditionLabels[row.condition]}</Text></View>
      <View className="mt-2 flex-row items-center gap-2"><Text className="text-xs text-muted-foreground">Collected</Text><TextInput accessibilityLabel={`Collected quantity ${index + 1}`} keyboardType="number-pad" value={String(row.collectedQuantity)} onChangeText={(value) => { const quantity = Number.parseInt(value || '0', 10); const next = [...rows]; next[index] = { ...row, collectedQuantity: Number.isFinite(quantity) ? quantity : 0 }; onChange(next); }} className="h-10 w-16 rounded-md border border-border px-2 text-center text-foreground" /><Text className="text-xs text-muted-foreground">of {row.requesterQuantity}</Text></View>
      <View className="mt-2 flex-row flex-wrap gap-2">{CONDITIONS.map((condition) => <Pressable key={condition} accessibilityRole="radio" accessibilityState={{ selected: row.condition === condition }} onPress={() => { const next = [...rows]; next[index] = { ...row, condition }; onChange(next); }} className={`rounded-md border px-2 py-2 ${row.condition === condition ? 'border-primary bg-primary/10' : 'border-border'}`}><Text className="text-xs text-foreground">{conditionLabels[condition]}</Text></Pressable>)}</View>
      {row.collectedQuantity < row.requesterQuantity && <View className="mt-2 flex-row flex-wrap gap-2">{CHECKLIST_REASONS.map((reason) => <Pressable key={reason} accessibilityRole="radio" accessibilityState={{ selected: row.reason === reason }} onPress={() => { const next = [...rows]; next[index] = { ...row, reason }; onChange(next); }} className={`rounded-md border px-2 py-2 ${row.reason === reason ? 'border-amber-600 bg-amber-50' : 'border-border'}`}><Text className="text-xs text-foreground">{reasonLabels[reason]}</Text></Pressable>)}</View>}
    </View>)}
  </View>;
}
