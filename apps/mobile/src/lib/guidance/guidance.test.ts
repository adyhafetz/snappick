import { describe, expect, it } from 'vitest';
import advice from '../../../assets/bundled_advice.json';
import { BUNDLED_RULE_SET, CONDITIONS, DETECTOR_LABELS, MANUAL_SAFETY_LABELS, evaluateEligibility } from '../detector/rules';
import { buildPromptPayload, isTransientFailure, makeCacheKey, normalizeQuantityBand, selectGuidanceOutcome, validateAdvice, validateGuidanceRequest } from '../../../../../supabase/functions/_shared/guidance';
import { bundledAdvice, resolveLocationRuleSet, resolvePreferredRuleSet, sourceBadge } from './presentation';

describe('Phase 6 guidance', () => {
  it('keeps the detector taxonomy and evaluates each label for every condition', () => {
    expect(DETECTOR_LABELS).toEqual(['metal', 'trash', 'glass', 'paper', 'cardboard', 'plastic', 'biological']);
    for (const label of DETECTOR_LABELS) {
      for (const condition of CONDITIONS) {
        expect(evaluateEligibility(label, condition, BUNDLED_RULE_SET).reason.length).toBeGreaterThan(0);
        expect(advice.items).toHaveProperty(`${label}:${condition}`);
      }
    }
    expect(evaluateEligibility('paper', 'clean_dry').eligibility).toBe('eligible');
    expect(evaluateEligibility('paper', 'contaminated_wet').eligibility).toBe('not_eligible');
    expect(evaluateEligibility('glass', 'broken_unsafe').eligibility).toBe('restricted');
  });

  it('keeps manual hazards separate and provides each reviewed safety template', () => {
    for (const hazard of Object.keys(MANUAL_SAFETY_LABELS)) {
      expect(advice.items).toHaveProperty(`hazard:${hazard}`);
      expect(validateGuidanceRequest(request(`hazard:${hazard}`))).not.toBeNull();
    }
    expect(advice.items).toHaveProperty('hazard_confirmation');
  });

  it('uses perak_general v2 as the local fallback and applies active rule-set decisions', () => {
    expect(BUNDLED_RULE_SET.id).toBe('perak_general');
    expect(BUNDLED_RULE_SET.version).toBe(2);
    const changed = { ...BUNDLED_RULE_SET, id: 'district_rules', version: 3, classes: { ...BUNDLED_RULE_SET.classes, paper: { ...BUNDLED_RULE_SET.classes.paper, conditionRules: { ...BUNDLED_RULE_SET.classes.paper.conditionRules, clean_dry: { eligibility: 'needs_confirmation' as const, reason: 'District review required.' } } } } };
    expect(evaluateEligibility('paper', 'clean_dry', changed)).toEqual({ eligibility: 'needs_confirmation', reason: 'District review required.' });
    expect(evaluateEligibility('unmapped', 'clean_dry', BUNDLED_RULE_SET).eligibility).toBe('not_eligible');
  });

  it('resolves last-confirmed rules first, then location rules, then perak_general fallback', () => {
    const district = { ...BUNDLED_RULE_SET, id: 'district_a', label: 'District A', version: 4 };
    expect(resolvePreferredRuleSet(district, BUNDLED_RULE_SET)).toBe(district);
    expect(resolvePreferredRuleSet(null, BUNDLED_RULE_SET)).toBe(BUNDLED_RULE_SET);
    expect(resolveLocationRuleSet(district, BUNDLED_RULE_SET)).toBe(district);
    expect(resolveLocationRuleSet(null, BUNDLED_RULE_SET)).toBe(BUNDLED_RULE_SET);
  });

  it('validates request fields and quantity bands, and creates deterministic privacy-limited cache keys', () => {
    expect(normalizeQuantityBand(1)).toBe('1');
    expect(normalizeQuantityBand(3)).toBe('2-5');
    expect(normalizeQuantityBand(6)).toBe('6+');
    expect(normalizeQuantityBand(0)).toBeNull();
    const input = request();
    expect(validateGuidanceRequest(input)).toEqual(input);
    expect(validateGuidanceRequest({ ...input, note: 'private' })).toBeNull();
    expect(validateGuidanceRequest({ ...input, locale: 'fr-FR' })).toBeNull();
    expect(makeCacheKey(input)).toBe('en-MY|perak_general|2|paper|clean_dry|1');
    expect(makeCacheKey({ ...input, rule_set_version: 3 })).not.toBe(makeCacheKey(input));
    expect(makeCacheKey(input).split('|')).toHaveLength(6);
  });

  it('rejects malformed and unsafe structured advice', () => {
    expect(validateAdvice({ preparation: 'Rinse and dry.', disposal: 'Ask locally.', safety_warning: null, confirmation_required: false })).not.toBeNull();
    expect(validateAdvice({ preparation: 'ok', disposal: 'ok', safety_warning: null, confirmation_required: false, extra: 'x' })).toBeNull();
    expect(validateAdvice({ preparation: 'Mix chemicals with water.', disposal: 'Ask locally.', safety_warning: null, confirmation_required: false })).toBeNull();
  });

  it('covers cache hit, miss, templates-only, generated, invalid-output, timeout, retry, and budget-cap outcomes', () => {
    const template = advice.items['paper:clean_dry'];
    const cached = selectGuidanceOutcome({ cached: template, template, llmEnabled: true, apiKeyAvailable: true });
    expect(cached).toMatchObject({ next: 'return', source: 'cache' });
    expect(selectGuidanceOutcome({ cached: null, template, llmEnabled: true, apiKeyAvailable: true })).toEqual({ next: 'reserve' });
    expect(selectGuidanceOutcome({ cached: null, template, llmEnabled: false, apiKeyAvailable: false })).toMatchObject({ source: 'fallback', cache: true });
    expect(selectGuidanceOutcome({ cached: null, template, llmEnabled: true, apiKeyAvailable: true, budgetReserved: false })).toMatchObject({ source: 'fallback', cache: false });
    expect(selectGuidanceOutcome({ cached: null, template, llmEnabled: true, apiKeyAvailable: true, budgetReserved: true, generated: template })).toMatchObject({ source: 'generated', cache: true });
    expect(selectGuidanceOutcome({ cached: null, template, llmEnabled: true, apiKeyAvailable: true, budgetReserved: true, generated: { malformed: true } })).toMatchObject({ source: 'fallback', cache: false });
    expect(selectGuidanceOutcome({ cached: null, template, llmEnabled: true, apiKeyAvailable: true, budgetReserved: true, generated: null })).toMatchObject({ source: 'fallback', cache: false });
    expect(isTransientFailure(429)).toBe(true);
    expect(isTransientFailure(503)).toBe(true);
    expect(isTransientFailure(400)).toBe(false);
  });

  it('limits the LLM prompt to guidance fields and rule context', () => {
    const payload = buildPromptPayload(validateGuidanceRequest(request())!, 'Check that paper is clean and dry.', { preparation: 'Keep clean.', disposal: 'Ask locally.' });
    expect(Object.keys(payload).sort()).toEqual(['class', 'condition', 'locale', 'local_rule', 'quantity_band', 'reviewed_disposal_reference', 'reviewed_preparation_reference'].sort());
    expect(JSON.stringify(payload)).not.toMatch(/user|image|address|coordinate|note/i);
  });

  it('shows distinguishable source badges including explicit offline fallback', () => {
    expect(sourceBadge('reviewed', false)).toBe('Reviewed');
    expect(sourceBadge('generated', false)).toBe('Generated');
    expect(sourceBadge('cache', false)).toBe('Cache');
    expect(sourceBadge('fallback', false)).toBe('Fallback');
    expect(sourceBadge('reviewed', true)).toBe('Offline · bundled');
  });

  it('returns bundled advice without a network dependency for airplane-mode scans', () => {
    const result = bundledAdvice('paper', 'clean_dry');
    expect(result.preparation).toContain('clean and dry');
    expect(bundledAdvice('hazard:batteries', 'unknown').disposal).toContain('Never place batteries');
  });

  it('has an offline fallback template and a complete condition matrix', () => {
    expect(advice.items.fallback.preparation).toBeTruthy();
    expect(Object.keys(advice.items).filter((key) => key.includes(':') && !key.startsWith('hazard:'))).toHaveLength(28);
  });
});

function request(className = 'paper') {
  return {
    locale: 'en-MY' as const,
    rule_set_id: 'perak_general',
    rule_set_version: 2,
    item: { class: className as 'paper', condition: 'clean_dry' as const, quantity_band: '1' as const },
  };
}
