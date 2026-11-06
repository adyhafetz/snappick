'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';
import {
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Image as ImageIcon,
  Inbox,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MaterialSummaryItem {
  class?: string;
  quantity?: number;
}

interface DisputeItem {
  id: string;
  request_id: string;
  reason: string;
  supporting_context: string | null;
  outcome: 'upheld' | 'rejected' | 'inconclusive' | null;
  resolution_note: string | null;
  created_at: string;
  pickup_requests_public?: {
    status: string;
    material_summary: MaterialSummaryItem[];
  } | null;
  proof_path?: string | null;
  proof_url?: string | null;
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ open: 0, resolved: 0 });
  const [filter, setFilter] = useState<'open' | 'resolved'>('open');
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null);
  const [loadingModalProof, setLoadingModalProof] = useState(false);
  const [modalProofUrl, setModalProofUrl] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('disputes')
        .select('*, pickup_requests_public(status, material_summary)')
        .order('created_at', { ascending: false });

      if (filter === 'open') {
        query = query.is('outcome', null);
      } else {
        query = query.not('outcome', 'is', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rawItems = (data as unknown as DisputeItem[]) || [];

      // Query proof storage paths in a single batch query without generating signed URLs yet (saves N requests)
      const requestIds = rawItems.map((d) => d.request_id);
      let proofMap: Record<string, string> = {};

      if (requestIds.length > 0) {
        const { data: proofs } = await supabase
          .from('pickup_proofs')
          .select('request_id, storage_path')
          .in('request_id', requestIds)
          .eq('is_non_collection_evidence', false);

        if (proofs) {
          proofs.forEach((p) => {
            proofMap[p.request_id] = p.storage_path;
          });
        }
      }

      const enriched = rawItems.map((item) => ({
        ...item,
        proof_path: proofMap[item.request_id] || null,
      }));

      setDisputes(enriched);

      const [openRes, resolvedRes] = await Promise.all([
        supabase.from('disputes').select('*', { count: 'exact', head: true }).is('outcome', null),
        supabase.from('disputes').select('*', { count: 'exact', head: true }).not('outcome', 'is', null),
      ]);
      setCounts({ open: openRes.count ?? 0, resolved: resolvedRes.count ?? 0 });
    } catch (err) {
      console.warn('Failed to load disputes:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadDisputes();
  }, [loadDisputes]);

  // Load signed proof URL on-demand when opening modal
  const openAdjudicationModal = useCallback(async (dispute: DisputeItem) => {
    setSelectedDispute(dispute);
    setResolutionNote('');
    setModalProofUrl(null);

    if (dispute.proof_path) {
      setLoadingModalProof(true);
      try {
        const { data: signed } = await supabase.storage
          .from('proofs')
          .createSignedUrl(dispute.proof_path, 3600);
        if (signed?.signedUrl) {
          setModalProofUrl(signed.signedUrl);
        }
      } catch (err) {
        console.warn('Failed to generate proof signed URL:', err);
      } finally {
        setLoadingModalProof(false);
      }
    }
  }, []);

  async function handleResolve(outcome: 'upheld' | 'rejected' | 'inconclusive') {
    if (!selectedDispute) return;
    setActionBusy(true);
    setNotice(null);

    try {
      const defaultNote =
        outcome === 'upheld'
          ? 'Dispute upheld by administrator. Request marked as not collected.'
          : outcome === 'rejected'
          ? 'Dispute rejected by administrator. Collector proof verified as valid.'
          : 'Dispute closed as inconclusive.';

      const note = resolutionNote.trim() || defaultNote;
      const { error } = await supabase.rpc('resolve_dispute', {
        request_id: selectedDispute.request_id,
        outcome,
        note,
      });

      if (error) throw error;

      setNotice(
        `Dispute marked as ${outcome.toUpperCase()} (${
          outcome === 'upheld'
            ? 'Request set to not_collected'
            : outcome === 'rejected'
            ? 'Request set to completed'
            : 'Inconclusive decision recorded'
        }).`
      );
      setSelectedDispute(null);
      setResolutionNote('');
      await loadDisputes();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionBusy(false);
    }
  }

  function formatMaterials(summary?: MaterialSummaryItem[] | null): string {
    if (!summary || !Array.isArray(summary) || summary.length === 0) return 'Waste materials';
    return summary
      .map((item) => `${item.quantity ?? 1} × ${item.class ?? 'item'}`)
      .join(', ');
  }

  const outcomeStyle: Record<string, { label: string; cls: string; icon: string; tint: string }> = {
    open: {
      label: 'Review',
      cls: 'bg-amber-500/10 border-amber-500/25 text-amber-700',
      icon: '#b45309',
      tint: 'bg-amber-500/10 border-amber-500/25',
    },
    upheld: {
      label: 'Upheld',
      cls: 'bg-rose-500/10 border-rose-500/25 text-rose-700',
      icon: '#b42318',
      tint: 'bg-rose-500/10 border-rose-500/25',
    },
    rejected: {
      label: 'Rejected',
      cls: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700',
      icon: '#16a34a',
      tint: 'bg-emerald-500/10 border-emerald-500/25',
    },
    inconclusive: {
      label: 'Closed',
      cls: 'bg-secondary border-border/60 text-muted-foreground',
      icon: '#5b7072',
      tint: 'bg-secondary border-border/60',
    },
  };

  const tabs = [
    { id: 'open' as const, label: 'Open', icon: Inbox },
    { id: 'resolved' as const, label: 'Resolved', icon: CheckCircle2 },
  ];

  return (
    <AdminShell>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-black text-[#183e48] tracking-tight">Disputes</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadDisputes()}
          disabled={loading}
          aria-label="Refresh"
          className="h-9 w-9 p-0 rounded-xl bg-white border-border/80"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-primary' : 'text-primary'} />
        </Button>
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

      {/* Tabs */}
      <div className="flex p-1.5 rounded-2xl bg-secondary/50 border border-border/80 mb-5 gap-1">
        {tabs.map((tab) => {
          const active = filter === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(tab.id)}
              className={`flex-1 py-2.5 flex items-center justify-center gap-2 rounded-xl border text-xs transition-colors ${
                active
                  ? 'bg-card shadow-xs border-border/60 font-bold text-foreground'
                  : 'border-transparent font-semibold text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={16} color={active ? '#19806d' : '#5b7072'} strokeWidth={active ? 2.4 : 1.8} />
              {tab.label}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                {counts[tab.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {disputes.length > 0 ? (
        <div className="space-y-2.5">
          {disputes.map((dispute) => {
            const style = outcomeStyle[dispute.outcome ?? 'open'];
            return (
              <button
                key={dispute.id}
                onClick={() => void openAdjudicationModal(dispute)}
                className="block w-full text-left"
              >
                <Card className="p-3.5 rounded-3xl bg-white border border-border/80 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`h-11 w-11 rounded-2xl border flex items-center justify-center shrink-0 ${style.tint}`}
                    >
                      <AlertTriangle size={19} color={style.icon} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-black text-[#183e48] tracking-tight truncate">
                        {dispute.reason}
                      </div>
                      <div className="text-xs font-medium text-muted-foreground mt-0.5 truncate">
                        {formatMaterials(dispute.pickup_requests_public?.material_summary)} ·{' '}
                        {new Date(dispute.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span
                      className={`px-3 py-1 rounded-full border text-xs font-black ${style.cls}`}
                    >
                      {style.label}
                    </span>
                    <ChevronRight size={15} className="text-[#8a9ea0]" />
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      ) : (
        <Card className="p-4 rounded-3xl border border-dashed border-border/80 bg-white/60 flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">No disputes</span>
        </Card>
      )}

      {/* Detail */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-md w-full p-6 bg-white shadow-2xl rounded-3xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h3 className="text-xl font-black text-[#183e48] tracking-tight">
                  {selectedDispute.reason}
                </h3>
                <p className="text-xs font-medium text-muted-foreground mt-1">
                  {formatMaterials(selectedDispute.pickup_requests_public?.material_summary)}
                </p>
              </div>
              <button
                onClick={() => setSelectedDispute(null)}
                aria-label="Close"
                className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1">
              {selectedDispute.supporting_context && (
                <p className="text-sm text-foreground">{selectedDispute.supporting_context}</p>
              )}

              {loadingModalProof ? (
                <div className="rounded-2xl border border-border p-8 flex items-center justify-center bg-muted/20">
                  <RefreshCw size={16} className="animate-spin text-primary" />
                </div>
              ) : modalProofUrl ? (
                <div className="rounded-2xl overflow-hidden border border-border bg-slate-900 flex items-center justify-center min-h-[200px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={modalProofUrl}
                    alt="Proof"
                    className="max-h-[260px] w-auto object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-6 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground bg-muted/20">
                  <ImageIcon size={15} />
                  No proof photo
                </div>
              )}

              {selectedDispute.outcome === null ? (
                <Input
                  placeholder="Note"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  className="rounded-xl"
                />
              ) : (
                selectedDispute.resolution_note && (
                  <p className="text-xs font-medium text-muted-foreground">
                    {selectedDispute.resolution_note}
                  </p>
                )
              )}
            </div>

            {selectedDispute.outcome === null && (
              <div className="pt-4 flex gap-2">
                <Button
                  variant="destructive"
                  disabled={actionBusy}
                  onClick={() => void handleResolve('upheld')}
                  className="flex-1 h-10 text-xs font-bold rounded-xl"
                >
                  Uphold
                </Button>
                <Button
                  variant="outline"
                  disabled={actionBusy}
                  onClick={() => void handleResolve('inconclusive')}
                  className="flex-1 h-10 text-xs font-bold rounded-xl"
                >
                  Close
                </Button>
                <Button
                  disabled={actionBusy}
                  onClick={() => void handleResolve('rejected')}
                  className="flex-1 h-10 text-xs font-bold rounded-xl bg-primary hover:bg-primary-dark text-white"
                >
                  Reject
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
