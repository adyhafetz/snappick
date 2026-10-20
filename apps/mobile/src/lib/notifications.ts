import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS !== 'android' || !Device.isDevice) return null;
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return null;
  await Notifications.setNotificationChannelAsync('pickup-status', { name: 'Pickup status', importance: Notifications.AndroidImportance.DEFAULT });

  let token: Notifications.DevicePushToken | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      token = await Notifications.getDevicePushTokenAsync();
      break;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  if (!token || (token.type !== 'android' && (token.type as string) !== 'fcm') || typeof token.data !== 'string' || token.data.length < 10) {
    return null;
  }
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;
  const { error } = await supabase.from('push_tokens').upsert({ user_id: user.id, token: token.data, platform: 'android', last_seen_at: new Date().toISOString() }, { onConflict: 'user_id,token' });
  if (error) throw error;
  return token.data;
}

export function subscribeToNotificationNavigation(onResponse: (requestId: string) => void) {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const requestId = response.notification.request.content.data?.request_id;
    if (typeof requestId === 'string') onResponse(requestId);
  });
  return () => subscription.remove();
}
