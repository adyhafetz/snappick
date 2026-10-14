import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { colors, shape, spacing } from '@/theme';

export default function HomeScreen() {
  return <SafeAreaView edges={['top']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.brandRow}><Text style={styles.brand}>SnapPick</Text><View style={styles.brandMark}><View style={styles.brandMarkInner} /></View></View>
      <Text style={styles.title}>Ready to sort?</Text>
      <Text style={styles.subtitle}>A little guidance for the things you have at home.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/scan')} style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}>
        <View style={styles.scanIcon}><AppIcon name="photo_camera" color={colors.surface} size={23} /></View>
        <View style={styles.scanCopy}><Text style={styles.scanTitle}>Scan an item</Text><Text style={styles.scanBody}>Check its sorting guidance</Text></View>
        <AppIcon name="arrow_forward" color={colors.surface} size={20} />
      </Pressable>
      <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Before you begin</Text></View>
      <View style={styles.noteRow}>
        <View style={styles.noteNumber}><Text style={styles.noteNumberText}>1</Text></View>
        <View style={styles.noteCopy}><Text style={styles.noteTitle}>Keep the whole item in view</Text><Text style={styles.noteBody}>Clear photos help the on-device scan.</Text></View>
      </View>
      <View style={styles.noteRow}>
        <View style={[styles.noteNumber, styles.noteNumberAmber]}><Text style={[styles.noteNumberText, styles.noteNumberAmberText]}>2</Text></View>
        <View style={styles.noteCopy}><Text style={styles.noteTitle}>Check the result</Text><Text style={styles.noteBody}>Hazards such as batteries are always declared manually.</Text></View>
      </View>
      <View style={styles.activityHeader}><Text style={styles.sectionTitle}>Recent activity</Text><AppIcon name="chevron_right" color={colors.muted} size={20} /></View>
      <Text style={styles.emptyText}>Nothing to show yet.</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  content: { paddingBottom: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  brandRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  brand: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  brandMark: { alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 16, height: 38, justifyContent: 'center', width: 38 },
  brandMarkInner: { backgroundColor: colors.primary, borderRadius: 8, height: 14, transform: [{ rotate: '-35deg' }], width: 14 },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800', lineHeight: 35, marginTop: spacing.lg },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: spacing.xxs },
  scanButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: shape.control, flexDirection: 'row', marginTop: spacing.lg, minHeight: 76, paddingHorizontal: spacing.md },
  pressed: { opacity: 0.84 },
  scanIcon: { alignItems: 'center', backgroundColor: '#31565d', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  scanCopy: { flex: 1, marginLeft: spacing.sm },
  scanTitle: { color: colors.surface, fontSize: 15, fontWeight: '700' },
  scanBody: { color: '#d1e0dc', fontSize: 12, marginTop: 4 },
  sectionHeader: { marginTop: spacing.xl, paddingBottom: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  noteRow: { alignItems: 'flex-start', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', paddingVertical: spacing.md },
  noteNumber: { alignItems: 'center', backgroundColor: colors.successSurface, borderRadius: 15, height: 30, justifyContent: 'center', marginRight: spacing.sm, width: 30 },
  noteNumberText: { color: colors.success, fontSize: 13, fontWeight: '800' },
  noteNumberAmber: { backgroundColor: colors.warningSurface },
  noteNumberAmberText: { color: colors.warning },
  noteCopy: { flex: 1, paddingTop: 1 },
  noteTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  noteBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 3 },
  activityHeader: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.md },
  emptyText: { color: colors.muted, fontSize: 13, marginTop: spacing.sm },
});
