import { describe, expect, it } from 'vitest';
import { contrastText } from './color';

describe('contrastText', () => {
  it('uses dark text on light backgrounds', () => {
    expect(contrastText('#f5efe6')).toBe('#000000');
    expect(contrastText('#fff')).toBe('#000000');
  });

  it('uses light text on dark backgrounds', () => {
    expect(contrastText('#0b1a2a')).toBe('#FFFFFF');
    expect(contrastText('#000000')).toBe('#FFFFFF');
  });

  it('falls back to white for invalid colors', () => {
    expect(contrastText('not-a-color')).toBe('#FFFFFF');
  });
});
