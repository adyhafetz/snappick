import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { toByteArray } from 'base64-js';
import jpeg from 'jpeg-js';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';

import manifestJson from '@/assets/models/model_manifest.json';
import type { Detection, ModelManifest } from './types';
import { createInputTensor, createTransform, type RgbaImage } from './preprocess';
import { classWiseNms, decodeYoloOutput, toDetections } from './postprocess';
import { parseManifest, validateManifestAgainstTensors } from './manifest';
import {
  getActiveModelVersion,
  getActiveModelConfig,
  rollbackToBundledFallback,
} from './manager';

// Keep the baseline binary in assets/models, outside Expo Router's route tree.
// Metro needs a static require for an immutable bundled binary asset.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL_ASSET = require('../../../assets/models/waste_detector_v0.tflite');

export type ScanTimings = { preprocessMs: number; inferenceMs: number; decodeNmsMs: number };
export type ScanResult = { detections: Detection[]; timings: ScanTimings; imageWidth: number; imageHeight: number; manifest: ModelManifest };

let bundledModelPromise: Promise<{ model: TensorflowModel; manifest: ModelManifest }> | undefined;
let activeModelPromise: Promise<{ model: TensorflowModel; manifest: ModelManifest }> | undefined;

export async function loadBundledDetector(): Promise<{ model: TensorflowModel; manifest: ModelManifest }> {
  if (!bundledModelPromise) {
    bundledModelPromise = (async () => {
      const manifest = parseManifest(manifestJson);
      const model = await loadTensorflowModel(MODEL_ASSET, []);
      const input = model.inputs[0];
      const output = model.outputs[0];
      if (!input || !output) throw new Error('Bundled model has no input or output tensor.');
      validateManifestAgainstTensors(manifest, input, output);
      return { model, manifest };
    })().catch((error) => {
      bundledModelPromise = undefined;
      throw error;
    });
  }
  return bundledModelPromise;
}

export async function loadActiveDetector(): Promise<{ model: TensorflowModel; manifest: ModelManifest }> {
  const activeVersion = await getActiveModelVersion();
  if (activeVersion === 'v0') {
    return loadBundledDetector();
  }

  if (!activeModelPromise) {
    activeModelPromise = (async () => {
      try {
        const config = await getActiveModelConfig();
        if (!config || !config.url) {
          throw new Error(`No remote model URL found for active version ${activeVersion}`);
        }

        const manifest = parseManifest({
          ...manifestJson,
          version: activeVersion,
          thresholds: (config.manifest?.thresholds as typeof manifestJson.thresholds) || manifestJson.thresholds,
        });

        const model = await loadTensorflowModel({ url: config.url }, []);
        const input = model.inputs[0];
        const output = model.outputs[0];
        if (!input || !output) throw new Error('Remote model has no input or output tensor.');
        validateManifestAgainstTensors(manifest, input, output);
        return { model, manifest };
      } catch (err) {
        console.warn(`Failed loading remote model ${activeVersion}, falling back to bundled v0:`, err);
        await rollbackToBundledFallback();
        return loadBundledDetector();
      }
    })().catch(async () => {
      activeModelPromise = undefined;
      return loadBundledDetector();
    });
  }

  return activeModelPromise;
}

async function prepareJpeg(uri: string, width: number, height: number, manifest: ModelManifest): Promise<{ image: RgbaImage; encodedWidth: number; encodedHeight: number }> {
  const target = manifest.input;
  const actions = manifest.input.resize === 'centre_crop'
    ? [{ crop: { originX: Math.max(0, (width - Math.min(width, height)) / 2), originY: Math.max(0, (height - Math.min(width, height)) / 2), width: Math.min(width, height), height: Math.min(width, height) } }, { resize: { width: target.width, height: target.height } }]
    : width / height > target.width / target.height
      ? [{ resize: { width: target.width } }]
      : [{ resize: { height: target.height } }];
  const output = await manipulateAsync(uri, actions, { base64: true, compress: 1, format: SaveFormat.JPEG });
  if (!output.base64) throw new Error('The image could not be decoded for offline scanning.');
  const decoded = jpeg.decode(toByteArray(output.base64), { useTArray: true });
  return { image: { width: decoded.width, height: decoded.height, data: decoded.data }, encodedWidth: output.width, encodedHeight: output.height };
}

export async function scanPhoto(uri: string, width: number, height: number): Promise<ScanResult> {
  const { model, manifest } = await loadActiveDetector();
  const preprocessStart = globalThis.performance?.now?.() ?? Date.now();
  const prepared = await prepareJpeg(uri, width, height, manifest);
  const input = createInputTensor(prepared.image, manifest);
  const originalTransform = createTransform(width, height, manifest.input.resize, manifest.input.width, manifest.input.height);
  const preprocessMs = (globalThis.performance?.now?.() ?? Date.now()) - preprocessStart;
  const inferenceStart = globalThis.performance?.now?.() ?? Date.now();
  const outputs = await model.run([input.buffer]);
  const inferenceMs = (globalThis.performance?.now?.() ?? Date.now()) - inferenceStart;
  if (!outputs[0]) throw new Error('The detector returned no output tensor.');
  const decodeStart = globalThis.performance?.now?.() ?? Date.now();
  const raw = decodeYoloOutput(new Float32Array(outputs[0]), manifest, originalTransform);
  const kept = manifest.output.postprocess_in_model ? raw : classWiseNms(raw, manifest.nms.iou, manifest.nms.max_boxes);
  const detections = toDetections(kept, manifest);
  const decodeNmsMs = (globalThis.performance?.now?.() ?? Date.now()) - decodeStart;
  return { detections, timings: { preprocessMs, inferenceMs, decodeNmsMs }, imageWidth: width, imageHeight: height, manifest };
}
