import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { colors, spacing } from '@/theme';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  return <View style={styles.container}><Text style={styles.eyebrow}>PROFILE</Text><Text style={styles.title}>Your account</Text><Text style={styles.email}>{session?.user.email ?? 'Signed-in user'}</Text><Pressable onPress={() => void signOut()} style={styles.button}><Text style={styles.buttonText}>Sign out</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.canvas, flex: 1, padding: spacing.lg },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginTop: spacing.lg },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: spacing.sm },
  email: { color: colors.muted, fontSize: 16, marginTop: spacing.sm },
  button: { alignItems: 'center', borderColor: colors.border, borderRadius: 10, borderWidth: 1, justifyContent: 'center', marginTop: spacing.xl, minHeight: 50 },
  buttonText: { color: colors.primaryDark, fontSize: 16, fontWeight: '800' },
});
