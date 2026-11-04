import * as React from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';

type PickupDisputeModalProps = {
  visible: boolean;
  requestId: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

const COMMON_REASONS = [
  'Waste was not picked up',
  'Fake or invalid proof photo',
  'Incomplete collection (items left behind)',
  'Collector was disrespectful or caused damage',
];

export function PickupDisputeModal({
  visible,
  requestId,
  onClose,
  onSuccess,
}: PickupDisputeModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_REASONS[0]);
  const [customDetails, setCustomDetails] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  if (!visible || !requestId) return null;

  async function handleSubmit() {
    if (!requestId) return;
    setSubmitting(true);
    try {
      const fullReason = customDetails.trim()
        ? `${selectedReason}: ${customDetails.trim()}`
        : selectedReason;

      const { error } = await supabase.rpc('raise_dispute', {
        request_id: requestId,
        reason: fullReason,
      });

      if (error) {
        Alert.alert('Could not submit report', error.message);
        return;
      }

      Alert.alert(
        'Dispute Submitted',
        'Our admin team will review this pickup proof and take corrective action.'
      );
      onSuccess();
      onClose();
    } catch (err) {
      Alert.alert(
        'Submission error',
        err instanceof Error ? err.message : 'Please check connection and retry.'
      );
    } finally {
      setSubmitting(false);
    }
  }

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
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 rounded-xl bg-destructive/10 items-center justify-center">
                <AlertTriangle size={16} color="#b42318" />
              </View>
              <View>
                <Text className="text-base font-bold text-foreground">
                  Report Issue
                </Text>
              </View>
            </View>
            <AnimatedPressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close dispute dialog"
              className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-secondary/80"
            >
              <X size={16} color="#5b7072" />
            </AnimatedPressable>
          </View>

          {/* Reason Options */}
          <View className="py-4 space-y-2">
            <Text className="text-xs font-bold text-foreground mb-1">
              Reason for Issue
            </Text>
            {COMMON_REASONS.map((reason) => {
              const isSelected = selectedReason === reason;
              return (
                <Pressable
                  key={reason}
                  onPress={() => setSelectedReason(reason)}
                  className={`p-3.5 min-h-[44px] justify-center rounded-2xl border ${
                    isSelected
                      ? 'border-destructive/60 bg-destructive/10'
                      : 'border-border/60 bg-secondary/20'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      isSelected ? 'text-destructive' : 'text-foreground'
                    }`}
                  >
                    {reason}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Additional details */}
          <View className="mb-5">
            <Text className="text-xs font-bold text-foreground mb-1.5">
              Details (Optional)
            </Text>
            <TextInput
              placeholder="Explain what happened at the location..."
              placeholderTextColor="#9ca3af"
              value={customDetails}
              onChangeText={setCustomDetails}
              maxLength={200}
              className="w-full h-16 rounded-2xl bg-secondary/30 border border-border/60 p-3 text-sm text-foreground text-start"
              multiline
            />
          </View>

          {/* Submit Dispute Button */}
          <Button
            disabled={submitting}
            onPress={() => void handleSubmit()}
            className="w-full h-12 rounded-2xl bg-destructive flex-row items-center justify-center gap-2"
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <ShieldAlert size={18} color="#ffffff" />
              <Text className="text-base font-bold text-white">
                Submit Dispute
              </Text>
              </>
            )}
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

