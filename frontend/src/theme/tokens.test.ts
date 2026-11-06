import { describe, expect, it } from 'vitest';
import { themeColors } from './tokens';

describe('theme tokens', () => {
  it('exposes only CSS variables so light/dark stay CSS-driven', () => {
    for (const [name, value] of Object.entries(themeColors)) {
      expect(value, `${name} must be a --app-* CSS variable`).toMatch(/^var\(--app-[a-z0-9-]+\)$/);
    }
  });
});
