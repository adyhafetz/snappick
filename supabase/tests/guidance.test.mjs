import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import templates from '../seed/advice_templates.json' with { type: 'json' };
import { buildPromptPayload, isTransientException, isTransientFailure, makeCacheKey, normalizeQuantityBand, selectGuidanceOutcome, validateAdvice, validateGuidanceRequest } from '../functions/_shared/guidance.ts';

const labels = ['metal', 'trash', 'glass', 'paper', 'cardboard', 'plastic', 'biological'];
const conditions = ['clean_dry', 'contaminated_wet', 'broken_unsafe', 'unknown'];
const template = templates.items['paper:clean_dry'];
const request = (className = 'paper', condition = 'clean_dry', version = 2) => ({
  locale: 'en-MY',
  rule_set_id: 'perak_general',
  rule_set_version: version,
  item: { class: className, condition, quantity_band: '1' },
});

test('all seven detector labels and four condition states have bundled advice', () => {
  assert.deepEqual(labels, ['metal', 'trash', 'glass', 'paper', 'cardboard', 'plastic', 'biological']);
  for (const label of labels) for (const condition of conditions) assert.ok(templates.items[`${label}:${condition}`]);
});

test('manual hazard declarations and confirmation have separate advice', () => {
  for (const hazard of ['batteries', 'bulbs', 'e_waste', 'chemicals', 'sharp_objects', 'other_hazards']) {
    assert.ok(templates.items[`hazard:${hazard}`]);
    assert.ok(validateGuidanceRequest(request(`hazard:${hazard}`)));
  }
  assert.ok(templates.items.hazard_confirmation);
});

test('strict request validation and quantity normalization', () => {
  assert.ok(validateGuidanceRequest(request()));
  const canonical = { ...request(), item: { ...request().item, quantity_band: '2-5' } };
  assert.ok(validateGuidanceRequest(canonical));
  assert.equal(validateGuidanceRequest({ ...canonical, image: 'private' }), null);
  assert.equal(validateGuidanceRequest({ ...canonical, locale: 'fr-FR' }), null);
  assert.equal(normalizeQuantityBand(1), '1');
  assert.equal(normalizeQuantityBand(4), '2-5');
  assert.equal(normalizeQuantityBand(6), '6+');
  assert.equal(normalizeQuantityBand(-1), null);
});

test('cache identity has exactly the six public deterministic inputs and changes with rule version', () => {
  const first = { ...request(), item: { ...request().item, quantity_band: '1' } };
  const newer = { ...first, rule_set_version: 3 };
  assert.equal(makeCacheKey(first), 'en-MY|perak_general|2|paper|clean_dry|1');
  assert.notEqual(makeCacheKey(first), makeCacheKey(newer));
  assert.equal(makeCacheKey(first).split('|').length, 6);
});

test('cache, templates-only, generated, invalid output, budget cap, timeout fallback and transient retry decisions', () => {
  assert.equal(selectGuidanceOutcome({ cached: template, template, llmEnabled: true, apiKeyAvailable: true }).source, 'cache');
  assert.equal(selectGuidanceOutcome({ cached: null, template, llmEnabled: true, apiKeyAvailable: true }).next, 'reserve');
  assert.equal(selectGuidanceOutcome({ cached: null, template, llmEnabled: false, apiKeyAvailable: false }).source, 'fallback');
  assert.equal(selectGuidanceOutcome({ cached: null, template, llmEnabled: true, apiKeyAvailable: true, budgetReserved: false }).source, 'fallback');
  assert.equal(selectGuidanceOutcome({ cached: null, template, llmEnabled: true, apiKeyAvailable: true, budgetReserved: true, generated: template }).source, 'generated');
  assert.equal(selectGuidanceOutcome({ cached: null, template, llmEnabled: true, apiKeyAvailable: true, budgetReserved: true, generated: null }).source, 'fallback');
  assert.equal(isTransientFailure(429), true);
  assert.equal(isTransientFailure(503), true);
  assert.equal(isTransientFailure(400), false);
  assert.equal(isTransientException(new TypeError('network failure')), true);
  assert.equal(isTransientException({ name: 'TimeoutError' }), true);
  assert.equal(isTransientException(new SyntaxError('invalid JSON')), false);
  assert.equal(isTransientException(new Error('unexpected')), false);
});

test('prompt projection excludes user identity, images, notes, addresses and coordinates', () => {
  const input = { ...request(), item: { ...request().item, quantity_band: '1' } };
  const payload = buildPromptPayload(input, 'Clean paper only.', template);
  assert.deepEqual(Object.keys(payload).sort(), ['class', 'condition', 'locale', 'local_rule', 'quantity_band', 'reviewed_disposal_reference', 'reviewed_preparation_reference'].sort());
  assert.doesNotMatch(JSON.stringify(payload), /user_id|image|address|coordinate|pickup_note/i);
});

test('edge handler has no private-data logging and cache writes occur after structured validation', async () => {
  const source = await readFile(new URL('../functions/get-guidance/index.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /console\.(log|error|warn)/);
  assert.ok(source.indexOf('validateAdvice(JSON.parse(text))') < source.indexOf("admin.from('instruction_cache').upsert"));
  assert.ok(source.includes("eq('cache_key', cacheKey).gt('expires_at', now).maybeSingle()"));
});
