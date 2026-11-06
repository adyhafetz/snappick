import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

import { supabase } from '@/lib/supabase';
import { activateRemoteModel, checkForModelUpdate } from './manager';
import {
  shouldCheckForModelUpdate,
  shouldPromptForModel,
  type DismissedModelPrompt,
} from './model-update-policy';

const LAST_CHECK_KEY = 'snappick_model_update_last_check';
const DISMISSED_KEY = 'snappick_model_update_dismissed';

let running = false;

/**
 * Looks for a new detector model in the background (at most every few hours) and asks the user
 * once before switching. Never throws; the bundled/current model keeps working on any failure.
 */
export async function maybePromptForModelUpdate(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;

    const now = Date.now();
    const lastRaw = await AsyncStorage.getItem(LAST_CHECK_KEY);
    const last = lastRaw ? Number(lastRaw) : null;
    if (!shouldCheckForModelUpdate(Number.isFinite(last) ? last : null, now)) return;

    const result = await checkForModelUpdate(userId);
    // Only count a successful registry lookup, so an offline start retries sooner.
    if (!result.remoteModel && !result.hasUpdate) {
      if (result.message.startsWith('Could not connect')) return;
    }
    await AsyncStorage.setItem(LAST_CHECK_KEY, String(now));

    if (!result.hasUpdate || !result.remoteModel) return;
    const model = result.remoteModel;

    let dismissed: DismissedModelPrompt | null = null;
    try {
      const raw = await AsyncStorage.getItem(DISMISSED_KEY);
      dismissed = raw ? (JSON.parse(raw) as DismissedModelPrompt) : null;
    } catch {
      dismissed = null;
    }
    if (!shouldPromptForModel(model.version, dismissed, now)) return;

    Alert.alert(
      'Better detector available',
      `A new waste detection model (${model.version.toUpperCase()}) is ready. Update now?`,
      [
        {
          text: 'Later',
          style: 'cancel',
          onPress: () => {
            void AsyncStorage.setItem(
              DISMISSED_KEY,
              JSON.stringify({ version: model.version, at: Date.now() })
            );
          },
        },
        {
          text: 'Update',
          onPress: () => {
            void activateRemoteModel(model).then((ok) => {
              if (!ok) {
                Alert.alert('Update failed', 'Could not download the model. The current detector is kept.');
              }
            });
          },
        },
      ]
    );
  } catch {
    // Stay on the current model.
  } finally {
    running = false;
  }
}
