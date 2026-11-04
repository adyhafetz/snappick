import { describe, expect, it } from 'vitest';
import { getStatusConfig, getStatusLabel, isStatusActive } from './status';

describe('Pickup Status Utilities', () => {
  it('correctly identifies active statuses', () => {
    expect(isStatusActive('pending')).toBe(true);
    expect(isStatusActive('accepted')).toBe(true);
    expect(isStatusActive('in_progress')).toBe(true);
    expect(isStatusActive('awaiting_confirmation')).toBe(true);

    expect(isStatusActive('completed')).toBe(false);
    expect(isStatusActive('confirmed')).toBe(false);
    expect(isStatusActive('cancelled')).toBe(false);
    expect(isStatusActive('disputed')).toBe(false);
    expect(isStatusActive('not_collected')).toBe(false);
  });

  it('formats labels according to role', () => {
    expect(getStatusLabel('pending', 'requester')).toBe('Pending');
    expect(getStatusLabel('pending', 'collector')).toBe('Pending');

    expect(getStatusLabel('accepted', 'requester')).toBe('Assigned');
    expect(getStatusLabel('accepted', 'collector')).toBe('Claimed');

    expect(getStatusLabel('in_progress', 'requester')).toBe('In Progress');
    expect(getStatusLabel('in_progress', 'collector')).toBe('In Progress');

    expect(getStatusLabel('awaiting_confirmation', 'requester')).toBe('Review');
    expect(getStatusLabel('awaiting_confirmation', 'collector')).toBe('Review');

    expect(getStatusLabel('completed')).toBe('Completed');
    expect(getStatusLabel('confirmed')).toBe('Completed');
    expect(getStatusLabel('cancelled')).toBe('Cancelled');
    expect(getStatusLabel('disputed')).toBe('Disputed');
    expect(getStatusLabel('not_collected')).toBe('Disputed');
  });

  it('provides color configuration for each status', () => {
    const pendingConfig = getStatusConfig('pending', 'requester');
    expect(pendingConfig.containerClass).toContain('amber');
    expect(pendingConfig.dotClass).toContain('amber');
    expect(pendingConfig.label).toBe('Pending');

    const acceptedConfig = getStatusConfig('accepted', 'collector');
    expect(acceptedConfig.containerClass).toContain('blue');
    expect(acceptedConfig.dotClass).toContain('blue');
    expect(acceptedConfig.label).toBe('Claimed');

    const inProgressConfig = getStatusConfig('in_progress');
    expect(inProgressConfig.containerClass).toContain('blue');
    expect(inProgressConfig.dotClass).toContain('blue');
    expect(inProgressConfig.label).toBe('In Progress');

    const completedConfig = getStatusConfig('completed');
    expect(completedConfig.containerClass).toContain('emerald');
    expect(completedConfig.dotClass).toContain('emerald');

    const cancelledConfig = getStatusConfig('cancelled');
    expect(cancelledConfig.containerClass).toContain('zinc');

    const disputedConfig = getStatusConfig('disputed');
    expect(disputedConfig.containerClass).toContain('rose');
    expect(disputedConfig.label).toBe('Disputed');
  });

  it('handles unknown statuses safely with sensible defaults', () => {
    const unknownConfig = getStatusConfig('unknown_status');
    expect(unknownConfig.label).toBe('unknown status');
    expect(unknownConfig.containerClass).toContain('secondary');
  });
});

