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