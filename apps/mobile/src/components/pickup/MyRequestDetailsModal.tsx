import * as React from 'react';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import {
  ArrowRight,
  Ban,
  Camera,
  Check,
  Layers,
  Package,
  Play,
  RotateCcw,
  ShieldAlert,
  Star,
  Truck,
  User,
  X,
} from 'lucide-react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export type MyRequestItem = {
  id: string;
  status: string;
  district_name: string | null;
  material_summary: { class?: string; quantity?: number }[];
  pickup_window_start: string | null;
  pickup_window_end: string | null;
  created_at?: string;
  updated_at?: string;
  collector_name?: string | null;
  collector_rating?: number | null;
  collector_rating_count?: number | null;
  requester_name?: string | null;
  requester_rating?: number | null;
  requester_rating_count?: number | null;
};

type MyRequestDetailsModalProps = {
  visible: boolean;
  mode?: 'request' | 'claimed';
  request: MyRequestItem | null;
  onClose: () => void;
  onCancelRequest?: (requestId: string) => void;
  cancelling?: boolean;
  onStartPickup?: (requestId: string) => void;
  starting?: boolean;
  onReleasePickup?: (requestId: string) => void;
  releasing?: boolean;
  onContinuePickup?: (requestId: string) => void;
  onViewProof?: (requestId: string) => void;
  onConfirm?: (requestId: string) => void;
  onReportDispute?: (requestId: string) => void;
};

const RECEIPT_CLASSES = [
  { id: 'metal', label: 'Metal' },
  { id: 'trash', label: 'Trash' },
  { id: 'glass', label: 'Glass' },
  { id: 'paper', label: 'Paper' },
  { id: 'cardboard', label: 'Cardboard' },
  { id: 'plastic', label: 'Plastic' },
  { id: 'biological', label: 'Biological' },
] as const;

