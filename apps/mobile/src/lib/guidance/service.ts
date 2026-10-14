import type { Condition } from '../detector/types';
import type { ManualSafetyKey, RuleSet } from '../detector/rules';
import { supabase } from '../supabase';
import { bundledAdvice } from './presentation';
import type { GuidanceAdvice, GuidanceCard, GuidanceSource } from './presentation';

export type { GuidanceAdvice, GuidanceCard, GuidanceSource } from './presentation';

export async function requestGuidance(className: string, condition: Condition, ruleSet: RuleSet): Promise<GuidanceCard> {
  const local = bundledAdvice(className, condition);
  const base: GuidanceCard = { ...local, source: 'fallback', ruleSetId: ruleSet.id, ruleSetLabel: ruleSet.label, ruleSetVersion: ruleSet.version, offline: true };
  try {
    const { data, error } = await supabase.functions.invoke('get-guidance', {
      body: {
        locale: 'en-MY',
        rule_set_id: ruleSet.id,
        rule_set_version: ruleSet.version,
        item: { class: className, condition, quantity_band: '1' },
      },
    });
    if (error || !isGuidance(data) || data.rule_set_id !== ruleSet.id || data.rule_set_version !== ruleSet.version) return base;
    return { ...data, source: data.source, ruleSetId: ruleSet.id, ruleSetLabel: ruleSet.label, ruleSetVersion: ruleSet.version, offline: false };
  } catch {
    return base;
  }
}

export function parseRuleSet(value: unknown): RuleSet | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !Number.isInteger(value.version) || typeof value.label !== 'string' || !isRecord(value.classes)) return null;
  for (const entry of Object.values(value.classes)) {
    if (!isRecord(entry) || (entry.material !== 'recyclable' && entry.material !== 'not_recyclable') || !isRecord(entry.conditionRules)) return null;
  }
  return value as unknown as RuleSet;
}

function isGuidance(value: unknown): value is GuidanceAdvice & { source: GuidanceSource; rule_set_id: string; rule_set_version: number } {
  if (!isRecord(value)) return false;
  return typeof value.preparation === 'string' && typeof value.disposal === 'string'
    && (value.safety_warning === null || typeof value.safety_warning === 'string')
    && typeof value.confirmation_required === 'boolean'
    && ['cache', 'generated', 'reviewed', 'fallback'].includes(String(value.source))
    && typeof value.rule_set_id === 'string' && Number.isInteger(value.rule_set_version);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hazardGuidanceKey(key: ManualSafetyKey): string {
  return `hazard:${key}`;
}
