'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';
import { RefreshCw, CheckCircle2, Image as ImageIcon, AlertTriangle, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  proof_url?: string | null;
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'resolved'>('open');
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null);
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

      // Fetch proof photos for these requests
      const requestIds = rawItems.map((d) => d.request_id);
      let proofMap: Record<string, string> = {};

      if (requestIds.length > 0) {
        const { data: proofs } = await supabase
          .from('pickup_proofs')
          .select('request_id, storage_path')
          .in('request_id', requestIds)
          .eq('is_non_collection_evidence', false);

        if (proofs && proofs.length > 0) {
          for (const p of proofs) {
            try {
              const { data: signed } = await supabase.storage
                .from('proofs')
                .createSignedUrl(p.storage_path, 3600);
              if (signed?.signedUrl) {
                proofMap[p.request_id] = signed.signedUrl;
              }
            } catch {
              // Ignore signed URL error
            }
          }
        }
      }

      const enriched = rawItems.map((item) => ({
        ...item,
        proof_url: proofMap[item.request_id] || null,
      }));

      setDisputes(enriched);
    } catch (err) {
      console.warn('Failed to load disputes:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadDisputes();
  }, [loadDisputes]);

  async function handleResolve(outcome: 'upheld' | 'rejected') {
    if (!selectedDispute) return;
    setActionBusy(true);
    setNotice(null);

    try {
      const note = resolutionNote.trim() || `Dispute ${outcome} by admin.`;
      const { error } = await supabase.rpc('resolve_dispute', {
        request_id: selectedDispute.request_id,
        outcome,
        note,
      });

      if (error) throw error;

      setNotice(
        `Dispute ${outcome === 'upheld' ? 'upheld (request marked not collected)' : 'rejected (request marked completed)'}.`
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

  return (
    <AdminShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-foreground">Disputes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Adjudicate missed pickups and false completion proof disputes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadDisputes()}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
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

      {/* Filter Tabs */}
      <div className="flex gap-1.5 mb-4">
        <Button
          variant={filter === 'open' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('open')}
          className="h-8 text-xs font-bold"
        >
          Open
        </Button>
        <Button
          variant={filter === 'resolved' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('resolved')}
          className="h-8 text-xs font-bold"
        >
          Resolved
        </Button>
      </div>

      {/* Disputes Cards */}
      {disputes.length > 0 ? (
        <div className="space-y-3">
          {disputes.map((dispute) => (
            <Card key={dispute.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {dispute.outcome === 'upheld' ? (
                      <Badge variant="destructive" className="text-[10px]">
                        Upheld (Not Collected)
                      </Badge>
                    ) : dispute.outcome === 'rejected' ? (
                      <Badge variant="success" className="text-[10px]">
                        Rejected (Completed)
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="text-[10px]">
                        Open Review
                      </Badge>
                    )}
                    <span className="font-mono text-xs text-muted-foreground">
                      #{dispute.request_id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(dispute.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-foreground">{dispute.reason}</p>

                  <div className="text-xs text-primary font-semibold">
                    Materials: {formatMaterials(dispute.pickup_requests_public?.material_summary)}
                  </div>

                  {dispute.supporting_context && (
                    <p className="text-xs text-muted-foreground">{dispute.supporting_context}</p>
                  )}

                  {dispute.resolution_note && (
                    <p className="text-xs text-muted-foreground pt-1">
                      <strong>Admin Note:</strong> {dispute.resolution_note}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {dispute.proof_url && (
                    <a
                      href={dispute.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1.5 rounded-xl hover:bg-primary/20 transition-all"
                    >
                      <ImageIcon size={14} />
                      Proof Photo
                    </a>
                  )}

                  {dispute.outcome === null && (
                    <Button
                      size="sm"
                      onClick={() => setSelectedDispute(dispute)}
                      className="self-start sm:self-auto shrink-0"
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-10 text-center">
          <p className="text-xs text-muted-foreground">No {filter} disputes.</p>
        </Card>
      )}

      {/* Visual Resolve Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-lg w-full p-6 bg-white shadow-2xl rounded-3xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Adjudicate Dispute</h3>
                  <span className="font-mono text-xs text-muted-foreground">
                    #{selectedDispute.request_id.slice(0, 8)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedDispute(null)}
                className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 py-4 overflow-y-auto flex-1">
              {/* Reason card */}
              <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-3">
                <span className="text-[11px] font-bold text-destructive uppercase">
                  Requester Dispute Reason
                </span>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {selectedDispute.reason}
                </p>
                {selectedDispute.supporting_context && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedDispute.supporting_context}
                  </p>
                )}
              </div>

              {/* Materials */}
              <div className="bg-secondary/30 rounded-2xl p-3">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">
                  Expected Materials
                </span>
                <p className="text-xs font-bold text-primary mt-0.5">
                  {formatMaterials(selectedDispute.pickup_requests_public?.material_summary)}
                </p>
              </div>

              {/* Collector Proof Photo Viewport */}
              <div>
                <span className="block text-xs font-bold text-foreground mb-1.5">
                  Collector Proof Photo
                </span>
                {selectedDispute.proof_url ? (
                  <div className="relative rounded-2xl overflow-hidden border border-border bg-slate-900 flex items-center justify-center min-h-[200px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedDispute.proof_url}
                      alt="Collector completion proof"
                      className="max-h-[260px] w-auto object-contain"
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground bg-muted/30">
                    No proof photo was submitted for this request.
                  </div>
                )}
              </div>

              {/* Resolution Note */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  Resolution Explanation (Recorded in Audit Log)
                </label>
                <Input
                  placeholder="e.g. Photo clearly shows empty doorstep / Photo is invalid"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-border/70 flex gap-2">
              <Button
                variant="destructive"
                disabled={actionBusy}
                onClick={() => void handleResolve('upheld')}
                className="flex-1"
              >
                Uphold (Refund Requester)
              </Button>
              <Button
                variant="default"
                disabled={actionBusy}
                onClick={() => void handleResolve('rejected')}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Reject (Mark Completed)
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
