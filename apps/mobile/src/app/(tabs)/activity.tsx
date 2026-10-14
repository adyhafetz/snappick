import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

export default function ActivityScreen() {
  return <SafeAreaView edges={['top']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.brand}>SnapPick</Text>
      <Text style={styles.title}>Activity</Text>
      <Text style={styles.subtitle}>Your requests and community pickups.</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My requests</Text>
        <Text style={styles.empty}>Request history is not available in this build yet.</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pickups I claimed</Text>
        <Text style={styles.empty}>Claimed pickups are not available in this build yet.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  content: { paddingBottom: spacing.xl, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  brand: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800', marginTop: spacing.lg },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: spacing.xxs },
  section: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: spacing.xl, paddingTop: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  empty: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
});
