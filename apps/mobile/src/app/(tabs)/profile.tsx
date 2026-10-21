import * as React from 'react';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LogOut,
  CheckCircle2,
  AlertCircle,
  Mail,
  User,
  Phone,
  Shield,
  Sparkles,
} from 'lucide-react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/providers/AuthProvider';

export default function ProfileScreen() {
  const { profile, profileLoading, session, signOut, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [storageSaving, setStorageSaving] = useState(false);
  const [trainingSaving, setTrainingSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function saveDetails() {
    const nextName = displayName.trim();
    const nextPhone = phone.trim();
    if (!nextName) {
      setError('Enter a display name.');
      return;
    }
    if (nextPhone.length > 30) {
      setError('Phone numbers must be 30 characters or fewer.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateProfile({ display_name: nextName, phone: nextPhone || null });
      setNotice('Profile updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleTrainingOptIn(value: boolean) {
    setTrainingSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateProfile({
        training_opt_in: value,
        training_opt_in_at: value ? new Date().toISOString() : null,
      });
      setNotice(value ? 'Training contribution enabled.' : 'Training contribution disabled.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save privacy choice.');
    } finally {
      setTrainingSaving(false);
    }
  }

  async function revokeImageStorage() {
    setStorageSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateProfile({
        image_storage_consent: false,
        image_storage_consent_at: null,
        image_storage_consent_version: null,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save privacy choice.');
      setStorageSaving(false);
    }
  }

  if (profileLoading || !profile) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#19806d" size="large" />
      </View>
    );
  }

  const initial = (displayName || profile.display_name || session?.user.email || 'U')
    .charAt(0)
    .toUpperCase();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        className="px-6 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Bar */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-black tracking-tight text-foreground">Profile</Text>
        </View>

        {/* User Card */}
        <Card className="p-4 border-0 mb-6 bg-primary shadow-sm rounded-3xl">
          <View className="flex-row items-center gap-3.5">
            <View className="h-14 w-14 rounded-2xl bg-white/20 border border-white/30 items-center justify-center">
              <Text className="text-xl font-black text-white">{initial}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-white">
                {profile.display_name || 'SnapPick Member'}
              </Text>
              <View className="flex-row items-center gap-1.5 mt-0.5">
                <Mail size={12} color="rgba(255, 255, 255, 0.8)" />
                <Text className="text-xs text-white/80" numberOfLines={1}>
                  {session?.user.email ?? 'Signed-in user'}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Alerts */}
        {error && (
          <View className="flex-row items-center gap-2.5 rounded-2xl bg-destructive/10 border border-destructive/20 p-3.5 mb-4">
            <AlertCircle size={18} color="#b42318" />
            <Text className="flex-1 text-xs font-semibold text-destructive leading-tight">
              {error}
            </Text>
          </View>
        )}

        {notice && (
          <View className="flex-row items-center gap-2.5 rounded-2xl bg-primary/10 border border-primary/20 p-3.5 mb-4">
            <CheckCircle2 size={18} color="#19806d" />
            <Text className="flex-1 text-xs font-semibold text-primary leading-tight">
              {notice}
            </Text>
          </View>
        )}

        {/* Personal Details Section */}
        <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Account details
        </Text>
        <Card className="p-4 border-border/70 bg-card rounded-2xl shadow-sm mb-6 space-y-3">
          <View className="relative justify-center">
            <Input
              autoCapitalize="words"
              onChangeText={setDisplayName}
              placeholder="Display name"
              value={displayName}
              className="pl-11 h-12 rounded-xl bg-secondary/30 border-border/60"
            />
            <View className="absolute left-3.5">
              <User size={18} color="#5b7072" />
            </View>
          </View>

          <View className="relative justify-center mt-2">
            <Input
              autoComplete="tel"
              keyboardType="phone-pad"
              onChangeText={setPhone}
              placeholder="Phone number (optional)"
              value={phone}
              className="pl-11 h-12 rounded-xl bg-secondary/30 border-border/60"
            />
            <View className="absolute left-3.5">
              <Phone size={18} color="#5b7072" />
            </View>
          </View>

          <Button
            disabled={saving}
            onPress={() => void saveDetails()}
            className="w-full h-11 rounded-xl bg-primary mt-2"
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-sm font-bold text-white">Save Changes</Text>
            )}
          </Button>
        </Card>

        {/* Privacy & Settings Section */}
        <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          Privacy & Data
        </Text>
        <Card className="p-4 border-border/70 bg-card rounded-2xl shadow-sm mb-6">
          {/* Storage Toggle */}
          <View className="flex-row items-center justify-between py-2 border-b border-border/40">
            <View className="flex-1 pr-4">
              <View className="flex-row items-center gap-1.5">
                <Shield size={15} color="#19806d" />
                <Text className="text-sm font-bold text-foreground">Save Scan History</Text>
              </View>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Allows reviewing past scans in your account
              </Text>
            </View>
            <Switch
              accessibilityLabel="Allow scan image storage"
              disabled={storageSaving}
              checked={profile.image_storage_consent}
              onCheckedChange={(value) => {
                if (!value) void revokeImageStorage();
              }}
            />
          </View>

          {/* Training Opt-in */}
          <View className="flex-row items-center justify-between pt-3">
            <View className="flex-1 pr-4">
              <View className="flex-row items-center gap-1.5">
                <Sparkles size={15} color="#19806d" />
                <Text className="text-sm font-bold text-foreground">Help Improve AI</Text>
              </View>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Share anonymous photos to train local sorting
              </Text>
            </View>
            <Switch
              accessibilityLabel="Help improve SnapPick"
              disabled={trainingSaving}
              checked={profile.training_opt_in}
              onCheckedChange={(value) => void toggleTrainingOptIn(value)}
            />
          </View>
        </Card>

        {/* Sign Out Button */}
        <Button
          variant="outline"
          onPress={() => void signOut()}
          className="w-full h-12 rounded-2xl border-destructive/20 bg-destructive/5 flex-row items-center justify-center gap-2"
        >
          <LogOut size={16} color="#b42318" />
          <Text className="text-sm font-bold text-destructive">Sign Out</Text>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
