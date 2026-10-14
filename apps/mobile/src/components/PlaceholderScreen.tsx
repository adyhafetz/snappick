import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { colors, spacing } from '@/theme';

export function PlaceholderScreen({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return <SafeAreaView edges={['top']} style={styles.container}>
    <View style={styles.header}><Text style={styles.brand}>SnapPick</Text><View style={styles.rule} /></View>
    <View style={styles.body}>
      <View style={styles.symbol}><AppIcon name="inventory_2" color={colors.primary} size={26} /></View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction && <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>{actionLabel}</Text><AppIcon name="arrow_forward" color={colors.surface} size={19} />
      </Pressable>}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.canvas, flex: 1, paddingHorizontal: spacing.lg },
  header: { paddingTop: spacing.lg },
  brand: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  rule: { backgroundColor: colors.primary, borderRadius: 2, height: 3, marginTop: spacing.sm, width: 34 },
  body: { flex: 1, justifyContent: 'center', paddingBottom: spacing.xxl },
  symbol: { alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 24, height: 54, justifyContent: 'center', width: 54 },
  title: { color: colors.ink, fontSize: 27, fontWeight: '800', lineHeight: 33, marginTop: spacing.md },
  description: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: spacing.xs, maxWidth: 320 },
  button: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.ink, borderRadius: 8, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.lg, minHeight: 50, paddingHorizontal: spacing.md },
  pressed: { opacity: 0.84 },
  buttonText: { color: colors.surface, fontSize: 14, fontWeight: '700' },
});
