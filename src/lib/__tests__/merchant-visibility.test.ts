import { describe, expect, it } from 'vitest';
import {
  getMissingDiscoverProfileFields,
  isMerchantProfileComplete,
  type MerchantProfileLike,
} from '../merchant-visibility';

const completeProfile: MerchantProfileLike = {
  business_name: 'Loyal Café',
  description: 'Coffee and fresh pastries',
  logo_url: 'https://example.com/logo.png',
  location: 'New York, NY',
};

describe('merchant Discover visibility', () => {
  it('requires business name, description, logo, and location', () => {
    expect(getMissingDiscoverProfileFields(undefined)).toEqual([
      'Business name',
      'Description',
      'Logo',
      'Location',
    ]);
  });

  it.each([
    ['business_name', 'Business name'],
    ['description', 'Description'],
    ['logo_url', 'Logo'],
    ['location', 'Location'],
  ] as const)('reports a missing %s', (key, label) => {
    const profile = { ...completeProfile, [key]: '   ' };
    expect(getMissingDiscoverProfileFields(profile)).toEqual([label]);
    expect(isMerchantProfileComplete(profile)).toBe(false);
  });

  it('marks a fully completed profile as visible', () => {
    expect(getMissingDiscoverProfileFields(completeProfile)).toEqual([]);
    expect(isMerchantProfileComplete(completeProfile)).toBe(true);
  });
});
import { getDiscoverBlockers } from '../merchant-visibility';

const ok = { has_paid_plan: true, has_active_program: true, is_banned: false, is_agent: false };
const full = {
  business_name: 'Loyal Café', description: 'Coffee', logo_url: 'https://x/l.png', location: 'NY',
};

describe('Discover listing blockers', () => {
  it('lists nothing for a complete paid live merchant', () => {
    expect(getDiscoverBlockers(full, 'in_store', ok)).toEqual([]);
  });
  it('requires a paid plan (trial does not count)', () => {
    expect(getDiscoverBlockers(full, 'online', { ...ok, has_paid_plan: false })).toEqual([
      'Active paid plan (trial does not count)',
    ]);
  });
  it('requires an active program', () => {
    expect(getDiscoverBlockers(full, 'in_store', { ...ok, has_active_program: false })).toHaveLength(1);
  });
  it('never lists AI agent merchants', () => {
    expect(getDiscoverBlockers(full, 'agent', ok)).toEqual(['AI agent merchants are not listed in Discover']);
    expect(getDiscoverBlockers(full, 'in_store', { ...ok, is_agent: true })).toHaveLength(1);
  });
});