export function MyRequestDetailsModal({
  visible,
  mode = 'request',
  request,
  onClose,
  onCancelRequest,
  cancelling = false,
  onStartPickup,
  starting = false,
  onReleasePickup,
  releasing = false,
  onContinuePickup,
  onViewProof,
  onConfirm,
  onReportDispute,
}: MyRequestDetailsModalProps) {
  const isPending = request?.status === 'pending';
  const isClaimed = mode === 'claimed';

  const quantityByClass = useMemo(() => {
    const map: Record<string, number> = {
      metal: 0,
      trash: 0,
      glass: 0,
      paper: 0,
      cardboard: 0,
      plastic: 0,
      biological: 0,
    };
    if (request && Array.isArray(request.material_summary)) {
      for (const item of request.material_summary) {
        const key = (item.class ?? '').toLowerCase().trim();
        if (key in map) {
          map[key] = (map[key] ?? 0) + (item.quantity ?? 1);
        }
      }
    }
    return map;
  }, [request]);

  const totalItems = useMemo(() => {
    return Object.values(quantityByClass).reduce((sum, val) => sum + val, 0);
  }, [quantityByClass]);

  if (!visible || !request) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/70 items-center justify-center p-5"
        onPress={onClose}
      >
        <Pressable
          className="w-full max-w-sm rounded-3xl bg-card border border-border/80 overflow-hidden shadow-2xl p-5"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between pb-3 border-b border-border/40">
            <View className="flex-row items-center gap-2.5">
              <View className="h-9 w-9 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center">
                {isClaimed ? (
                  <Truck size={18} color="#19806d" strokeWidth={2.2} />
                ) : (
                  <Package size={18} color="#19806d" strokeWidth={2.2} />
                )}
              </View>
              <View>
                <Text className="text-base font-bold text-foreground">
                  {request.district_name ?? 'Perak area'}
                </Text>
              </View>
            </View>
            <AnimatedPressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close request details dialog"
              className="h-9 w-9 items-center justify-center rounded-full bg-secondary/80"
            >
              <X size={16} color="#5b7072" />
            </AnimatedPressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="max-h-[440px] mt-3">
            {/* First Part: COLLECTOR (for requester mode) vs REQUESTER (for claimed mode) */}
            {isClaimed ? (
              <View className="mb-3 p-3.5 rounded-2xl bg-secondary/40 border border-border/60 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                  <View className="h-8 w-8 rounded-full bg-primary/15 border border-primary/25 items-center justify-center">
                    <User size={15} color="#19806d" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Requester
                    </Text>
                    <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                      {request.requester_name ?? 'Resident'}
                    </Text>
                  </View>
                </View>
                {request.requester_rating != null && (
                  <View className="flex-row items-center gap-1 bg-card px-2.5 py-1 rounded-xl border border-border/60 shadow-2xs">
                    <Star size={12} color="#f59e0b" fill="#f59e0b" />
                    <Text className="text-xs font-bold text-foreground">
                      {request.requester_rating.toFixed(1)}
                    </Text>
                    <Text className="text-[10px] text-muted-foreground font-medium">
                      ({request.requester_rating_count ?? 0})
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View className="mb-3 p-3.5 rounded-2xl bg-secondary/40 border border-border/60 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                  <View className="h-8 w-8 rounded-full bg-primary/15 border border-primary/25 items-center justify-center">
                    <User size={15} color="#19806d" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Collector
                    </Text>
                    <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                      {request.collector_name ?? (request.status === 'pending' ? 'Looking for Collector' : 'Assigned Collector')}
                    </Text>
                  </View>
                </View>
                {request.collector_rating != null && (
                  <View className="flex-row items-center gap-1 bg-card px-2.5 py-1 rounded-xl border border-border/60 shadow-2xs">
                    <Star size={12} color="#f59e0b" fill="#f59e0b" />
                    <Text className="text-xs font-bold text-foreground">
                      {request.collector_rating.toFixed(1)}
                    </Text>
                    <Text className="text-[10px] text-muted-foreground font-medium">
                      ({request.collector_rating_count ?? 0})
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Uniform Receipt-style Items Manifest */}
            <View className="p-4 rounded-2xl bg-secondary/35 border border-border/70 mb-3">
              {/* Receipt Subheader */}
              <View className="flex-row items-center justify-between pb-2 border-b border-border/50 mb-1">
                <View className="flex-row items-center gap-1.5">
                  <Layers size={14} color="#19806d" strokeWidth={2.2} />
                  <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Item
                  </Text>
                </View>
                <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Quantity
                </Text>
              </View>

              {/* 7 Uniform Hardcoded Class Rows */}
              {RECEIPT_CLASSES.map((item, idx) => {
                const qty = quantityByClass[item.id] ?? 0;
                const hasItem = qty > 0;
                return (
                  <View
                    key={item.id}
                    className={`flex-row items-center justify-between py-2 ${
                      idx < RECEIPT_CLASSES.length - 1 ? 'border-b border-border/30' : ''
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        hasItem ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'
                      }`}
                    >
                      {item.label}
                    </Text>
                    <View
                      className={`min-w-[28px] h-6 px-2 rounded-lg items-center justify-center ${
                        hasItem
                          ? 'bg-primary/15 border border-primary/25'
                          : 'bg-muted/50 border border-transparent'
                      }`}
                    >
                      <Text
                        className={`text-xs ${
                          hasItem ? 'font-black text-primary' : 'font-medium text-muted-foreground'
                        }`}
                      >
                        {qty}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Receipt Total Footer */}
              <View className="flex-row items-center justify-between pt-3 mt-1 border-t-2 border-dashed border-border/60">
                <Text className="text-sm font-black text-foreground">Total Items</Text>
                <Text className="text-base font-black text-primary">{totalItems}</Text>
              </View>
            </View>

            {/* Awaiting Confirmation Actions (For Requester Mode) */}
            {!isClaimed && request.status === 'awaiting_confirmation' && (
              <View className="mb-3 gap-2.5">
                {onViewProof && (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => onViewProof(request.id)}
                    className="w-full rounded-2xl border-border/80 bg-secondary/30 flex-row items-center justify-center gap-2 h-10"
                  >
                    <Camera size={15} color="#19806d" />
                    <Text className="text-xs font-bold text-primary">View Proof</Text>
                  </Button>
                )}
                <View className="flex-row gap-2.5">
                  {onConfirm && (
                    <Button
                      size="sm"
                      onPress={() => {
                        onClose();
                        onConfirm(request.id);
                      }}
                      className="flex-1 h-11 rounded-2xl bg-primary flex-row items-center justify-center gap-2 shadow-xs"
                    >
                      <Check size={16} color="#ffffff" strokeWidth={2.5} />
                      <Text className="text-xs font-bold text-white">Confirm</Text>
                    </Button>
                  )}
                  {onReportDispute && (
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        onClose();
                        onReportDispute(request.id);
                      }}
                      className="flex-1 h-11 rounded-2xl border-destructive/25 bg-destructive/5 flex-row items-center justify-center gap-1.5"
                    >
                      <ShieldAlert size={15} color="#b42318" />
                      <Text className="text-xs font-bold text-destructive">Dispute</Text>
                    </Button>
                  )}
                </View>
              </View>
            )}

            {/* Disputed Notice */}
            {!isClaimed && request.status === 'disputed' && (
              <View className="mb-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <Text className="text-xs font-semibold text-amber-800 leading-tight">
                  Dispute in progress. Admin is investigating the collection proof.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons Section */}
          {(isClaimed || (isPending && onCancelRequest)) && (
            <View className="pt-3 border-t border-border/40 mt-1">
              {isClaimed ? (
                request.status === 'accepted' ? (
                  <View className="flex-row gap-2.5">
                    {onReleasePickup && (
                      <Button
                        onPress={() => onReleasePickup(request.id)}
                        disabled={releasing || starting}
                        variant="outline"
                        className="flex-1 h-11 rounded-2xl border-border/80 bg-secondary/30 flex-row items-center justify-center gap-1.5"
                      >
                        <RotateCcw size={15} color="#5b7072" />
                        <Text className="text-xs font-bold text-foreground">Release Task</Text>
                      </Button>
                    )}
                    {onStartPickup && (
                      <Button
                        onPress={() => onStartPickup(request.id)}
                        disabled={starting || releasing}
                        className="flex-1 h-11 rounded-2xl bg-primary flex-row items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Play size={14} color="#ffffff" fill="#ffffff" />
                        <Text className="text-xs font-bold text-white">Start Pickup</Text>
                      </Button>
                    )}
                  </View>
                ) : request.status === 'in_progress' ? (
                  onContinuePickup && (
                    <Button
                      onPress={() => {
                        onClose();
                        onContinuePickup(request.id);
                      }}
                      className="w-full h-11 rounded-2xl bg-primary flex-row items-center justify-center gap-2 shadow-xs"
                    >
                      <Text className="text-xs font-bold text-white">Open Details</Text>
                      <ArrowRight size={15} color="#ffffff" />
                    </Button>
                  )
                ) : (
                  onContinuePickup && (
                    <Button
                      onPress={() => {
                        onClose();
                        onContinuePickup(request.id);
                      }}
                      variant="outline"
                      className="w-full h-11 rounded-2xl border-border/80 bg-secondary/30 flex-row items-center justify-center gap-2"
                    >
                      <Text className="text-xs font-bold text-foreground">View Details</Text>
                      <ArrowRight size={15} color="#5b7072" />
                    </Button>
                  )
                )
              ) : isPending && onCancelRequest ? (
                <Button
                  onPress={() => {
                    onClose();
                    onCancelRequest(request.id);
                  }}
                  disabled={cancelling}
                  variant="outline"
                  className="w-full h-11 rounded-2xl border-destructive/25 bg-destructive/5 flex-row items-center justify-center gap-2"
                >
                  <Ban size={15} color="#b42318" />
                  <Text className="text-xs font-bold text-destructive">Cancel Request</Text>
                </Button>
              ) : null}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
