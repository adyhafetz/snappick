import * as React from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  LogOut,
  Check,
  CheckCircle2,
  Star,
  AlertCircle,
  Mail,
  User,
  Phone,
  Shield,
  Sparkles,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/providers/AuthProvider';
import {
  checkForModelUpdate,
  activateRemoteModel,
} from '@/lib/detector/manager';
import { supabase } from '@/lib/supabase';
import { formatRating } from '@/lib/pickup/rating';
import { deleteOwnStoredFiles } from '@/lib/account/delete-stored-files';

export default function ProfileScreen() {
  const { profile, profileLoading, session, signOut, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [storageSaving, setStorageSaving] = useState(false);
  const [trainingSaving, setTrainingSaving] = useState(false);
  const [checkingModel, setCheckingModel] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (notice || error) {
      const timer = setTimeout(() => {
        setNotice(null);
        setError(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notice, error]);

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

  async function toggleImageStorage(value: boolean) {
    setStorageSaving(true);
    setError(null);
    setNotice(null);
    try {
      await updateProfile({
        image_storage_consent: value,
        image_storage_consent_at: value ? new Date().toISOString() : null,
        image_storage_consent_version: 1,
      });
      setNotice(
        value
          ? 'Photo Backup turned on.'
          : 'Photo Backup turned off. Your scans stay on this phone.'
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save privacy choice.');
    } finally {
      setStorageSaving(false);
    }
  }

  async function handleCheckModelUpdate() {
    setCheckingModel(true);
    setError(null);
    setNotice(null);
    try {
      const result = await checkForModelUpdate(session?.user.id);
      if (result.hasUpdate && result.remoteModel) {
        const targetVersion = result.remoteModel.version;
        Alert.alert(
          'Better detector available',
          `A newer version of the waste detector (${targetVersion}) is ready. Use it now?`,
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Update Now',
              style: 'default',
              onPress: () => {
                void (async () => {
                  const ok = await activateRemoteModel(result.remoteModel!);
                  if (ok) {
                    setNotice(`Model ${targetVersion} activated.`);
                  } else {
                    setError('Could not download model. Local detector retained.');
                  }
                })();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Up to Date',
          'You have the newest detector.'
        );
      }
    } catch (updateErr) {
      setError(updateErr instanceof Error ? updateErr.message : 'Check for update failed.');
    } finally {
      setCheckingModel(false);
    }
  }

  function promptDeleteAccount() {
    Alert.alert(
      'Delete Account?',
      'All your personal info, addresses, and saved scans will be permanently deleted. Anonymized waste images already compiled into past AI training datasets cannot be individually removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => void executeAccountDeletion(),
        },
      ]
    );
  }

  async function executeAccountDeletion() {
    setDeletingAccount(true);
    setError(null);
    try {
      // Delete stored photos first: the account removal below does not delete files in storage.
      const userId = session?.user.id;
      if (userId) await deleteOwnStoredFiles(userId);
      const { error: rpcError } = await supabase.rpc('delete_user_account');
      if (rpcError) throw rpcError;
      await signOut();
    } catch (delError) {
      setError(
        delError instanceof Error
          ? delError.message
          : 'Could not complete account deletion. Please try again.'
      );
      setDeletingAccount(false);
    }
  }

  const profileRating = formatRating(profile?.rating_avg, profile?.rating_count);
  const memberSince = React.useMemo(() => {
    const dateStr = profile?.created_at || session?.user?.created_at;
    if (!dateStr) return 'Active Member';
    try {
      const d = new Date(dateStr);
      return `Joined ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
    } catch {
      return 'Active Member';
    }
  }, [profile?.created_at, session?.user?.created_at]);

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
        contentContainerStyle={{ paddingBottom: 80 }}
        className="px-6 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="mb-4">
          <Text className="text-3xl font-black tracking-tight text-foreground">Profile</Text>
        </View>

        {/* User Card */}
        <View className="mb-6 rounded-3xl overflow-hidden bg-primary shadow-md shadow-primary/25 relative">
          {/* Subtle ambient glowing background orbs */}
          <View
            style={{
              position: 'absolute',
              right: -25,
              top: -25,
              width: 130,
              height: 130,
              borderRadius: 65,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 45,
              bottom: -35,
              width: 110,
              height: 110,
              borderRadius: 55,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: -15,
              bottom: -15,
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
            }}
          />

          <View className="p-4">
            {/* Main Identity Row */}
            <View className="flex-row items-center gap-3.5">
              {/* Avatar box (without tick) */}
              <View style={{ flexShrink: 0 }}>
                <View
                  style={{
                    width: 62,
                    height: 62,
                    backgroundColor: '#359d8a',
                  }}
                  className="rounded-2xl items-center justify-center border border-white/20 shadow-sm"
                >
                  <Text className="text-2xl font-black text-white">{initial}</Text>
                </View>
              </View>

              {/* User details */}
              <View className="flex-1 justify-center">
                <View className="flex-row items-center gap-2">
                  <Text className="text-lg font-black text-white tracking-tight" numberOfLines={1}>
                    {profile.display_name || 'SnapPick Member'}
                  </Text>
                  {profile.is_admin && (
                    <View className="px-2 py-0.5 rounded-full bg-amber-400">
                      <Text className="text-[10px] font-black text-amber-950 uppercase">Admin</Text>
                    </View>
                  )}
                </View>

                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <Mail size={12} color="rgba(255, 255, 255, 0.75)" />
                  <Text className="text-xs text-white/80 font-medium" numberOfLines={1}>
                    {session?.user.email ?? 'Signed-in user'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Subtle frosted divider */}
            <View className="h-[1px] bg-white/15 my-3.5" />

            {/* Card Footer: Rating on left, Joined on right */}
            <View className="flex-row items-center justify-between px-0.5">
              <View className="flex-row items-center gap-1.5">
                {profileRating.rated ? (
                  <>
                    <Star size={13} color="#facc15" fill="#facc15" />
                    <Text className="text-xs font-bold text-white">
                      {profileRating.average}
                    </Text>
                    <Text className="text-[10px] font-medium text-white/75">
                      ({profileRating.count})
                    </Text>
                  </>
                ) : (
                  <Text className="text-xs font-bold text-white/75">New collector</Text>
                )}
              </View>
              <Text className="text-xs font-medium text-white/75">
                {memberSince}
              </Text>
            </View>
          </View>
        </View>

        {/* Alerts */}
        {error && (
          <View className="flex-row items-center gap-2.5 rounded-2xl bg-destructive/10 border border-destructive/20 p-3.5 mb-4">
            <AlertCircle size={18} color="#b42318" />
            <Text className="flex-1 text-xs font-semibold text-destructive leading-tight">
              {error}
            </Text>
            <TouchableOpacity
              onPress={() => setError(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error alert"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="p-1"
            >
              <X size={16} color="#b42318" />
            </TouchableOpacity>
          </View>
        )}

        {notice && (
          <View className="flex-row items-center gap-2.5 rounded-2xl bg-primary/10 border border-primary/20 p-3.5 mb-4">
            <CheckCircle2 size={18} color="#19806d" />
            <Text className="flex-1 text-xs font-semibold text-primary leading-tight">
              {notice}
            </Text>
            <TouchableOpacity
              onPress={() => setNotice(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss notice alert"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              className="p-1"
            >
              <X size={16} color="#19806d" />
            </TouchableOpacity>
          </View>
        )}

        {/* Personal Details Section */}
        <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          ACCOUNT DETAILS
        </Text>
        <Card className="p-4 border-border/70 bg-card rounded-2xl shadow-sm mb-6 space-y-3">
          <View className="relative justify-center">
            <Input
              autoCapitalize="words"
              onChangeText={setDisplayName}
              placeholder="Display name"
              value={displayName}
              className="pl-11 h-12 rounded-2xl bg-secondary/30 border-border/60"
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
              className="pl-11 h-12 rounded-2xl bg-secondary/30 border-border/60"
            />
            <View className="absolute left-3.5">
              <Phone size={18} color="#5b7072" />
            </View>
          </View>

          <Button
            disabled={saving}
            onPress={() => void saveDetails()}
            className="w-full h-12 rounded-2xl bg-primary mt-2 flex-row items-center justify-center gap-2"
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Check size={18} color="#ffffff" strokeWidth={2.5} />
                <Text className="text-base font-bold text-white">Save</Text>
              </>
            )}
          </Button>
        </Card>

        {/* Privacy & Settings Section */}
        <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          PRIVACY & STORAGE
        </Text>
        <Card className="p-4 border-border/70 bg-card rounded-2xl shadow-sm mb-6">
          {/* Photo Backup Toggle */}
          <View className="flex-row items-center justify-between pb-3.5 border-b border-border/40">
            <View className="flex-1 pr-4">
              <View className="flex-row items-center gap-1.5">
                <Shield size={15} color="#19806d" />
                <Text className="text-sm font-bold text-foreground">Photo Backup</Text>
              </View>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Keep scan photos safely online. Needed for pickups.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Photo backup"
              disabled={storageSaving}
              checked={profile.image_storage_consent}
              onCheckedChange={(value) => void toggleImageStorage(value)}
            />
          </View>

          {/* Training Opt-in */}
          <View className="flex-row items-center justify-between pt-3.5">
            <View className="flex-1 pr-4">
              <View className="flex-row items-center gap-1.5">
                <Sparkles size={15} color="#19806d" />
                <Text className="text-sm font-bold text-foreground">AI Model Training</Text>
              </View>
              <Text className="text-xs text-muted-foreground mt-0.5">
                Let your scan photos, without your name or location, help SnapPick recognise waste better.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Help improve SnapPick"
              disabled={trainingSaving}
              checked={profile.training_opt_in}
              onCheckedChange={(value) => void toggleTrainingOptIn(value)}
            />
          </View>

          {/* AI Model Updates Action */}
          <View className="pt-3.5 mt-3.5 border-t border-border/40">
            <Button
              variant="outline"
              disabled={checkingModel}
              onPress={() => void handleCheckModelUpdate()}
              className="w-full h-11 rounded-2xl border-primary/20 bg-primary/5 flex-row items-center justify-center gap-2"
            >
              {checkingModel ? (
                <ActivityIndicator size="small" color="#19806d" />
              ) : (
                <RefreshCw size={15} color="#19806d" />
              )}
              <Text className="text-xs font-bold text-primary">
                {checkingModel ? 'Checking...' : 'Check for Detector Update'}
              </Text>
            </Button>
          </View>
        </Card>

        {/* Account & App Actions Section */}
        <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          ACCOUNT ACTIONS
        </Text>
        <View className="gap-3">
          <Button
            variant="outline"
            onPress={() => void signOut()}
            className="w-full h-12 rounded-2xl border-border/80 bg-card flex-row items-center justify-center gap-2"
          >
            <LogOut size={16} color="#5b7072" />
            <Text className="text-base font-bold text-foreground">Sign Out</Text>
          </Button>

          <Button
            variant="outline"
            disabled={deletingAccount}
            onPress={promptDeleteAccount}
            className="w-full h-12 rounded-2xl border-destructive/20 bg-destructive/5 flex-row items-center justify-center gap-2"
          >
            {deletingAccount ? (
              <ActivityIndicator size="small" color="#b42318" />
            ) : (
              <Trash2 size={16} color="#b42318" />
            )}
            <Text className="text-base font-bold text-destructive">
              {deletingAccount ? 'Deleting Account...' : 'Delete Account'}
            </Text>
          </Button>
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}
