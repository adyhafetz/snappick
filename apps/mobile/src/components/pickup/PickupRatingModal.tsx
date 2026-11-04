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
import { Star, X, CheckCircle2 } from 'lucide-react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';

type PickupRatingModalProps = {
  visible: boolean;
  requestId: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

const RATING_LABELS: Record<number, string> = {
  1: 'Poor pickup',
  2: 'Needs improvement',
  3: 'Satisfactory',
  4: 'Great service',
  5: 'Exceptional collector!',
};

export function PickupRatingModal({
  visible,
  requestId,
  onClose,
  onSuccess,
}: PickupRatingModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  if (!visible || !requestId) return null;

  async function handleSubmit() {
    if (!requestId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('rate_and_confirm_pickup', {
        p_request_id: requestId,
        p_rating: rating,
        p_feedback_note: note.trim() || null,
      });

      if (error) {
        Alert.alert('Could not submit rating', error.message);
        return;
      }

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
              <View className="h-8 w-8 rounded-xl bg-primary/10 items-center justify-center">
                <CheckCircle2 size={16} color="#19806d" />
              </View>
              <View>
                <Text className="text-base font-bold text-foreground">
                  Rate Experience
                </Text>
              </View>
            </View>
            <AnimatedPressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close rating dialog"
              className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-secondary/80"
            >
              <X size={16} color="#5b7072" />
            </AnimatedPressable>
          </View>

          {/* Star Selection */}
          <View className="items-center py-6">
            <View className="flex-row gap-2.5 mb-2">
              {[1, 2, 3, 4, 5].map((starValue) => {
                const filled = starValue <= rating;
                return (
                  <AnimatedPressable
                    key={starValue}
                    onPress={() => setRating(starValue)}
                    className="min-w-[48px] min-h-[48px] items-center justify-center p-1"
                  >
                    <Star
                      size={32}
                      color={filled ? '#f59e0b' : '#d1d5db'}
                      fill={filled ? '#f59e0b' : 'transparent'}
                    />
                  </AnimatedPressable>
                );
              })}
            </View>
            <Text className="text-xs font-semibold text-primary mt-1">
              {RATING_LABELS[rating]}
            </Text>
          </View>

          {/* Feedback Note Input */}
          <View className="mb-5">
            <Text className="text-xs font-bold text-foreground mb-1.5">
              Note (Optional)
            </Text>
            <TextInput
              placeholder="Share brief feedback for the collector..."
              placeholderTextColor="#9ca3af"
              value={note}
              onChangeText={setNote}
              maxLength={200}
              className="w-full h-16 rounded-2xl bg-secondary/30 border border-border/60 p-3 text-sm text-foreground text-start"
              multiline
            />
          </View>

          {/* Confirm Button */}
          <Button
            disabled={submitting}
            onPress={() => void handleSubmit()}
            className="w-full h-12 rounded-2xl bg-primary flex-row items-center justify-center gap-2"
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Star size={18} color="#ffffff" fill="#ffffff" />
                <Text className="text-base font-bold text-white">
                  Submit Rating
                </Text>
              </>
            )}
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

