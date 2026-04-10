import { describe, it, expect } from 'vitest';
import { effectiveCategory } from './effective-category';

describe('effectiveCategory', () => {
  it('returns primary when it is cannabis-relevant', () => {
    expect(effectiveCategory({ primaryGoogleCategory: 'Dispensary' })).toBe('Dispensary');
  });

  it('promotes from additional when primary is not cannabis', () => {
    expect(effectiveCategory({
      primaryGoogleCategory: 'Gift Shop',
      additionalGoogleCategories: ['Smoke Shop', 'Art Gallery'],
    })).toBe('Smoke Shop');
  });

  it('falls back to primary when neither is cannabis', () => {
    expect(effectiveCategory({
      primaryGoogleCategory: 'Gift Shop',
      additionalGoogleCategories: ['Art Gallery'],
    })).toBe('Gift Shop');
  });

  it('falls back to business.category when primary is empty', () => {
    expect(effectiveCategory({ category: 'Custom' })).toBe('Custom');
  });

  it('returns "Other" when nothing is set', () => {
    expect(effectiveCategory({})).toBe('Other');
  });

  it('is case-insensitive for the allowlist check', () => {
    expect(effectiveCategory({ primaryGoogleCategory: 'SMOKE SHOP' })).toBe('SMOKE SHOP');
  });
});
