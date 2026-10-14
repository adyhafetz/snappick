import bundled from '../../../assets/bundled_advice.json';
import type { Condition } from '../detector/types';
import type { RuleSet } from '../detector/rules';

export type GuidanceSource = 'cache' | 'generated' | 'reviewed' | 'fallback';
export type GuidanceAdvice = { preparation: string; disposal: string; safety_warning: string | null; confirmation_required: boolean };
export type GuidanceCard = GuidanceAdvice & { source: GuidanceSource; ruleSetId: string; ruleSetLabel: string; ruleSetVersion: number; offline: boolean };

export function bundledAdvice(className: string, condition: Condition): GuidanceAdvice {
  const items = bundled.items as Record<string, GuidanceAdvice>;
  return items[className.startsWith('hazard:') ? className : `${className}:${condition}`] ?? items.fallback;
}

export function sourceBadge(source: GuidanceSource, offline: boolean): string {
  return offline ? 'Offline · bundled' : source === 'fallback' ? 'Fallback' : source[0].toUpperCase() + source.slice(1);
}

export function resolvePreferredRuleSet(lastConfirmed: RuleSet | null, fallback: RuleSet): RuleSet {
  return lastConfirmed ?? fallback;
}

export function resolveLocationRuleSet(resolved: RuleSet | null, current: RuleSet): RuleSet {
  return resolved ?? current;
}
