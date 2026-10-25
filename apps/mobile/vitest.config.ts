import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __DEV__: true,
  },
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/assets': fileURLToPath(new URL('./assets', import.meta.url)),
    },
  },
  test: { environment: 'node' },
});
