'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Cylinder,
  Download,
  ExternalLink,
  FileText,
  Leaf,
  Loader2,
  Milk,
  Package,
  Play,
  RefreshCw,
  Trash2,
  Wine,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const WASTE_CLASSES = [
  { id: 'plastic', label: 'Plastic', icon: Milk },
  { id: 'cardboard', label: 'Cardboard', icon: Package },
  { id: 'paper', label: 'Paper', icon: FileText },
  { id: 'glass', label: 'Glass', icon: Wine },
  { id: 'metal', label: 'Metal', icon: Cylinder },
  { id: 'trash', label: 'Trash', icon: Trash2 },
  { id: 'biological', label: 'Biological', icon: Leaf },
];

interface PendingReviewItem {
  id: string;
  scan_id: string;
  feedback_type: string;
  original_model_label: string;
  corrected_app_class: string | null;
  created_at: string;
  selected_class: string;
  image_url: string | null;
  scans?: {
    image_path: string | null;
    image_width: number;
    image_height: number;
  } | null;
}

interface ReadySampleItem {
  id: string;
  image_path: string | null;
  image_url?: string | null;
  created_at: string;
  labels: string[];
}

interface RetrainJob {
  version: string;
  startedAt: number;
  endedAt?: number;
}

type JobPhase = 'idle' | 'queued' | 'training' | 'done' | 'failed';

