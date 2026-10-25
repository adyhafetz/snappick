import { describe, expect, it } from 'vitest';
import { getLocalRecyclingFallback } from './snapbotCore';

describe('SnapBot recycling guidance fallback', () => {
  it('identifies oily pizza boxes as non-recyclable residual waste', () => {
    const reply = getLocalRecyclingFallback('Can I recycle greasy pizza boxes?');
    expect(reply.toLowerCase()).toContain('pizza');
    expect(reply.toLowerCase()).toContain('trash');
  });

  it('instructs removing caps and crushing plastic bottles', () => {
    const reply = getLocalRecyclingFallback('Should I keep the cap on?');
    expect(reply).toContain('cap');
    expect(reply).toContain('squash');
  });

  it('warns strictly against placing batteries and e-waste in community pickup', () => {
    const reply = getLocalRecyclingFallback('Can I put my old phone battery in the pickup?');
    expect(reply).toContain('hazardous');
    expect(reply.toLowerCase()).toContain('never');
  });

  it('provides general recycling guidance when query is general', () => {
    const reply = getLocalRecyclingFallback('Hello how does recycling work?', 'Cardboard');
    expect(reply).toContain('Cardboard');
    expect(reply.toLowerCase()).toContain('clean');
  });
});
