import * as React from 'react';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LogOut,
  CheckCircle2,
  AlertCircle,
  Mail,
} from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
      setNotice('Profile saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'We could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleTrainingOptIn(value: boolean) {
    setTrainingSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateProfile({ training_opt_in: value, training_opt_in_at: value ? new Date().toISOString() : null });
      setNotice(value ? 'Training opt-in enabled.' : 'Training opt-in disabled.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'We could not save that privacy choice.');
    } finally {
      setTrainingSaving(false);
    }
  }

  async function revokeImageStorage() {
    setStorageSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateProfile({ image_storage_consent: false, image_storage_consent_at: null, image_storage_consent_version: null });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'We could not save that privacy choice.');
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

  const initial = (displayName || profile.display_name || session?.user.email || 'U').charAt(0).toUpperCase();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="px-6 pt-4" keyboardShouldPersistTaps="handled">
        {/* Brand Bar */}
        <View className="mb-4">
          <Text className="text-xl font-extrabold tracking-tight text-ink">SnapPick</Text>
          <View className="h-1 w-8 rounded-full bg-primary mt-1" />
        </View>

        {/* Profile Card Header */}
        <Card className="p-5 border-0 mb-6 bg-primary shadow-sm">
          <View className="flex-row items-center gap-4">
            <View className="h-14 w-14 rounded-2xl bg-white/20 border border-white/30 items-center justify-center">
              <Text className="text-xl font-bold text-white">{initial}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-white">
                {profile.display_name || 'SnapPick Member'}
              </Text>
              <View className="flex-row items-center gap-1.5 mt-0.5">
                <Mail size={13} color="rgba(255, 255, 255, 0.8)" />
                <Text className="text-xs text-white/80">
                  {session?.user.email ?? 'Signed-in user'}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Notifications / Alerts */}
        {error && (
          <View className="flex-row items-center gap-2.5 rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 mb-4">
            <AlertCircle size={18} color="#b42318" />
            <Text className="flex-1 text-xs font-medium text-destructive leading-tight">
              {error}
            </Text>
          </View>
        )}

        {notice && (
          <View className="flex-row items-center gap-2.5 rounded-xl bg-primary/10 border border-primary/20 p-3.5 mb-4">
            <CheckCircle2 size={18} color="#19806d" />
            <Text className="flex-1 text-xs font-semibold text-primary leading-tight">
              {notice}
            </Text>
          </View>
        )}

        {/* Personal Details Section */}
        <Card className="border-border/80 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Personal details</CardTitle>
            <CardDescription className="text-xs">
              Contact info for community pickup coordination
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            <View className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Display name
              </Label>
              <Input
                autoCapitalize="words"
                onChangeText={setDisplayName}
                placeholder="Your name"
                value={displayName}
              />
            </View>

            <View className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Phone (optional)
              </Label>
              <Input
                autoComplete="tel"
                keyboardType="phone-pad"
                onChangeText={setPhone}
                placeholder="For pickup coordination"
                value={phone}
              />
            </View>

            <Button
              disabled={saving}
              onPress={() => void saveDetails()}
              className="w-full bg-primary mt-2"
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-sm font-semibold text-white">Save details</Text>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Privacy Section */}
        <Card className="border-border/80 mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Privacy & Data</CardTitle>
            <CardDescription className="text-xs">
              Control how images and scan data are stored
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            {/* Storage Toggle */}
            <View className="flex-row items-start justify-between py-2 border-b border-border/40">
              <View className="flex-1 pr-4">
                <Text className="text-sm font-semibold text-foreground">
                  Allow scan image storage
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Required for SnapPick scans. Turning this off revokes consent.
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
            <View className="flex-row items-start justify-between py-2">
              <View className="flex-1 pr-4">
                <Text className="text-sm font-semibold text-foreground">
                  Help improve SnapPick
                </Text>
                <Text className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Allow eligible, consented images to help future detector training.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Help improve SnapPick"
                disabled={trainingSaving}
                checked={profile.training_opt_in}
                onCheckedChange={(value) => void toggleTrainingOptIn(value)}
              />
            </View>
          </CardContent>
        </Card>

        {/* Account Danger / Sign Out Section */}
        <View className="space-y-3">
          <Button
            variant="outline"
            disabled
            className="w-full border-border/70 bg-card/40 justify-start px-4"
          >
            <Text className="text-xs font-medium text-muted-foreground">
              Delete account is not available in this build.
            </Text>
          </Button>

          <Button
            variant="outline"
            onPress={() => void signOut()}
            className="w-full border-destructive/20 bg-destructive/5 gap-2 mt-2"
          >
            <LogOut size={16} color="#b42318" />
            <Text className="text-sm font-semibold text-destructive">Sign Out</Text>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