const JOB_KEY = 'snappick.retrain.job';
const POLL_MS = 15000;
const JOB_TIMEOUT_MS = 120 * 60 * 1000;

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function DatasetRetrainingPage() {
  const [loading, setLoading] = useState(true);
  const [readyCount, setReadyCount] = useState<number>(0);
  // Verified images added since the latest trained model, so the admin knows when retraining is worthwhile.
  const [sinceLast, setSinceLast] = useState<{ version: string; count: number } | null>(null);
  const [pendingReviews, setPendingReviews] = useState<PendingReviewItem[]>([]);
  const [readySamples, setReadySamples] = useState<ReadySampleItem[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'ready'>('pending');
  const [notice, setNotice] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [retrainBusy, setRetrainBusy] = useState(false);
  const [job, setJob] = useState<RetrainJob | null>(null);
  const [jobStatus, setJobStatus] = useState<{
    state: string;
    modelReady: boolean;
    detail: string | null;
    kernelUrl?: string | null;
  }>({ state: 'unknown', modelReady: false, detail: null });
  const [showJob, setShowJob] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const BUCKET_TARGET = 50;

  // Restore an in-progress run after refresh
  useEffect(() => {
    try {
      const raw = localStorage.getItem(JOB_KEY);
      if (raw) {
        setJob(JSON.parse(raw) as RetrainJob);
        setShowJob(true);
      }
    } catch {
      // storage unavailable
    }
  }, []);

  const persistJob = useCallback((next: RetrainJob | null) => {
    setJob(next);
    try {
      if (next) localStorage.setItem(JOB_KEY, JSON.stringify(next));
      else localStorage.removeItem(JOB_KEY);
    } catch {
      // storage unavailable
    }
  }, []);

  const elapsedMs = job ? (job.endedAt ?? now) - job.startedAt : 0;
  const phase: JobPhase = !job
    ? 'idle'
    : jobStatus.modelReady
      ? 'done'
      : jobStatus.state === 'failed'
        ? 'failed'
        : jobStatus.state === 'complete'
          ? 'failed'
          : elapsedMs > JOB_TIMEOUT_MS
            ? 'failed'
            : jobStatus.state === 'queued'
              ? 'queued'
              : 'training';
  const jobActive = phase === 'queued' || phase === 'training';
  const failReason =
    jobStatus.detail ||
    (jobStatus.state === 'complete'
      ? 'The run finished but no model was registered. Check the notebook log.'
      : elapsedMs > JOB_TIMEOUT_MS
        ? 'Timed out after 2 hours. Check the notebook on Kaggle.'
        : 'Kaggle reported an error.');

  // Freeze the timer when the run ends
  useEffect(() => {
    if (job && !job.endedAt && (phase === 'done' || phase === 'failed')) {
      persistJob({ ...job, endedAt: Date.now() });
    }
  }, [phase, job, persistJob]);

  // Tick every second while running
  useEffect(() => {
    if (!jobActive) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [jobActive]);

  // Poll status while running
  useEffect(() => {
    if (!job || !jobActive) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/retrain/status?version=${job.version}&since=${job.startedAt}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setJobStatus(data);
      } catch {
        // keep last known status
      }
    };
    void poll();
    const t = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [job, jobActive]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch consented scans
      const { data: scans } = await supabase
        .from('scans')
        .select('id, image_path, created_at')
        .eq('image_storage_consent', true)
        .eq('training_opt_in', true)
        .not('image_path', 'is', null)
        .order('created_at', { ascending: false });

      const scanList = scans || [];
      const scanIds = scanList.map((s) => s.id);

      // 2. Fetch feedback (corrections)
      const { data: feedback } = await supabase
        .from('label_feedback')
        .select(`
          id,
          scan_id,
          feedback_type,
          original_model_label,
          corrected_app_class,
          collector_verified_at,
          created_at,
          scans (
            image_path,
            image_width,
            image_height
          )
        `)
        .order('created_at', { ascending: false });

      const allFeedback = feedback || [];

      // Detections
      const detectionMap: Record<string, string[]> = {};
      if (scanIds.length > 0) {
        const { data: detections } = await supabase
          .from('detections')
          .select('scan_id, app_class, model_label')
          .in('scan_id', scanIds);

        (detections || []).forEach((d) => {
          const arr = detectionMap[d.scan_id] || [];
          arr.push(d.app_class || d.model_label);
          detectionMap[d.scan_id] = arr;
        });
      }

      // Filter unverified items: user edited/removed label and admin hasn't confirmed yet
      const unverified = allFeedback.filter(
        (f) =>
          (f.feedback_type === 'change_label' || f.feedback_type === 'remove') &&
          !f.collector_verified_at
      );

      // Generate signed image URLs for unverified items
      const enrichedPending: PendingReviewItem[] = [];
      for (const item of unverified) {
        let signedUrl: string | null = null;
        const imgPath = (item.scans as unknown as { image_path: string | null } | null)?.image_path;
        if (imgPath) {
          try {
            const { data: signed } = await supabase.storage.from('scans').createSignedUrl(imgPath, 3600);
            signedUrl = signed?.signedUrl ?? null;
          } catch {
            // ignore signed URL error
          }
        }

        enrichedPending.push({
          id: item.id,
          scan_id: item.scan_id,
          feedback_type: item.feedback_type,
          original_model_label: item.original_model_label,
          corrected_app_class: item.corrected_app_class,
          created_at: item.created_at,
          // For a removal nothing is selected: the default action is "Keep removed".
          selected_class:
            item.feedback_type === 'remove'
              ? ''
              : item.corrected_app_class || item.original_model_label || 'plastic',
          image_url: signedUrl,
          scans: item.scans as unknown as {
            image_path: string | null;
            image_width: number;
            image_height: number;
          } | null,
        });
      }

      setPendingReviews(enrichedPending);

      // Scans ready for training: consented, and no pending unverified edits!
      const unverifiedScanIdSet = new Set(unverified.map((u) => u.scan_id));
      const readyScans = scanList.filter((s) => !unverifiedScanIdSet.has(s.id));

      setReadyCount(readyScans.length);

      const { data: lastModel } = await supabase
        .from('model_versions')
        .select('version, created_at')
        .neq('version', 'v0')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastModel) {
        const trainedAt = new Date(lastModel.created_at).getTime();
        setSinceLast({
          version: String(lastModel.version),
          count: readyScans.filter((s) => new Date(s.created_at).getTime() > trainedAt).length,
        });
      } else {
        setSinceLast(null);
      }
      setReadySamples(
        readyScans.map((s) => ({
          id: s.id,
          image_path: s.image_path,
          created_at: s.created_at,
          labels: detectionMap[s.id] || ['clean_item'],
        }))
      );
    } catch (err) {
      console.warn('Failed to load dataset data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle label selection for a pending review item (admin tweak)
  function handleSelectMaterial(itemId: string, materialId: string) {
    setPendingReviews((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, selected_class: materialId } : item))
    );
  }

  // Admin approves / confirms the edited label -> moves to ready dataset
  async function handleConfirmLabel(item: PendingReviewItem) {
    setActionBusy(item.id);
    setNotice(null);
    try {
      const isRemoval = item.feedback_type === 'remove';
      const restoreClass = item.selected_class;

      // A removal stays a removal ("Keep removed") unless the admin picks a class to restore it as.
      const patch =
        isRemoval && !restoreClass
          ? { collector_verified_at: new Date().toISOString() }
          : {
              corrected_app_class: restoreClass,
              feedback_type: 'change_label',
              collector_verified_at: new Date().toISOString(),
            };

      const { error } = await supabase.from('label_feedback').update(patch).eq('id', item.id);

      if (error) throw error;

      setNotice(
        isRemoval && !restoreClass
          ? 'Removal kept. The item will not be used for training.'
          : `Label verified as '${restoreClass}'. Added to Ready Dataset!`
      );
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setActionBusy(null);
    }
  }

  // Admin discards an incorrect user edit
  async function handleDiscardItem(item: PendingReviewItem) {
    setActionBusy(item.id);
    try {
      const { error } = await supabase
        .from('label_feedback')
        .update({
          collector_verified_at: new Date().toISOString(),
          feedback_type: 'discarded',
        })
        .eq('id', item.id);

      if (error) throw error;
      setNotice('User edit discarded.');
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Discard failed');
    } finally {
      setActionBusy(null);
    }
  }

  // Admin 1-Click Retrain Trigger
  async function handleStartRetraining() {
    setRetrainBusy(true);
    setNotice(null);

    try {
      const res = await fetch('/api/retrain/trigger', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start retraining');
      }

      setJobStatus({ state: 'queued', modelReady: false, detail: null });
      setNow(Date.now());
      persistJob({ version: data.target_version, startedAt: Date.now() });
      setShowJob(true);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Retraining trigger failed');
    } finally {
      setRetrainBusy(false);
    }
  }

  const progress = Math.min(100, Math.round((readyCount / BUCKET_TARGET) * 100));

  const tabs = [
    { id: 'pending' as const, label: 'Review', count: pendingReviews.length },
    { id: 'ready' as const, label: 'Ready', count: readyCount },
  ];

  return (
    <AdminShell>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-black text-[#183e48] tracking-tight">Dataset</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={loading}
            aria-label="Refresh"
            className="h-9 w-9 p-0 rounded-xl bg-white border-border/80"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-primary' : 'text-primary'} />
          </Button>
          <a href="/api/retrain/export" download="snappick-dataset-bundle.json" aria-label="Export">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 rounded-xl bg-white border-border/80"
              tabIndex={-1}
            >
              <Download size={14} className="text-primary" />
            </Button>
          </a>
          <Button
            size="sm"
            onClick={handleStartRetraining}
            disabled={retrainBusy || jobActive}
            className="h-9 px-4 rounded-xl font-bold text-xs gap-2 bg-primary hover:bg-primary-dark text-white"
          >
            {retrainBusy || jobActive ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Play size={13} fill="currentColor" />
            )}
            Retrain
          </Button>
        </div>
      </div>

      {job && !showJob && (
        <button
          onClick={() => setShowJob(true)}
          className="w-full text-left mb-4 px-4 py-3 rounded-2xl border border-primary/20 bg-primary/10 text-primary text-xs font-bold flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            {jobActive ? (
              <Loader2 size={15} className="animate-spin" />
            ) : phase === 'done' ? (
              <CheckCircle2 size={15} />
            ) : (
              <AlertTriangle size={15} />
            )}
            {phase === 'done'
              ? `${job.version.toUpperCase()} ready`
              : phase === 'failed'
                ? `${job.version.toUpperCase()} failed`
                : `Training ${job.version.toUpperCase()}`}
          </span>
          <span className="font-mono tabular-nums">{formatElapsed(elapsedMs)}</span>
        </button>
      )}

      {notice && (
        <button
          onClick={() => setNotice(null)}
          className="w-full text-left mb-4 px-4 py-3 rounded-2xl border border-primary/20 bg-primary/10 text-primary text-xs font-bold flex items-center gap-2"
        >
          <CheckCircle2 size={15} />
          {notice}
        </button>
      )}

      {/* Progress */}
      <Card className="p-5 rounded-3xl bg-white border border-border/80 shadow-xs mb-6">
        <div className="flex items-end justify-between mb-3">
          <div className="text-2xl font-black text-[#183e48] tracking-tight">
            {readyCount}
            <span className="text-muted-foreground font-bold text-base"> / {BUCKET_TARGET}</span>
          </div>
          {sinceLast && (
            <div className="text-xs font-bold text-muted-foreground mb-0.5">
              {sinceLast.count} new since {sinceLast.version.toUpperCase()}
            </div>
          )}
        </div>
        <div className="w-full h-2.5 rounded-full bg-[#e8efe9] overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </Card>

      {/* Tabs */}
      <div className="inline-flex p-1 rounded-2xl bg-[#e8efe9] mb-5 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-[#183e48] shadow-xs'
                : 'text-muted-foreground hover:text-[#183e48]'
            }`}
          >
            {tab.label}
            <span
              className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] flex items-center justify-center ${
                tab.id === 'pending' && tab.count > 0
                  ? 'bg-amber-500/15 text-amber-700'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Review */}
      {activeTab === 'pending' &&
        (pendingReviews.length === 0 ? (
          <Card className="p-4 rounded-3xl border border-dashed border-border/80 bg-white/60 flex items-center justify-center">
            <span className="text-xs font-medium text-muted-foreground">Nothing to review</span>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {pendingReviews.map((item) => (
              <Card
                key={item.id}
                className="p-4 rounded-3xl bg-white border border-border/80 shadow-xs"
              >
                <div className="flex gap-4 mb-4">
                  <div className="h-24 w-24 rounded-2xl bg-secondary/60 border border-border/80 shrink-0 overflow-hidden flex items-center justify-center">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt="Scan" className="h-full w-full object-cover" />
                    ) : (
                      <Camera size={20} className="text-[#8a9ea0]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                    <span className="text-xs font-medium text-muted-foreground line-through capitalize">
                      {item.original_model_label || 'Unknown'}
                    </span>
                    <span className="text-lg font-black text-[#183e48] tracking-tight capitalize">
                      {item.corrected_app_class || 'Removed'}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {WASTE_CLASSES.map((mat) => {
                    const selected = item.selected_class.toLowerCase() === mat.id;
                    return (
                      <button
                        key={mat.id}
                        type="button"
                        onClick={() => handleSelectMaterial(item.id, mat.id)}
                        className={`h-8 px-3 rounded-full text-[11px] font-bold border transition-colors ${
                          selected
                            ? 'bg-primary text-white border-primary'
                            : 'bg-secondary/40 text-foreground border-border/60 hover:bg-secondary/80'
                        }`}
                      >
                        {mat.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDiscardItem(item)}
                    disabled={actionBusy === item.id}
                    aria-label="Discard"
                    className="h-10 w-10 p-0 rounded-xl text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={15} />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleConfirmLabel(item)}
                    disabled={actionBusy === item.id}
                    className="flex-1 h-10 rounded-xl font-bold text-xs gap-1.5 bg-primary hover:bg-primary-dark text-white"
                  >
                    <Check size={14} />
                    {item.feedback_type === 'remove'
                      ? item.selected_class
                        ? `Restore as ${item.selected_class}`
                        : 'Keep removed'
                      : 'Confirm'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ))}

      {/* Ready */}
      {activeTab === 'ready' &&
        (readySamples.length === 0 ? (
          <Card className="p-4 rounded-3xl border border-dashed border-border/80 bg-white/60 flex items-center justify-center">
            <span className="text-xs font-medium text-muted-foreground">No images yet</span>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {readySamples.map((sample) => (
              <Card
                key={sample.id}
                className="p-3.5 rounded-3xl bg-white border border-border/80 shadow-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Camera size={19} color="#19806d" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-[#183e48] tracking-tight truncate">
                      {sample.image_path?.split('/').pop() || sample.id.slice(0, 8)}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground mt-0.5 capitalize truncate">
                      {[...new Set(sample.labels)].join(', ')}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-medium text-muted-foreground shrink-0 ml-3">
                  {new Date(sample.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </Card>
            ))}
          </div>
        ))}

      {/* Retrain started */}
      {job && showJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-sm w-full p-6 bg-white shadow-2xl rounded-3xl text-center">
            <div
              className={`h-12 w-12 rounded-2xl border flex items-center justify-center mx-auto mb-4 ${
                phase === 'failed'
                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-700'
                  : 'bg-primary/10 border-primary/20 text-primary'
              }`}
            >
              {jobActive ? (
                <Loader2 size={22} className="animate-spin" />
              ) : phase === 'done' ? (
                <Check size={22} />
              ) : (
                <AlertTriangle size={22} />
              )}
            </div>
            <h3 className="text-xl font-black text-[#183e48] tracking-tight">
              {phase === 'done'
                ? `${job.version.toUpperCase()} ready`
                : phase === 'failed'
                  ? `${job.version.toUpperCase()} failed`
                  : `Training ${job.version.toUpperCase()}`}
            </h3>
            <div className="text-4xl font-black text-[#183e48] tracking-tight font-mono tabular-nums mt-3">
              {formatElapsed(elapsedMs)}
            </div>
            <p className="text-xs font-medium text-muted-foreground mt-2 mb-5">
              {phase === 'queued'
                ? 'Queued on Kaggle'
                : phase === 'training'
                  ? 'Can take 30–60 minutes'
                  : phase === 'done'
                    ? 'Registered in Models'
                    : failReason}
            </p>
            {jobActive && (
              <div className="w-full h-2 rounded-full bg-[#e8efe9] overflow-hidden mb-5">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-1000"
                  style={{ width: `${Math.min(95, (elapsedMs / (45 * 60 * 1000)) * 100)}%` }}
                />
              </div>
            )}
            <div className="flex gap-2">
              <a
                href={jobStatus.kernelUrl || 'https://www.kaggle.com/code'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-10 rounded-xl text-xs font-bold gap-1.5"
                >
                  <ExternalLink size={13} />
                  Kaggle
                </Button>
              </a>
              {phase === 'done' && (
                <Link href="/models" className="flex-1">
                  <Button
                    size="sm"
                    className="w-full h-10 rounded-xl font-bold text-xs bg-primary hover:bg-primary-dark text-white"
                  >
                    Models
                  </Button>
                </Link>
              )}
              <Button
                size="sm"
                variant={phase === 'done' ? 'outline' : 'default'}
                onClick={() => {
                  setShowJob(false);
                  if (!jobActive) persistJob(null);
                }}
                className={`flex-1 h-10 rounded-xl font-bold text-xs ${
                  phase === 'done' ? '' : 'bg-primary hover:bg-primary-dark text-white'
                }`}
              >
                {jobActive ? 'Hide' : 'Close'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
