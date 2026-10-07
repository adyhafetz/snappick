import { Redirect, Tabs } from 'expo-router';
import { Text, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { loading, session } = useAuth();
  if (!loading && !session) return <Redirect href="/(auth)/sign-in" />;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontSize: 11, fontWeight: '700' }, tabBarStyle: { borderTopColor: colors.border, height: 72, paddingBottom: 8, paddingTop: 8 } }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⌂</Text> }} />
    <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>≡</Text> }} />
    <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: () => <View style={{ alignItems: 'center', backgroundColor: colors.primary, borderRadius: 24, height: 48, justifyContent: 'center', marginTop: -18, width: 48 }}><Text style={{ color: colors.surface, fontSize: 28, fontWeight: '300' }}>＋</Text></View>, tabBarLabelStyle: { color: colors.primary, fontSize: 11, fontWeight: '800' } }} />
    <Tabs.Screen name="request" options={{ title: 'Request', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⌖</Text> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>◉</Text> }} />
  </Tabs>;
}
