'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';
import { computeFileSha256 } from '@/lib/crypto';
import {
  RefreshCw,
  CheckCircle2,
  RotateCcw,
  Upload,
  FileCode,
  Cpu,
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ModelVersion {
  id: string;
  version: string;
  role: string;
  status: string;
  sha256: string;
  size_bytes: number;
  storage_path: string;
  rollout_percent: number;
  created_at: string;
  manifest?: {
    accuracy_map50?: number;
    latency_ms?: number;
    community_images?: number | null;
    base_images?: number | null;
    trained_at?: string;
  };
}

const LABELS = ['metal', 'trash', 'glass', 'paper', 'cardboard', 'plastic', 'biological'];
const pct = (n: number) => (n * 100).toFixed(2);
const ACCURACY_THRESHOLD = 0.65; // 65% mAP threshold for green recommendation

export default function ModelsPage() {
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [useConfirmModal, setUseConfirmModal] = useState<{
    visible: boolean;
    model: ModelVersion | null;
  }>({ visible: false, model: null });

  const [newVersion, setNewVersion] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [newSizeMb, setNewSizeMb] = useState('');
  const [newAccuracy, setNewAccuracy] = useState('');
  const [newSha256, setNewSha256] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ModelVersion | null>(null);

  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('model_versions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setModels((data as ModelVersion[]) || []);
    } catch (err) {
      console.warn('Failed to load models:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  const activeModel =
    models.find((m) => m.role === 'champion') || models.find((m) => m.version === 'v0');

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setNewFileName(file.name);
      setNewSizeMb((file.size / (1024 * 1024)).toFixed(1));

      try {
        const hash = await computeFileSha256(file);
        setNewSha256(hash);
      } catch (err) {
        console.warn('Hash error:', err);
      }
    }
  }

  // Set selected model as active live model
  async function handleActivateModel() {
    if (!useConfirmModal.model) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_approve_model_version', {
        p_version: useConfirmModal.model.version,
        p_rollout_percent: 100,
      });

      if (error) throw error;

      setNotice(
        `Model ${useConfirmModal.model.version.toUpperCase()} is now live. Phones are offered the update when users open the app, or when they tap Check Updates.`
      );
      setUseConfirmModal({ visible: false, model: null });
      await loadModels();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setSaving(false);
    }
  }

  // Rollback to bundled baseline v0
  async function handleResetToBaseModel() {
    if (!confirm('Revert mobile app back to the built-in Base Model (v0)?')) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_rollback_model_version', {
        p_version: activeModel?.version ?? 'v1',
        p_reason: 'Admin reverted back to base model v0',
      });

      if (error) throw error;
      setNotice('Active model switched back to built-in Base Model (v0).');
      await loadModels();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setSaving(false);
    }
  }

  // Delete a rejected model (never the live model or the bundled baseline; the database enforces it too)
  async function handleDeleteModel() {
    if (!deleteConfirm) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('admin_delete_model_version', {
        p_version: deleteConfirm.version,
      });
      if (error) throw error;

      const path = (data as { storage_path?: string } | null)?.storage_path;
      if (path) {
        // Best effort: the row is already gone, so a leftover file is harmless.
        await supabase.storage.from('models').remove([path]);
      }
      setNotice(`Model ${deleteConfirm.version.toUpperCase()} deleted.`);
      setDeleteConfirm(null);
      await loadModels();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleRegisterManualModel(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!newVersion.trim() || !newFileName.trim()) return;
    const tag = newVersion.trim().toLowerCase();
    if (!/^v\d+$/.test(tag)) {
      setFormError('Version must look like v1, v2, v3.');
      return;
    }
    if (models.some((m) => m.version.toLowerCase() === tag)) {
      setFormError(`${tag.toUpperCase()} already exists. Choose the next version number.`);
      return;
    }
    if (!selectedFile) {
      setFormError('Choose the .tflite file to upload.');
      return;
    }
    {
      const head = new Uint8Array(await selectedFile.slice(0, 8).arrayBuffer());
      const magic = String.fromCharCode(...head.slice(4, 8));
      if (magic !== 'TFL3') {
        setFormError('This file is not a TensorFlow Lite model (.tflite).');
        return;
      }
    }
    if (!newSha256) {
      setFormError('The file checksum is still being calculated. Try again in a moment.');
      return;
    }
    setSaving(true);
    try {
      const versionTag = newVersion.trim().toLowerCase();
      const fileName = newFileName.trim();
      const storagePath = `${versionTag}/${fileName}`;
      const bytes = selectedFile
        ? selectedFile.size
        : Math.round(parseFloat(newSizeMb || '12.7') * 1024 * 1024);

      if (selectedFile) {
        const { error: uploadErr } = await supabase.storage
          .from('models')
          .upload(storagePath, selectedFile, { upsert: true });

        if (uploadErr) throw uploadErr;
      }
      const accTyped = parseFloat(newAccuracy);
      const accMap = Number.isFinite(accTyped) && accTyped > 0 && accTyped <= 100 ? accTyped / 100 : null;

      const { error: insertErr } = await supabase.from('model_versions').upsert(
        {
          version: versionTag,
          role: 'candidate',
          status: 'approved',
          sha256: newSha256 || 'manual-hash',
          size_bytes: bytes,
          storage_path: storagePath,
          rollout_percent: 0,
          min_app_version: '1.0.0',
          manifest: {
            version: versionTag,
            file: fileName,
            labels: LABELS,
            input: { width: 384, height: 384, resize: 'centre_crop' },
            ...(accMap != null ? { accuracy_map50: accMap } : {}),
          },
        },
        { onConflict: 'version' }
      );

      if (insertErr) throw insertErr;

      setNotice(`Model ${versionTag.toUpperCase()} uploaded successfully! Press Use to make it live.`);
      setAddModal(false);
      setNewVersion('');
      setNewFileName('');
      setNewSizeMb('');
      setSelectedFile(null);
      await loadModels();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  }

  function formatBytes(bytes: number): string {
    if (!bytes) return '12.7 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  const liveVersion = activeModel?.version || 'v0';
  const liveAcc = activeModel?.manifest?.accuracy_map50 ?? (liveVersion === 'v0' ? 0.72 : 0.78);

  return (
    <AdminShell>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-black text-[#183e48] tracking-tight">Models</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadModels()}
            disabled={loading}
            aria-label="Refresh"
            className="h-9 w-9 p-0 rounded-xl bg-white border-border/80"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-primary' : 'text-primary'} />
          </Button>
          <Button
            size="sm"
            onClick={() => { setFormError(null); setAddModal(true); }}
            className="h-9 px-4 rounded-xl font-bold text-xs gap-2 bg-primary hover:bg-primary-dark text-white"
          >
            <Upload size={13} />
            Upload
          </Button>
        </div>
      </div>

      {notice && (
        <button
          onClick={() => setNotice(null)}
          className="w-full text-left mb-4 px-4 py-3 rounded-2xl border border-primary/20 bg-primary/10 text-primary text-xs font-bold flex items-center gap-2"
        >
          <CheckCircle2 size={15} />
          {notice}
        </button>
      )}

      {/* Live model */}
      <div className="rounded-3xl overflow-hidden bg-primary shadow-md shadow-primary/25 relative mb-7">
        <div
          style={{
            position: 'absolute',
            right: -25,
            top: -25,
            width: 130,
            height: 130,
            borderRadius: 65,
            backgroundColor: 'rgba(255,255,255,0.08)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 45,
            bottom: -35,
            width: 110,
            height: 110,
            borderRadius: 55,
            backgroundColor: 'rgba(255,255,255,0.05)',
          }}
        />
        <div className="relative p-5 flex items-center gap-4">
          <div
            style={{ backgroundColor: '#359d8a' }}
            className="h-14 w-14 rounded-2xl flex items-center justify-center border border-white/20 shrink-0"
          >
            <Cpu size={26} color="#ffffff" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-white/80">Live</div>
            <div className="text-2xl font-black text-white tracking-tight uppercase leading-tight">
              {liveVersion}
            </div>
            <div className="text-xs font-medium text-white/80 mt-0.5">
              {activeModel?.manifest?.accuracy_map50 != null ? `${pct(liveAcc)}% mAP` : 'Accuracy not recorded'} · {formatBytes(activeModel?.size_bytes || 0)}
            </div>
          </div>
          {liveVersion !== 'v0' && (
            <button
              onClick={() => void handleResetToBaseModel()}
              disabled={saving}
              aria-label="Reset to base model"
              title="Reset to base model"
              style={{ backgroundColor: '#359d8a' }}
              className="h-10 w-10 rounded-full flex items-center justify-center border border-white/20 shrink-0 disabled:opacity-50"
            >
              <RotateCcw size={16} color="#ffffff" />
            </button>
          )}
        </div>
      </div>

      {/* Versions */}
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        Versions
      </h2>

      <div className="space-y-2.5">
        {models.map((model) => {
          const isBase = model.version === 'v0';
          const isLive =
            model.role === 'champion' || (isBase && activeModel?.version === 'v0');
          const acc = model.manifest?.accuracy_map50 ?? (isBase ? 0.72 : 0.78);
          const good = acc >= ACCURACY_THRESHOLD;

          return (
            <Card
              key={model.id}
              className="p-3.5 rounded-3xl bg-white border border-border/80 shadow-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`h-11 w-11 rounded-2xl border flex items-center justify-center shrink-0 ${
                    good
                      ? 'bg-primary/10 border-primary/20'
                      : 'bg-amber-500/10 border-amber-500/25'
                  }`}
                >
                  <Cpu size={19} color={good ? '#19806d' : '#b45309'} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-[#183e48] tracking-tight uppercase">
                    {model.version}
                    {isBase && (
                      <span className="ml-2 text-[10px] font-bold normal-case text-muted-foreground">
                        Base
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground mt-0.5 truncate">
                    {model.manifest?.accuracy_map50 != null ? `${pct(acc)}% mAP` : 'Accuracy not recorded'} · {formatBytes(model.size_bytes)} ·{' '}
                    {new Date(model.created_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  {!isLive && !isBase && model.manifest?.accuracy_map50 != null && (
                    <div className="text-[11px] font-medium text-muted-foreground mt-0.5 truncate">
                      <span
                        className={
                          acc - liveAcc > 0.00005
                            ? 'text-emerald-700 font-bold'
                            : acc - liveAcc < -0.00005
                              ? 'text-rose-700 font-bold'
                              : ''
                        }
                      >
                        {acc - liveAcc >= 0 ? '+' : ''}
                        {((acc - liveAcc) * 100).toFixed(2)} pts vs live
                      </span>
                      {model.manifest?.community_images != null && (
                        <> · {model.manifest.community_images} community images</>
                      )}
                    </div>
                  )}
                  {isLive && model.manifest?.community_images != null && (
                    <div className="text-[11px] font-medium text-muted-foreground mt-0.5 truncate">
                      {model.manifest.community_images} community images
                    </div>
                  )}
                </div>
              </div>

              {isLive ? (
                <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-black text-primary shrink-0 ml-3">
                  Live
                </span>
              ) : (
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {!isBase && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirm(model)}
                      aria-label={`Delete ${model.version}`}
                      className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setUseConfirmModal({ visible: true, model })}
                    className={`h-9 px-4 rounded-xl font-bold text-xs text-white ${
                      good
                        ? 'bg-primary hover:bg-primary-dark'
                        : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    Use
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Delete model */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-sm w-full p-6 bg-white shadow-2xl rounded-3xl text-center">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-700 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} />
            </div>
            <h3 className="text-xl font-black text-[#183e48] tracking-tight mb-5">
              Delete {deleteConfirm.version.toUpperCase()}?
            </h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirm(null)}
                disabled={saving}
                className="flex-1 h-10 rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleDeleteModel()}
                disabled={saving}
                className="flex-1 h-10 rounded-xl font-bold text-xs"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Switch model */}
      {useConfirmModal.visible && useConfirmModal.model && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-sm w-full p-6 bg-white shadow-2xl rounded-3xl text-center">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-4">
              <Cpu size={22} />
            </div>
            <h3 className="text-xl font-black text-[#183e48] tracking-tight mb-5">
              Go live with {useConfirmModal.model.version.toUpperCase()}?
            </h3>
            {(useConfirmModal.model.manifest?.accuracy_map50 ?? 0.78) < ACCURACY_THRESHOLD && (
              <p className="text-xs font-bold text-amber-700 -mt-3 mb-5">
                Below the {Math.round(ACCURACY_THRESHOLD * 100)}% quality gate
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUseConfirmModal({ visible: false, model: null })}
                disabled={saving}
                className="flex-1 h-10 rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void handleActivateModel()}
                disabled={saving}
                className="flex-1 h-10 rounded-xl font-bold text-xs bg-primary hover:bg-primary-dark text-white"
              >
                {saving
                  ? 'Switching...'
                  : (useConfirmModal.model.manifest?.accuracy_map50 ?? 0.78) < ACCURACY_THRESHOLD
                    ? 'Go live anyway'
                    : 'Confirm'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Upload */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-sm w-full p-6 bg-white shadow-2xl rounded-3xl">
            <h3 className="text-xl font-black text-[#183e48] tracking-tight mb-4">Upload</h3>

            <form onSubmit={handleRegisterManualModel} className="space-y-3">
              {formError && (
                <p className="text-xs font-bold text-destructive" role="alert">
                  {formError}
                </p>
              )}
              <div className="border border-dashed border-border rounded-2xl p-4 text-center bg-secondary/30 hover:bg-secondary/40 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".tflite"
                  onChange={handleFileSelect}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center gap-1.5">
                  <FileCode size={20} className="text-primary" />
                  <span className="text-xs font-bold text-[#183e48]">
                    {selectedFile ? selectedFile.name : '.tflite file'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Input
                  required
                  placeholder="Version (v1)"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  className="rounded-xl"
                />
                <Input
                  type="number"
                  placeholder="mAP % (optional)"
                  value={newAccuracy}
                  onChange={(e) => setNewAccuracy(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <Input
                required
                placeholder="File name"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="rounded-xl"
              />

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddModal(false)}
                  disabled={saving}
                  className="flex-1 h-10 rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-10 rounded-xl font-bold text-xs bg-primary hover:bg-primary-dark text-white"
                >
                  {saving ? 'Uploading...' : 'Save'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
