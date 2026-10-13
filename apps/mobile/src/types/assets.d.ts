declare module '*.tflite' {
  const asset: number;
  export default asset;
}

declare module 'jpeg-js' {
  export function decode(data: Uint8Array, options?: { useTArray?: boolean }): { width: number; height: number; data: Uint8Array };
  const jpeg: { decode: typeof decode };
  export default jpeg;
}

