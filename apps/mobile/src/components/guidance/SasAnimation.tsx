import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import type { SasClass } from '@/lib/guidance/malaysianSas';

interface SasAnimationProps {
  sasClass: SasClass | string;
  size?: number;
}

const SAS_ANIMATION_ASSETS: Record<string, number> = {
  cardboard: require('@/assets/animations/cardboard.webp'),
  plastic: require('@/assets/animations/plastic.webp'),
  metal: require('@/assets/animations/metal.webp'),
  paper: require('@/assets/animations/paper.webp'),
  glass: require('@/assets/animations/glass.webp'),
  biological: require('@/assets/animations/biological.webp'),
  trash: require('@/assets/animations/trash.webp'),
};

export function SasAnimation({ sasClass, size = 135 }: SasAnimationProps) {
  const normClass = (sasClass || 'trash').toLowerCase() as SasClass;
  const asset = SAS_ANIMATION_ASSETS[normClass] ?? SAS_ANIMATION_ASSETS.trash;

  return (
    <View
      style={{ width: '100%', height: size }}
      className="items-center justify-center overflow-hidden"
    >
      <Image
        source={asset}
        contentFit="contain"
        autoplay
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}
