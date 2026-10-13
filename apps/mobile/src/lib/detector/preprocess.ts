import type { InputLayout, ModelManifest, NormalizedBox } from './types';

export type RgbaImage = { width: number; height: number; data: Uint8Array };
export type Transform = {
  sourceWidth: number;
  sourceHeight: number;
  cropX: number;
  cropY: number;
  cropSize: number;
  scale: number;
  padX: number;
  padY: number;
  mode: 'centre_crop' | 'letterbox';
};

export function createTransform(width: number, height: number, mode: Transform['mode'], targetWidth: number, targetHeight: number): Transform {
  if (mode === 'centre_crop') {
    const cropSize = Math.min(width, height);
    return { sourceWidth: width, sourceHeight: height, cropX: (width - cropSize) / 2, cropY: (height - cropSize) / 2, cropSize, scale: targetWidth / cropSize, padX: 0, padY: 0, mode };
  }
  const scale = Math.min(targetWidth / width, targetHeight / height);
  return { sourceWidth: width, sourceHeight: height, cropX: 0, cropY: 0, cropSize: 0, scale, padX: (targetWidth - width * scale) / 2, padY: (targetHeight - height * scale) / 2, mode };
}

export function inverseBox(box: NormalizedBox, transform: Transform, targetWidth: number, targetHeight: number): NormalizedBox {
  if (transform.mode === 'centre_crop') {
    const x1 = (box.x1 * targetWidth / transform.scale + transform.cropX) / transform.sourceWidth;
    const y1 = (box.y1 * targetHeight / transform.scale + transform.cropY) / transform.sourceHeight;
    const x2 = (box.x2 * targetWidth / transform.scale + transform.cropX) / transform.sourceWidth;
    const y2 = (box.y2 * targetHeight / transform.scale + transform.cropY) / transform.sourceHeight;
    return clampBox({ x1, y1, x2, y2 });
  }
  const x1 = (box.x1 * targetWidth - transform.padX) / transform.scale / transform.sourceWidth;
  const y1 = (box.y1 * targetHeight - transform.padY) / transform.scale / transform.sourceHeight;
  const x2 = (box.x2 * targetWidth - transform.padX) / transform.scale / transform.sourceWidth;
  const y2 = (box.y2 * targetHeight - transform.padY) / transform.scale / transform.sourceHeight;
  return clampBox({ x1, y1, x2, y2 });
}

export function clampBox(box: NormalizedBox): NormalizedBox {
  return { x1: Math.max(0, Math.min(1, box.x1)), y1: Math.max(0, Math.min(1, box.y1)), x2: Math.max(0, Math.min(1, box.x2)), y2: Math.max(0, Math.min(1, box.y2)) };
}

function sample(image: RgbaImage, x: number, y: number): [number, number, number] {
  const sx = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const sy = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const i = (sy * image.width + sx) * 4;
  return [image.data[i] / 255, image.data[i + 1] / 255, image.data[i + 2] / 255];
}

export function createInputTensor(image: RgbaImage, manifest: ModelManifest): { buffer: ArrayBuffer; transform: Transform } {
  const { width: targetWidth, height: targetHeight, layout, resize } = manifest.input;
  const transform = createTransform(image.width, image.height, resize, targetWidth, targetHeight);
  const output = new Float32Array(targetWidth * targetHeight * 3);
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      let sourceX: number;
      let sourceY: number;
      if (resize === 'centre_crop') {
        sourceX = transform.cropX + (x + 0.5) / transform.scale;
        sourceY = transform.cropY + (y + 0.5) / transform.scale;
      } else {
        sourceX = (x + 0.5 - transform.padX) / transform.scale;
        sourceY = (y + 0.5 - transform.padY) / transform.scale;
      }
      const pixel = (resize === 'letterbox' && (sourceX < 0 || sourceY < 0 || sourceX >= image.width || sourceY >= image.height))
        ? [0.5, 0.5, 0.5] as [number, number, number]
        : sample(image, sourceX, sourceY);
      if (layout === 'NCHW') {
        const area = targetWidth * targetHeight;
        output[y * targetWidth + x] = pixel[0];
        output[area + y * targetWidth + x] = pixel[1];
        output[area * 2 + y * targetWidth + x] = pixel[2];
      } else {
        const i = (y * targetWidth + x) * 3;
        output[i] = pixel[0]; output[i + 1] = pixel[1]; output[i + 2] = pixel[2];
      }
    }
  }
  return { buffer: output.buffer, transform };
}

export function inputLayoutFromShape(shape: number[]): InputLayout {
  if (shape.length !== 4 || shape[0] !== 1) throw new Error(`Cannot infer input layout from tensor shape [${shape.join(', ')}].`);
  if (shape[1] === 3) return 'NCHW';
  if (shape[3] === 3) return 'NHWC';
  throw new Error(`Unsupported input channel layout for tensor shape [${shape.join(', ')}]. Expected 3 channels in position 1 or 3.`);
}

