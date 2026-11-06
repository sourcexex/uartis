import { describe, expect, it } from 'vitest';
import { resolveReducedTransparency } from './glass';

describe('glass fallback', () => {
  it('honours an explicit user preference', () => {
    expect(resolveReducedTransparency('true', false, true)).toBe(true);
    expect(resolveReducedTransparency('false', true, false)).toBe(false);
  });

  it('follows the OS preference when the user has not chosen', () => {
    expect(resolveReducedTransparency(null, true, true)).toBe(true);
    expect(resolveReducedTransparency(null, false, true)).toBe(false);
  });

  it('falls back to solid when backdrop-filter is unsupported', () => {
    expect(resolveReducedTransparency(null, false, false)).toBe(true);
  });
});
