'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';
import {
  Camera,
  MessageSquareDiff,
  AlertTriangle,
  Cpu,
  ArrowRight,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

interface CorrectionRow {
  id: string;
  scan_id: string;
  feedback_type: string;
  original_model_label: string;
  corrected_app_class: string | null;
  created_at: string;
}

export default function AdminHomePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalScans: 0,
    totalCorrections: 0,
    openDisputes: 0,
    activeModel: 'v0',
  });
  const [recentCorrections, setRecentCorrections] = useState<CorrectionRow[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { count: scansCount } = await supabase
        .from('scans')
        .select('*', { count: 'exact', head: true });

      const { count: correctionsCount } = await supabase
        .from('label_feedback')
        .select('*', { count: 'exact', head: true });

      const { count: disputesCount } = await supabase
        .from('disputes')
        .select('*', { count: 'exact', head: true })
        .is('outcome', null);

      const { data: models } = await supabase
        .from('model_versions')
        .select('version')
        .eq('role', 'champion')
        .limit(1);

      setStats({
        totalScans: scansCount || 0,
        totalCorrections: correctionsCount || 0,
        openDisputes: disputesCount || 0,
        activeModel: models?.[0]?.version || 'v0',
      });

      const { data: corrections } = await supabase
        .from('label_feedback')
        .select('id, scan_id, feedback_type, original_model_label, corrected_app_class, created_at')
        .order('created_at', { ascending: false })
        .limit(6);

      setRecentCorrections((corrections as CorrectionRow[]) || []);
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const RETRAIN_THRESHOLD = 100;
  const progressPercent = Math.min(
    100,
    Math.round((stats.totalCorrections / RETRAIN_THRESHOLD) * 100)
  );

  return (
    <AdminShell>
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-foreground">Overview</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData()}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground">Scans</span>
            <Camera size={16} className="text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground">{stats.totalScans}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground">Corrections</span>
            <MessageSquareDiff size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-foreground">{stats.totalCorrections}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground">Active Model</span>
            <Cpu size={16} className="text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground uppercase">{stats.activeModel}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground">Disputes</span>
            <AlertTriangle size={16} className="text-rose-600" />
          </div>
          <div className="text-2xl font-black text-foreground">{stats.openDisputes}</div>
        </Card>
      </div>

      {/* Retraining Readiness Banner */}
      <Card className="p-4 mb-6 border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">Next Retraining Readiness</div>
              <div className="text-[11px] text-muted-foreground">
                {stats.totalCorrections} of {RETRAIN_THRESHOLD} new annotated samples accumulated
              </div>
            </div>
          </div>
          <Link href="/feedback">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold border-primary/30 text-primary bg-background"
            >
              Export for Kaggle
            </Button>
          </Link>
        </div>
        <div className="w-full bg-primary/10 rounded-full h-2 overflow-hidden mt-1">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </Card>

      {/* Recent User Corrections */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-4 px-5">
          <CardTitle className="text-sm font-bold">Recent Corrections</CardTitle>
          <Link href="/feedback">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-primary font-bold">
              View all <ArrowRight size={13} />
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          {recentCorrections.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Predicted</TableHead>
                  <TableHead>Corrected</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCorrections.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize text-[10px]">
                        {item.feedback_type.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground line-through capitalize">
                        {item.original_model_label}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.corrected_app_class ? (
                        <span className="text-xs font-bold text-primary capitalize bg-primary/10 px-2 py-0.5 rounded-md">
                          {item.corrected_app_class}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Removed</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground">No corrections yet.</div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
