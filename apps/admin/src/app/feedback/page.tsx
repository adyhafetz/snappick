'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';
import { Download, RefreshCw, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

interface CorrectionItem {
  id: string;
  scan_id: string;
  feedback_type: string;
  original_model_label: string;
  corrected_app_class: string | null;
  created_at: string;
  scans?: {
    image_path: string | null;
    image_width: number;
    image_height: number;
  } | null;
  detections?: {
    score: number;
    box_x1: number | null;
    box_y1: number | null;
    box_x2: number | null;
    box_y2: number | null;
  } | null;
}

const YOLO_CLASSES = ['metal', 'trash', 'glass', 'paper', 'cardboard', 'plastic', 'biological'];
const FILTER_CLASSES = ['all', ...YOLO_CLASSES];

export default function FeedbackPage() {
  const [corrections, setCorrections] = useState<CorrectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState<string>('all');

  const loadCorrections = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('label_feedback')
        .select(`
          id,
          scan_id,
          feedback_type,
          original_model_label,
          corrected_app_class,
          created_at,
          scans (
            image_path,
            image_width,
            image_height
          ),
          detections (
            score,
            box_x1,
            box_y1,
            box_x2,
            box_y2
          )
        `)
        .order('created_at', { ascending: false });

      if (classFilter !== 'all') {
        query = query.or(
          `original_model_label.eq.${classFilter},corrected_app_class.eq.${classFilter}`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      setCorrections((data as unknown as CorrectionItem[]) || []);
    } catch (err) {
      console.warn('Failed to load corrections:', err);
    } finally {
      setLoading(false);
    }
  }, [classFilter]);

  useEffect(() => {
    void loadCorrections();
  }, [loadCorrections]);

  function exportForKaggle() {
    const formatted = {
      description: 'SnapPick User Corrections & Hard Negatives Dataset for Kaggle YOLO Training',
      exported_at: new Date().toISOString(),
      classes: YOLO_CLASSES,
      sample_count: corrections.length,
      samples: corrections.map((item) => {
        const targetClass = item.corrected_app_class || item.original_model_label;
        const classIdx = YOLO_CLASSES.indexOf(targetClass);

        let yoloBox = null;
        if (
          item.detections?.box_x1 != null &&
          item.detections?.box_y1 != null &&
          item.detections?.box_x2 != null &&
          item.detections?.box_y2 != null
        ) {
          const x1 = Number(item.detections.box_x1);
          const y1 = Number(item.detections.box_y1);
          const x2 = Number(item.detections.box_x2);
          const y2 = Number(item.detections.box_y2);
          const cx = Number(((x1 + x2) / 2).toFixed(6));
          const cy = Number(((y1 + y2) / 2).toFixed(6));
          const w = Number((x2 - x1).toFixed(6));
          const h = Number((y2 - y1).toFixed(6));
          yoloBox = {
            cx,
            cy,
            w,
            h,
            yolo_line: classIdx >= 0 ? `${classIdx} ${cx} ${cy} ${w} ${h}` : null,
          };
        }

        return {
          id: item.id,
          scan_id: item.scan_id,
          feedback_type: item.feedback_type,
          original_model_label: item.original_model_label,
          target_class: targetClass,
          class_index: classIdx,
          image_path: item.scans?.image_path ?? null,
          image_dimensions: item.scans
            ? { width: item.scans.image_width, height: item.scans.image_height }
            : null,
          bbox: yoloBox,
        };
      }),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(formatted, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `snappick-kaggle-corrections-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  return (
    <AdminShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-foreground">User Corrections</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-world model errors corrected by residents, ready for Kaggle training.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadCorrections()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={exportForKaggle}
            disabled={corrections.length === 0}
            className="gap-1.5"
          >
            <Download size={14} />
            Export for Kaggle
          </Button>
        </div>
      </div>

      {/* Class Filter Bar */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTER_CLASSES.map((cls) => (
          <Button
            key={cls}
            variant={classFilter === cls ? 'default' : 'outline'}
            size="sm"
            onClick={() => setClassFilter(cls)}
            className="capitalize h-8 text-xs font-bold"
          >
            {cls}
          </Button>
        ))}
      </div>

      {/* Corrections Table */}
      <Card>
        <CardContent className="p-0">
          {corrections.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Predicted</TableHead>
                  <TableHead>Corrected</TableHead>
                  <TableHead>Scan ID</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {corrections.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge
                        variant={item.feedback_type === 'remove' ? 'destructive' : 'warning'}
                        className="capitalize text-[10px]"
                      >
                        {item.feedback_type.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-muted-foreground line-through capitalize font-semibold">
                        {item.original_model_label}
                      </span>
                    </TableCell>

                    <TableCell>
                      {item.corrected_app_class ? (
                        <div className="flex items-center gap-1.5">
                          <ArrowRight size={12} className="text-primary" />
                          <Badge variant="success" className="capitalize text-xs font-bold">
                            {item.corrected_app_class}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Removed</span>
                      )}
                    </TableCell>

                    <TableCell className="font-mono text-xs text-muted-foreground">
                      #{item.scan_id.slice(0, 8)}
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
            <div className="py-12 text-center text-xs text-muted-foreground">
              No corrections found.
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
