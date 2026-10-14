export const DETECTOR_LABELS = ['metal', 'trash', 'glass', 'paper', 'cardboard', 'plastic', 'biological'] as const;
export const CONDITIONS = ['clean_dry', 'contaminated_wet', 'broken_unsafe', 'unknown'] as const;
export const MANUAL_HAZARDS = ['batteries', 'bulbs', 'e_waste', 'chemicals', 'sharp_objects', 'other_hazards'] as const;
export const LOCALES = ['en-MY'] as const;
export const QUANTITY_BANDS = ['1', '2-5', '6+'] as const;
export type Condition = typeof CONDITIONS[number];
export type GuidanceClass = typeof DETECTOR_LABELS[number] | `hazard:${typeof MANUAL_HAZARDS[number]}`;
export type QuantityBand = typeof QUANTITY_BANDS[number];
export type GuidanceRequest = { locale: typeof LOCALES[number]; rule_set_id: string; rule_set_version: number; item: { class: GuidanceClass; condition: Condition; quantity_band: QuantityBand } };
export type AdviceFields = { preparation: string; disposal: string; safety_warning: string | null; confirmation_required: boolean };

const acceptedClasses = new Set<string>([...DETECTOR_LABELS, ...MANUAL_HAZARDS.map((key) => `hazard:${key}`)]);
const forbiddenTerms = ['eligibility', 'classification', 'user_id', 'image', 'address', 'coordinates', 'note', 'prompt'];

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
  if (typeof value.item.class !== 'string' || !acceptedClasses.has(value.item.class)) return null;
  if (!(CONDITIONS as readonly unknown[]).includes(value.item.condition)) return null;
  if (!(QUANTITY_BANDS as readonly unknown[]).includes(value.item.quantity_band)) return null;
  return value as GuidanceRequest;
}

export function makeCacheKey(request: GuidanceRequest): string {
  return [request.locale, request.rule_set_id, String(request.rule_set_version), request.item.class, request.item.condition, request.item.quantity_band].join('|');
}

export function buildPromptPayload(request: GuidanceRequest, localRule: string, reference: Pick<AdviceFields, 'preparation' | 'disposal'>) {
  return {
    locale: request.locale,
    class: request.item.class,
    condition: request.item.condition,
    quantity_band: request.item.quantity_band,
    local_rule: localRule,
    reviewed_preparation_reference: reference.preparation,
    reviewed_disposal_reference: reference.disposal,
  };
}

export function isTransientFailure(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export function isTransientException(error: unknown): boolean {
  return error instanceof TypeError || (isRecord(error) && (error.name === 'AbortError' || error.name === 'TimeoutError'));
}

export function selectGuidanceOutcome(input: {
  cached: unknown;
  template: AdviceFields;
  llmEnabled: boolean;
  apiKeyAvailable: boolean;
  budgetReserved?: boolean;
  generated?: unknown;
}) {
  const cached = validateAdvice(input.cached);
  if (cached) return { next: 'return' as const, advice: cached, source: 'cache' as const, cache: false };
  if (!input.llmEnabled || !input.apiKeyAvailable) return { next: 'return' as const, advice: input.template, source: 'fallback' as const, cache: true };
  if (input.budgetReserved === undefined) return { next: 'reserve' as const };
  if (!input.budgetReserved) return { next: 'return' as const, advice: input.template, source: 'fallback' as const, cache: false };
  if (input.generated === undefined) return { next: 'generate' as const };
  const generated = validateAdvice(input.generated);
  if (!generated) return { next: 'return' as const, advice: input.template, source: 'fallback' as const, cache: false };
  return { next: 'return' as const, advice: generated, source: 'generated' as const, cache: true };
}

export function validateAdvice(value: unknown): AdviceFields | null {
  if (!isRecord(value) || !hasExactly(value, ['preparation', 'disposal', 'safety_warning', 'confirmation_required'])) return null;
  if (!isShortText(value.preparation, 240) || !isShortText(value.disposal, 320)) return null;
  if (value.safety_warning !== null && !isShortText(value.safety_warning, 220)) return null;
  if (typeof value.confirmation_required !== 'boolean') return null;
  const text = [value.preparation, value.disposal, value.safety_warning ?? ''].join(' ').toLowerCase();
  if (forbiddenTerms.some((term) => text.includes(term))) return null;
  if (/(put|place|mix|pour|burn|break|crush|open).{0,30}(battery|chemical|sharp|broken glass|unknown substance)/i.test(text)) return null;
  return value as AdviceFields;
}

export function isManualHazard(value: string): boolean {
  return value.startsWith('hazard:') && acceptedClasses.has(value);
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
