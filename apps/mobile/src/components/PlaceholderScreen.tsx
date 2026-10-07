import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme';

export function PlaceholderScreen({ title, description }: { title: string; description: string }) {
  return <View style={styles.container}><Text style={styles.eyebrow}>SNAPPICK</Text><Text style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text></View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.canvas, flex: 1, justifyContent: 'center', padding: spacing.lg },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: spacing.sm },
  description: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: spacing.sm },
});
