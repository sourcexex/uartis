import { describe, expect, it } from 'vitest';

import en from './translations/en.json';
import zhCN from './translations/zh-CN.json';

type TranslationNode = string | { [key: string]: TranslationNode };

function flatten(node: TranslationNode, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result.set(path, value);
    } else {
      for (const [nestedKey, nestedValue] of flatten(value, path)) {
        result.set(nestedKey, nestedValue);
      }
    }
  }
  return result;
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

describe('i18n translations', () => {
  const enKeys = flatten(en);
  const zhKeys = flatten(zhCN);

  it('has the same keys in English and Simplified Chinese', () => {
    expect([...zhKeys.keys()].sort()).toEqual([...enKeys.keys()].sort());
  });

  it('has the same interpolation placeholders in both locales', () => {
    for (const [key, enValue] of enKeys) {
      const zhValue = zhKeys.get(key);
      expect(zhValue, `missing zh-CN value for ${key}`).toBeDefined();
      expect(placeholders(zhValue ?? ''), `placeholder mismatch for ${key}`).toEqual(placeholders(enValue));
    }
  });

  it('does not ship empty translations', () => {
    for (const [key, value] of [...enKeys, ...zhKeys]) {
      expect(value.trim(), `empty translation for ${key}`).not.toBe('');
    }
  });
});
