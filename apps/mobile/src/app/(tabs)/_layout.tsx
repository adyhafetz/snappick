import * as React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';
import { Home, History, ScanLine, Package, User } from 'lucide-react-native';

import { LoadingScreen } from '@/components/LoadingScreen';
import { hasRequiredConsents } from '@/lib/consent';
import { useAuth } from '@/providers/AuthProvider';

export default function TabsLayout() {
  const { loading, session, profile, profileLoading } = useAuth();

  if (!loading && !session) return <Redirect href="/(auth)/sign-in" />;
  if (session && profileLoading) return <LoadingScreen message="Loading..." />;
  if (session && !hasRequiredConsents(profile)) return <Redirect href="/(consent)/image-storage" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#19806d',
        tabBarInactiveTintColor: '#5b7072',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: -2,
          marginBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e5e7eb',
          borderTopWidth: 1,
          height: 64,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View
              className={`h-8 w-12 items-center justify-center rounded-full ${
                focused ? 'bg-primary/10' : 'bg-transparent'
              }`}
            >
              <Home size={20} color={color} strokeWidth={focused ? 2.4 : 1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <View
              className={`h-8 w-12 items-center justify-center rounded-full ${
                focused ? 'bg-primary/10' : 'bg-transparent'
              }`}
            >
              <History size={20} color={color} strokeWidth={focused ? 2.4 : 1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <View
              className={`h-8 w-12 items-center justify-center rounded-full ${
                focused ? 'bg-primary/10' : 'bg-transparent'
              }`}
            >
              <ScanLine size={20} color={color} strokeWidth={focused ? 2.4 : 1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          title: 'Request',
          tabBarIcon: ({ color, focused }) => (
            <View
              className={`h-8 w-12 items-center justify-center rounded-full ${
                focused ? 'bg-primary/10' : 'bg-transparent'
              }`}
            >
              <Package size={20} color={color} strokeWidth={focused ? 2.4 : 1.8} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View
              className={`h-8 w-12 items-center justify-center rounded-full ${
                focused ? 'bg-primary/10' : 'bg-transparent'
              }`}
            >
              <User size={20} color={color} strokeWidth={focused ? 2.4 : 1.8} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
