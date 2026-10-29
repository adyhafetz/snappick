import * as React from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  View,
} from 'react-native';
import { X, ShieldCheck } from 'lucide-react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { Text } from '@/components/ui/text';

type ProofPhotoModalProps = {
  visible: boolean;
  photoUrl: string | null;
  onClose: () => void;
  title?: string;
};

export function ProofPhotoModal({
  visible,
  photoUrl,
  onClose,
  title = 'Collection Proof',
}: ProofPhotoModalProps) {
  const [loading, setLoading] = useState(true);

  if (!visible || !photoUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/80 items-center justify-center p-5"
        onPress={onClose}
      >
        <Pressable
          className="w-full max-w-sm rounded-3xl bg-card border border-border/80 overflow-hidden shadow-2xl"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View className="p-4 border-b border-border/50 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 rounded-xl bg-primary/10 items-center justify-center">
                <ShieldCheck size={16} color="#19806d" />
              </View>
              <View>
                <Text className="text-sm font-bold text-foreground">{title}</Text>
                <Text className="text-xs text-muted-foreground">
                  Verified photo from collection
                </Text>
              </View>
            </View>
            <AnimatedPressable
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-secondary/80"
            >
              <X size={16} color="#5b7072" />
            </AnimatedPressable>
          </View>

          {/* Photo Viewport */}
          <View className="relative bg-black/95 items-center justify-center min-h-[320px]">
            {loading && (
              <View className="absolute inset-0 items-center justify-center">
                <ActivityIndicator color="#19806d" size="large" />
              </View>
            )}
            <Image
              source={{ uri: photoUrl }}
              style={{ width: '100%', height: 320 }}
              resizeMode="contain"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
            />
          </View>

          {/* Footer */}
          <View className="p-3 bg-secondary/30 border-t border-border/50 items-center">
            <Text className="text-[11px] font-medium text-muted-foreground text-center">
              Metadata and location tags stripped for privacy
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

