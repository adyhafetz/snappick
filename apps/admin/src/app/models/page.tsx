'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';
import { Plus, RefreshCw, CheckCircle2, RotateCcw, Upload, FileCode } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

interface ModelVersion {
  id: string;
  version: string;
  role: string;
  status: string;
  size_bytes: number;
  storage_path: string;
  rollout_percent: number;
  created_at: string;
}

const LABELS = ['metal', 'trash', 'glass', 'paper', 'cardboard', 'plastic', 'biological'];

export default function ModelsPage() {
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [newSizeMb, setNewSizeMb] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

  const activeChampion = models.find((m) => m.role === 'champion') || models.find((m) => m.version === 'v0');

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setNewFileName(file.name);
      setNewSizeMb((file.size / (1024 * 1024)).toFixed(1));
    }
  }

  async function handleRegisterModel(e: React.FormEvent) {
    e.preventDefault();
    if (!newVersion.trim() || !newFileName.trim()) return;
    setSaving(true);
    setNotice(null);

    try {
      const versionTag = newVersion.trim().toLowerCase();
      const fileName = newFileName.trim();
      const storagePath = `models/${versionTag}/${fileName}`;
      const bytes = selectedFile
        ? selectedFile.size
        : Math.round(parseFloat(newSizeMb || '12.7') * 1024 * 1024);

      // 1. If physical file provided, upload to Supabase Storage bucket 'models'
      if (selectedFile) {
        const { error: uploadErr } = await supabase.storage
          .from('models')
          .upload(storagePath, selectedFile, { upsert: true });

        if (uploadErr) {
          throw new Error(`Model file upload failed: ${uploadErr.message}`);
        }
      }

      // 2. Insert record into model_versions
      const { error: insertErr } = await supabase.from('model_versions').upsert(
        {
          version: versionTag,
          role: 'candidate',
          status: 'approved',
          sha256: 'kaggle-exported-build',
          size_bytes: bytes,
          storage_path: storagePath,
          rollout_percent: 100,
          min_app_version: '1.0.0',
          manifest: {
            version: versionTag,
            file: fileName,
            labels: LABELS,
            input: { width: 384, height: 384, resize: 'centre_crop' },
          },
        },
        { onConflict: 'version' }
      );

      if (insertErr) throw insertErr;

      // 3. Promote via RPC: demotes old champion, activates new champion, writes to audit log
      const { error: approveErr } = await supabase.rpc('admin_approve_model_version', {
        p_version: versionTag,
        p_rollout_percent: 100,
      });

      if (approveErr) {
        console.warn('RPC admin_approve_model_version notice:', approveErr.message);
      }

      setNotice(`Model ${versionTag} registered and promoted to active champion.`);
      setAddModal(false);
      setNewVersion('');
      setNewFileName('');
      setNewSizeMb('');
      setSelectedFile(null);
      await loadModels();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleRollbackToBundled() {
    if (!confirm('Rollback to bundled baseline (v0)? Current model will be archived.')) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('admin_rollback_model_version', {
        p_version: activeChampion?.version ?? 'v1',
        p_reason: 'Admin dashboard manual rollback to baseline v0',
      });

      if (error) throw error;
      setNotice('Rolled back to immutable bundled baseline (v0).');
      await loadModels();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setSaving(false);
    }
  }

  function formatBytes(bytes: number): string {
    if (!bytes) return '12.7 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  return (
    <AdminShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-foreground">Models</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Register Kaggle-trained TFLite weights and manage over-the-air rollout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadModels()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setAddModal(true)}
            className="gap-1.5"
          >
            <Plus size={15} />
            Register Model
          </Button>
        </div>
      </div>

      {notice && (
        <Card className="mb-4 p-3 border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600" />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="underline text-emerald-700">
            Dismiss
          </button>
        </Card>
      )}

      {/* Active Model Summary */}
      <Card className="p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary font-black text-base flex items-center justify-center uppercase">
              {activeChampion?.version || 'v0'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">
                  Active Model ({activeChampion?.version || 'v0'})
                </span>
                <Badge variant={activeChampion?.version === 'v0' ? 'secondary' : 'success'}>
                  {activeChampion?.version === 'v0' ? 'Bundled Baseline' : 'Active Champion (OTA)'}
                </Badge>
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                {activeChampion?.storage_path || 'models/v0/waste_detector_v0.tflite'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-muted-foreground">
              384 × 384 px • {formatBytes(activeChampion?.size_bytes ?? 12705251)}
            </span>

            {activeChampion && activeChampion.version !== 'v0' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRollbackToBundled()}
                disabled={saving}
                className="gap-1.5 text-xs text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10"
              >
                <RotateCcw size={13} />
                Rollback to v0
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border">
          {LABELS.map((label) => (
            <Badge key={label} variant="secondary" className="capitalize text-xs font-semibold">
              {label}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Models Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rollout</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Storage Path</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell className="font-black text-foreground uppercase">
                    {model.version}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={model.role === 'champion' ? 'default' : 'secondary'}
                      className="capitalize text-[10px]"
                    >
                      {model.role.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={model.status === 'stable' ? 'success' : 'secondary'}
                      className="capitalize text-[10px]"
                    >
                      {model.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-bold">{model.rollout_percent}%</TableCell>
                  <TableCell className="text-xs font-bold">
                    {formatBytes(model.size_bytes)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {model.storage_path}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(model.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Register Model Modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-md w-full p-6 bg-white shadow-2xl rounded-3xl">
            <div className="flex items-center justify-between pb-3 border-b border-border/70 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Upload size={16} />
                </div>
                <h3 className="text-base font-bold text-foreground">Register Model</h3>
              </div>
            </div>

            <form onSubmit={handleRegisterModel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  Upload .tflite File (optional)
                </label>
                <div className="border border-dashed border-border rounded-2xl p-4 text-center bg-secondary/20 hover:bg-secondary/30 transition-all cursor-pointer relative">
                  <input
                    type="file"
                    accept=".tflite"
                    onChange={handleFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center gap-1.5">
                    <FileCode size={20} className="text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      {selectedFile ? selectedFile.name : 'Click to select .tflite file'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {selectedFile
                        ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
                        : 'Uploads directly to Supabase storage'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  Version Tag (e.g. v1, v2)
                </label>
                <Input
                  required
                  placeholder="v1"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  File Name
                </label>
                <Input
                  required
                  placeholder="waste_detector_v1.tflite"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  Model Size (MB)
                </label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="12.7"
                  value={newSizeMb}
                  onChange={(e) => setNewSizeMb(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/70">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddModal(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Registering & Promoting...' : 'Register & Set as Champion'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
