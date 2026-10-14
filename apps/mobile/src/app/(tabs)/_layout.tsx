import { Redirect, Tabs } from 'expo-router';
import { View, type ColorValue } from 'react-native';
import { type AndroidSymbol } from 'expo-symbols';

import { AppIcon } from '@/components/AppIcon';
import { LoadingScreen } from '@/components/LoadingScreen';
import { hasRequiredConsents } from '@/lib/consent';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

function TabBarIcon({ name, color, focused }: { name: AndroidSymbol; color: ColorValue; focused: boolean }) {
  return <View style={{ alignItems: 'center', backgroundColor: focused ? colors.surfaceAlt : 'transparent', borderRadius: 16, height: 32, justifyContent: 'center', width: 56 }}>
    <AppIcon name={name} color={color} size={21} />
  </View>;
}

export default function TabsLayout() {
  const { loading, session, profile, profileLoading } = useAuth();
  if (!loading && !session) return <Redirect href="/(auth)/sign-in" />;
  if (session && profileLoading) return <LoadingScreen />;
  if (session && !hasRequiredConsents(profile)) return <Redirect href="/(consent)/image-storage" />;
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.primaryDark,
    tabBarInactiveTintColor: colors.muted,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 1 },
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, height: 68, paddingBottom: 5, paddingTop: 5 },
    tabBarIconStyle: { height: 32 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <TabBarIcon name="home" color={color} focused={focused} /> }} />
    <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: ({ color, focused }) => <TabBarIcon name="history" color={color} focused={focused} /> }} />
    <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: ({ color, focused }) => <TabBarIcon name="camera_alt" color={color} focused={focused} /> }} />
    <Tabs.Screen name="request" options={{ title: 'Request', tabBarIcon: ({ color, focused }) => <TabBarIcon name="location_on" color={color} focused={focused} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, focused }) => <TabBarIcon name="account_circle" color={color} focused={focused} /> }} />
  </Tabs>;
}
