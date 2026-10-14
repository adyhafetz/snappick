import type { Condition } from '../detector/types';
import { CONDITIONS, DETECTOR_LABELS, MANUAL_SAFETY_LABELS, type ManualSafetyKey } from '../detector/rules';

export const LOCALES = ['en-MY'] as const;
export const QUANTITY_BANDS = ['1', '2-5', '6+'] as const;
export type GuidanceClass = typeof DETECTOR_LABELS[number] | `hazard:${ManualSafetyKey}`;
export type QuantityBand = typeof QUANTITY_BANDS[number];
export type GuidanceRequest = { locale: typeof LOCALES[number]; rule_set_id: string; rule_set_version: number; item: { class: GuidanceClass; condition: Condition; quantity_band: QuantityBand } };
export type AdviceFields = { preparation: string; disposal: string; safety_warning: string | null; confirmation_required: boolean };
export type AdviceSource = 'cache' | 'generated' | 'reviewed' | 'fallback';
export type GuidanceResponse = AdviceFields & { source: AdviceSource; rule_set_id: string; rule_set_version: number; locale: string; cache_key?: string };

const safeClass = new Set<string>([...DETECTOR_LABELS, ...Object.keys(MANUAL_SAFETY_LABELS).map((key) => `hazard:${key}`)]);
const noAdvice = new Set(['eligibility', 'material', 'classification', 'user_id', 'image', 'address', 'coordinates', 'note', 'prompt']);

export function normalizeQuantityBand(value: unknown): QuantityBand | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(amount) || amount < 1) return null;
  return amount === 1 ? '1' : amount <= 5 ? '2-5' : '6+';
}

export function validateGuidanceRequest(value: unknown): GuidanceRequest | null {
  if (!isRecord(value) || !hasExactly(value, ['locale', 'rule_set_id', 'rule_set_version', 'item'])) return null;
  if (!(LOCALES as readonly unknown[]).includes(value.locale)) return null;
  if (typeof value.rule_set_id !== 'string' || !/^[a-z0-9_-]{1,64}$/.test(value.rule_set_id)) return null;
  if (!Number.isSafeInteger(value.rule_set_version) || Number(value.rule_set_version) < 1) return null;
  if (!isRecord(value.item) || !hasExactly(value.item, ['class', 'condition', 'quantity_band'])) return null;
  if (typeof value.item.class !== 'string' || !safeClass.has(value.item.class)) return null;
  if (!(CONDITIONS as readonly unknown[]).includes(value.item.condition)) return null;
  if (!(QUANTITY_BANDS as readonly unknown[]).includes(value.item.quantity_band)) return null;
  return value as GuidanceRequest;
}

export function makeCacheKey(request: GuidanceRequest): string {
  return [request.locale, request.rule_set_id, String(request.rule_set_version), request.item.class, request.item.condition, request.item.quantity_band].join('|');
}

export function validateAdvice(value: unknown): AdviceFields | null {
  if (!isRecord(value) || !hasExactly(value, ['preparation', 'disposal', 'safety_warning', 'confirmation_required'])) return null;
  if (!isShortText(value.preparation, 240) || !isShortText(value.disposal, 320)) return null;
  if (value.safety_warning !== null && !isShortText(value.safety_warning, 220)) return null;
  if (typeof value.confirmation_required !== 'boolean') return null;
  const text = [value.preparation, value.disposal, value.safety_warning ?? ''].join(' ').toLowerCase();
  if ([...noAdvice].some((term) => text.includes(term))) return null;
  if (/(put|place|mix|pour|burn|break|crush|open).{0,30}(battery|chemical|sharp|broken glass|unknown substance)/i.test(text)) return null;
  return value as AdviceFields;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactly(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isShortText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}
