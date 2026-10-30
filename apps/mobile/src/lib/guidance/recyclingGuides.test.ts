import { describe, expect, it } from 'vitest';
import { getRecyclingGuide, RECYCLING_GUIDES, type RecyclingGuideClass } from './recyclingGuides';
import { DETECTOR_LABELS } from '../detector/rules';

describe('Recycling guide dictionary', () => {
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
      const guide = RECYCLING_GUIDES[label as RecyclingGuideClass];
      expect(guide).toBeDefined();
      expect(guide.className).toBe(label);
      expect(guide.displayName.length).toBeGreaterThan(0);
      expect(guide.shortName.length).toBeGreaterThan(0);
      expect(guide.steps.length).toBe(3);
      expect(guide.steps[0].title.length).toBeGreaterThan(0);
      expect(guide.steps[1].title.length).toBeGreaterThan(0);
      expect(guide.steps[2].title.length).toBeGreaterThan(0);
      expect(guide.importantNote.length).toBeGreaterThan(0);
      expect(guide.snapBotSuggestions.length).toBe(3);
    }
  });

  it('correctly categorizes recyclables vs residual waste', () => {
    // Paper, cardboard, plastic, metal and glass are dry recyclables
    expect(getRecyclingGuide('cardboard').isRecyclable).toBe(true);
    expect(getRecyclingGuide('paper').isRecyclable).toBe(true);
    expect(getRecyclingGuide('plastic').isRecyclable).toBe(true);
    expect(getRecyclingGuide('metal').isRecyclable).toBe(true);
    expect(getRecyclingGuide('glass').isRecyclable).toBe(true);

    // Food/biological and general trash are residual waste
    expect(getRecyclingGuide('biological').isRecyclable).toBe(false);
    expect(getRecyclingGuide('trash').isRecyclable).toBe(false);
  });

  it('falls back gracefully to trash guide if an unknown class is supplied', () => {
    const unknown = getRecyclingGuide('unknown_material');
    expect(unknown.className).toBe('trash');
  });
});
