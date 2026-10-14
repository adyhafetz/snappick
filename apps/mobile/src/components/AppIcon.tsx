import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

export function AppIcon({ name, color, size = 22 }: { name: AndroidSymbol; color: ColorValue; size?: number }) {
  return <SymbolView name={{ android: name, web: name }} tintColor={color} size={size} />;
}
