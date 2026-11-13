import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { deleteDownloadedModels, downloadVerifiedModel } from './model-files';

export const ACTIVE_MODEL_STORAGE_KEY = 'snappick_active_model_version';
export const ACTIVE_MODEL_CONFIG_KEY = 'snappick_active_model_config';
export const BUNDLED_FALLBACK_VERSION = 'v0';

export interface EligibleModel {
  version: string;
  role: string;
  status: string;
  sha256: string;
  size_bytes: number;
  storage_path: string;
  thresholds: Record<string, unknown>;
  min_app_version: string;
  rollout_percent: number;
  user_bucket: number;
  is_eligible: boolean;
}

export interface ActiveModelConfig {
  version: string;
  /** The downloaded, checksum-verified model file on this phone. */
  localUri?: string;
  /** Older configs stored a download link (expired after 7 days); they are no longer used to load a model. */
  url?: string;
  sha256?: string;
  manifest?: Record<string, unknown>;
}

export interface CheckUpdateResult {
  hasUpdate: boolean;
  currentVersion: string;
  remoteModel: EligibleModel | null;
  message: string;
}

/**
 * Retrieves the currently active model version for this device.
 * Falls back to bundled v0 if not set.
 */
export async function getActiveModelVersion(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(ACTIVE_MODEL_STORAGE_KEY);
    return stored || BUNDLED_FALLBACK_VERSION;
  } catch {
    return BUNDLED_FALLBACK_VERSION;
  }
}

/**
 * Retrieves the active model configuration (remote URL, manifest) if an OTA model is active.
 */
export async function getActiveModelConfig(): Promise<ActiveModelConfig | null> {
  try {
    const stored = await AsyncStorage.getItem(ACTIVE_MODEL_CONFIG_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ActiveModelConfig;
  } catch {
    return null;
  }
}

/**
 * Sets the active model version after verification.
 */
export async function setActiveModelVersion(version: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_MODEL_STORAGE_KEY, version);
}

/**
 * Activates a new detector: downloads it once to the phone, checks it against its registered SHA-256, then stores
 * its config. On any failure the current detector stays active.
 */
export async function activateRemoteModel(remoteModel: EligibleModel): Promise<boolean> {
  try {
    const { data: signed, error: signErr } = await supabase.storage
      .from('models')
      .createSignedUrl(remoteModel.storage_path, 600);

    const modelUrl = signed?.signedUrl;
    if (signErr || !modelUrl) {
      console.warn('Could not generate model download URL:', signErr?.message);
      return false;
    }

    const localUri = await downloadVerifiedModel(modelUrl, remoteModel.version, remoteModel.sha256);
    const config: ActiveModelConfig = {
      version: remoteModel.version,
      localUri,
      sha256: remoteModel.sha256,
      manifest: {
        version: remoteModel.version,
        thresholds: remoteModel.thresholds,
      },
    };

    await AsyncStorage.setItem(ACTIVE_MODEL_CONFIG_KEY, JSON.stringify(config));
    await AsyncStorage.setItem(ACTIVE_MODEL_STORAGE_KEY, remoteModel.version);
    try {
      deleteDownloadedModels(localUri);
    } catch {
      // Old files are only a space concern.
    }
    return true;
  } catch (err) {
    console.warn('activateRemoteModel failed:', err);
    return false;
  }
}

/**
 * Resets back to the immutable bundled fallback model (v0).
 */
export async function rollbackToBundledFallback(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_MODEL_CONFIG_KEY);
  await AsyncStorage.setItem(ACTIVE_MODEL_STORAGE_KEY, BUNDLED_FALLBACK_VERSION);
  try {
    deleteDownloadedModels();
  } catch {
    // Nothing to clean up.
  }
}

/**
 * Checks Supabase for eligible models for this user.
 * Evaluates rollout percent, status, and compares with currently active version.
 */
export async function checkForModelUpdate(userId?: string): Promise<CheckUpdateResult> {
  const currentVersion = await getActiveModelVersion();

  try {
    const { data, error } = await supabase.rpc('get_eligible_model_for_user', {
      p_user_id: userId ?? null,
    });

    if (error || !Array.isArray(data) || data.length === 0) {
      return {
        hasUpdate: false,
        currentVersion,
        remoteModel: null,
        message: 'Could not connect to model registry. Using local detector.',
      };
    }

    // Filter to eligible models (staged rollout check passed)
    const eligibleModels = (data as EligibleModel[]).filter((m) => m.is_eligible);

    if (eligibleModels.length === 0) {
      return {
        hasUpdate: false,
        currentVersion,
        remoteModel: null,
        message: 'Your detector is up to date.',
      };
    }

    // Best eligible model: the live model first, then the newest approved one
    const bestModel = eligibleModels[0];

    // If best model is newer or different from active version
    if (bestModel.version !== currentVersion) {
      return {
        hasUpdate: true,
        currentVersion,
        remoteModel: bestModel,
        message: `New model available: ${bestModel.version}`,
      };
    }

    return {
      hasUpdate: false,
      currentVersion,
      remoteModel: bestModel,
      message: `Your model (${currentVersion}) is up to date.`,
    };
  } catch (err) {
    return {
      hasUpdate: false,
      currentVersion,
      remoteModel: null,
      message: err instanceof Error ? err.message : 'Error checking for model update.',
    };
  }
}
