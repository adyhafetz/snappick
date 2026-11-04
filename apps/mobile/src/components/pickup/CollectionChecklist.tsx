import { useMemo } from 'react';
import { View } from 'react-native';
import { Layers } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { type ChecklistRow } from '@/lib/pickup/checklist';

const RECEIPT_CLASSES = [
  { id: 'metal', label: 'Metal' },
  { id: 'trash', label: 'Trash' },
  { id: 'glass', label: 'Glass' },
  { id: 'paper', label: 'Paper' },
  { id: 'cardboard', label: 'Cardboard' },
  { id: 'plastic', label: 'Plastic' },
  { id: 'biological', label: 'Biological' },
] as const;

export function CollectionChecklist({
  rows,
}: {
  rows: ChecklistRow[];
}) {
  const quantityByClass = useMemo(() => {
    const map: Record<string, number> = {
      metal: 0,
      trash: 0,
      glass: 0,
      paper: 0,
      cardboard: 0,
      plastic: 0,
      biological: 0,
    };
    for (const r of rows) {
      const key = (r.appClass ?? '').toLowerCase().trim();
      if (key in map) {
        map[key] = (map[key] ?? 0) + (r.requesterQuantity ?? 0);
      }
    }
    return map;
  }, [rows]);

  const totalItems = useMemo(
    () => Object.values(quantityByClass).reduce((sum, val) => sum + val, 0),
    [quantityByClass]
  );

  return (
    <View className="p-4 rounded-3xl border border-border/80 bg-card shadow-xs mb-4">
      {/* Receipt Subheader */}
      <View className="flex-row items-center justify-between pb-2 border-b border-border/50 mb-1">
        <View className="flex-row items-center gap-1.5">
          <Layers size={14} color="#19806d" strokeWidth={2.2} />
          <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Item
          </Text>
        </View>
        <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Quantity
        </Text>
      </View>

      {/* 7 Uniform Hardcoded Class Rows */}
      {RECEIPT_CLASSES.map((item, idx) => {
        const qty = quantityByClass[item.id] ?? 0;
        const hasItem = qty > 0;
        return (
          <View
            key={item.id}
            className={`flex-row items-center justify-between py-2 ${
              idx < RECEIPT_CLASSES.length - 1 ? 'border-b border-border/30' : ''
            }`}
          >
            <Text
              className={`text-sm ${
                hasItem ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'
              }`}
            >
              {item.label}
            </Text>
            <View
              className={`min-w-[28px] h-6 px-2 rounded-lg items-center justify-center ${
                hasItem
                  ? 'bg-primary/15 border border-primary/25'
                  : 'bg-muted/50 border border-transparent'
              }`}
            >
              <Text
                className={`text-xs ${
                  hasItem ? 'font-black text-primary' : 'font-medium text-muted-foreground'
                }`}
              >
                {qty}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Receipt Total Footer */}
      <View className="flex-row items-center justify-between pt-3 mt-1 border-t-2 border-dashed border-border/60">
        <Text className="text-sm font-black text-foreground">Total Items</Text>
        <Text className="text-base font-black text-primary">{totalItems}</Text>
      </View>
    </View>
  );
}
