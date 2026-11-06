'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  Clock,
  Cpu,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RecentScan {
  id: string;
  created_at: string;
  image_path: string | null;
}

const DATASET_TARGET = 50;

export default function AdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeModel: 'v0',
    readyImages: 0,
    pendingEdits: 0,
    openDisputes: 0,
  });
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: models } = await supabase
        .from('model_versions')
        .select('version, role')
        .order('created_at', { ascending: false });

      const { data: scans } = await supabase
        .from('scans')
        .select('id, image_path, created_at')
        .eq('image_storage_consent', true)
        .eq('training_opt_in', true)
        .not('image_path', 'is', null)
        .order('created_at', { ascending: false });

      const { data: feedback } = await supabase
        .from('label_feedback')
        .select('id, scan_id, feedback_type, collector_verified_at');

      const unverified = (feedback || []).filter(
        (f) =>
          (f.feedback_type === 'change_label' || f.feedback_type === 'remove') &&
          !f.collector_verified_at
      );
      const unverifiedScanIds = new Set(unverified.map((u) => u.scan_id));
      const readyScans = (scans || []).filter((s) => !unverifiedScanIds.has(s.id));

      const { count: disputesCount } = await supabase
        .from('disputes')
        .select('*', { count: 'exact', head: true })
        .is('outcome', null);

      setStats({
        activeModel: models?.find((m) => m.role === 'champion')?.version || 'v0',
        readyImages: readyScans.length,
        pendingEdits: unverified.length,
        openDisputes: disputesCount || 0,
      });
      setRecentScans(readyScans.slice(0, 4));
    } catch (err) {
      console.warn('Overview fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const progress = Math.min(100, Math.round((stats.readyImages / DATASET_TARGET) * 100));

  const tiles = [
    {
      href: '/models',
      label: 'Live Model',
      value: stats.activeModel.toUpperCase(),
      icon: Cpu,
      color: '#19806d',
      tint: 'bg-primary/10 border-primary/20',
      ring: 'border-primary/20',
    },
    {
      href: '/feedback',
      label: 'Review',
      value: stats.pendingEdits,
      icon: Clock,
      color: '#b45309',
      tint: 'bg-amber-500/10 border-amber-500/25',
      ring: 'border-amber-500/25',
    },
    {
      href: '/disputes',
      label: 'Disputes',
      value: stats.openDisputes,
      icon: AlertTriangle,
      color: '#b42318',
      tint: 'bg-rose-500/10 border-rose-500/25',
      ring: 'border-rose-500/25',
    },
  ];

  return (
    <AdminShell>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-black text-[#183e48] tracking-tight">Overview</h1>
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {tiles.map(({ href, label, value, icon: Icon, color, tint, ring }) => (
          <Link key={label} href={href} className="block">
            <Card
              className={`p-4 rounded-3xl bg-white border ${ring} shadow-xs hover:shadow-md transition-shadow`}
            >
              <div
                className={`h-9 w-9 rounded-2xl border flex items-center justify-center mb-3 ${tint}`}
              >
                <Icon size={17} color={color} />
              </div>
              <div className="text-2xl font-black text-[#183e48] tracking-tight">{value}</div>
              <div className="text-[11px] font-bold text-muted-foreground mt-0.5">{label}</div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Dataset */}
      <Link href="/feedback" className="block mt-3.5">
        <Card className="p-5 rounded-3xl bg-white border border-border/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Dataset
              </div>
              <div className="text-2xl font-black text-[#183e48] tracking-tight mt-1">
                {stats.readyImages}
                <span className="text-muted-foreground font-bold text-base"> / {DATASET_TARGET}</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-[#8a9ea0] mb-1" />
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#e8efe9] overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </Card>
      </Link>

      {/* Recent */}
      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Recent Scans
        </h2>
        <Link href="/feedback" className="text-xs font-bold text-primary hover:underline">
          View all
        </Link>
      </div>

      {recentScans.length > 0 ? (
        <div className="space-y-2.5">
          {recentScans.map((scan) => (
            <Link key={scan.id} href="/feedback" className="block">
              <Card className="p-3.5 rounded-3xl bg-white border border-border/80 shadow-xs flex-row flex items-center justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Camera size={19} color="#19806d" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-[#183e48] tracking-tight truncate">
                      {scan.image_path?.split('/').pop() || scan.id.slice(0, 8)}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground mt-0.5">
                      {new Date(scan.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                </div>
                <ChevronRight size={15} className="text-[#8a9ea0] shrink-0" />
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-4 rounded-3xl border border-dashed border-border/80 bg-white/60 flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">No scans yet</span>
        </Card>
      )}
    </AdminShell>
  );
}
