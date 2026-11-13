import { describe, it, expect, vi, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getActiveModelVersion,
  setActiveModelVersion,
  rollbackToBundledFallback,
  checkForModelUpdate,
  getActiveModelConfig,
  activateRemoteModel,
  BUNDLED_FALLBACK_VERSION,
} from './manager';
import { supabase } from '@/lib/supabase';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('./model-files', () => ({
  downloadVerifiedModel: vi.fn().mockResolvedValue('file:///data/models/waste_detector_v1.tflite'),
  deleteDownloadedModels: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://supabase.co/models/v1.tflite' },
          error: null,
        }),
      }),
    },
  },
}));

describe('detector/manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns bundled v0 as default active model version', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);
    const version = await getActiveModelVersion();
    expect(version).toBe(BUNDLED_FALLBACK_VERSION);
  });

  it('returns stored model version when set in AsyncStorage', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce('v1');
    const version = await getActiveModelVersion();
    expect(version).toBe('v1');
  });

  it('sets active model version in AsyncStorage', async () => {
    await setActiveModelVersion('v2');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('snappick_active_model_version', 'v2');
  });

  it('rolls back to bundled fallback v0', async () => {
    await rollbackToBundledFallback();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('snappick_active_model_version', 'v0');
  });

  it('detects update available when eligible model version differs from active version', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce('v0');
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [
        {
          version: 'v1',
          role: 'champion',
          status: 'stable',
          sha256: 'abc123',
          size_bytes: 12000000,
          storage_path: 'models/v1/model.tflite',
          thresholds: {},
          min_app_version: '1.0.0',
          rollout_percent: 100,
          user_bucket: 10,
          is_eligible: true,
        },
      ],
      error: null,
    } as any);

    const result = await checkForModelUpdate('user-123');
    expect(result.hasUpdate).toBe(true);
    expect(result.currentVersion).toBe('v0');
    expect(result.remoteModel?.version).toBe('v1');
  });

  it('reports up to date when current version matches remote version', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce('v1');
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [
        {
          version: 'v1',
          role: 'champion',
          status: 'stable',
          sha256: 'abc123',
          size_bytes: 12000000,
          storage_path: 'models/v1/model.tflite',
          thresholds: {},
          min_app_version: '1.0.0',
          rollout_percent: 100,
          user_bucket: 10,
          is_eligible: true,
        },
      ],
      error: null,
    } as any);

    const result = await checkForModelUpdate('user-123');
    expect(result.hasUpdate).toBe(false);
    expect(result.currentVersion).toBe('v1');
  });

  it('activates remote model and stores config', async () => {
    const success = await activateRemoteModel({
      version: 'v1',
      role: 'champion',
      status: 'stable',
      sha256: 'abc123',
      size_bytes: 12000000,
      storage_path: 'models/v1/waste_detector_v1.tflite',
      thresholds: {},
      min_app_version: '1.0.0',
      rollout_percent: 100,
      user_bucket: 10,
      is_eligible: true,
    });

    expect(success).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('snappick_active_model_version', 'v1');
    const stored = vi.mocked(AsyncStorage.setItem).mock.calls.find(([k]) => k === 'snappick_active_model_config');
    expect(JSON.parse(String(stored?.[1])).localUri).toBe('file:///data/models/waste_detector_v1.tflite');
  });

  it('keeps the current detector when the download or checksum fails', async () => {
    const files = await import('./model-files');
    vi.mocked(files.downloadVerifiedModel).mockRejectedValueOnce(new Error('does not match its checksum'));
    const success = await activateRemoteModel({
      version: 'v2', role: 'champion', status: 'stable', sha256: 'bad', size_bytes: 1, storage_path: 'models/v2.tflite',
      thresholds: {}, min_app_version: '1.0.0', rollout_percent: 100, user_bucket: 10, is_eligible: true,
    });
    expect(success).toBe(false);
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('snappick_active_model_version', 'v2');
  });

  it('retrieves active model config from AsyncStorage', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(
      JSON.stringify({ version: 'v1', url: 'https://test.url' })
    );
    const config = await getActiveModelConfig();
    expect(config?.version).toBe('v1');
    expect(config?.url).toBe('https://test.url');
  });
});

