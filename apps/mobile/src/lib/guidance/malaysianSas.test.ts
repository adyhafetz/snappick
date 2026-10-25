import { describe, expect, it } from 'vitest';
import { getSasGuide, MALAYSIAN_SAS_GUIDES, type SasClass } from './malaysianSas';
import { DETECTOR_LABELS } from '../detector/rules';

describe('Malaysian SAS Guide dictionary', () => {
  it('covers all 7 detector labels exactly without missing any', () => {
    expect(DETECTOR_LABELS).toEqual([
      'metal',
      'trash',
      'glass',
      'paper',
      'cardboard',
      'plastic',
      'biological',
    ]);

    for (const label of DETECTOR_LABELS) {
      const guide = MALAYSIAN_SAS_GUIDES[label as SasClass];
      expect(guide).toBeDefined();
      expect(guide.className).toBe(label);
      expect(guide.displayName.length).toBeGreaterThan(0);
      expect(guide.malayName.length).toBeGreaterThan(0);
      expect(guide.steps.length).toBe(3);
      expect(guide.steps[0].title.length).toBeGreaterThan(0);
      expect(guide.steps[1].title.length).toBeGreaterThan(0);
      expect(guide.steps[2].title.length).toBeGreaterThan(0);
      expect(guide.importantNote.length).toBeGreaterThan(0);
      expect(guide.snapBotSuggestions.length).toBe(3);
    }
  });

  it('correctly categorizes recyclables vs residual waste according to Malaysian SAS rules', () => {
    // Under SAS: Paper, Cardboard, Plastic, Metal, Glass are dry recyclables
    expect(getSasGuide('cardboard').isRecyclable).toBe(true);
    expect(getSasGuide('paper').isRecyclable).toBe(true);
    expect(getSasGuide('plastic').isRecyclable).toBe(true);
    expect(getSasGuide('metal').isRecyclable).toBe(true);
    expect(getSasGuide('glass').isRecyclable).toBe(true);

    // Food/biological and general trash are residual waste
    expect(getSasGuide('biological').isRecyclable).toBe(false);
    expect(getSasGuide('trash').isRecyclable).toBe(false);
  });

  it('falls back gracefully to trash guide if an unknown class is supplied', () => {
    const unknown = getSasGuide('unknown_material');
    expect(unknown.className).toBe('trash');
  });
});
