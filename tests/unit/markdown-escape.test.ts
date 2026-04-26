import { describe, it, expect } from 'vitest';
import { escapeMd } from '@/lib/telegram-escape';

describe('escapeMd', () => {
  it('TC-ESC-01: escapes special chars in realistic incident description', () => {
    const input = 'API errors: 100% of requests failed (status=503) [see details].';
    const result = escapeMd(input);
    expect(result).toContain('\\(');
    expect(result).toContain('\\)');
    expect(result).toContain('\\[');
    expect(result).toContain('\\]');
    expect(result).toContain('\\=');
    expect(result).toContain('\\.');
  });

  it('TC-ESC-02: does not double-escape already escaped backslashes', () => {
    const input = 'Already escaped\\.';
    const result = escapeMd(input);
    // The backslash itself is not in SPECIAL_CHARS, so it's unchanged;
    // the dot gets escaped → '\\\.'
    expect(result).toBe('Already escaped\\\\.');
  });

  it('TC-ESC-03: returns empty string for empty input', () => {
    expect(escapeMd('')).toBe('');
  });

  it('TC-ESC-04: returns plain text unchanged when no special chars', () => {
    const input = 'All systems operational';
    expect(escapeMd(input)).toBe(input);
  });

  it('TC-ESC-05: escapes each special character individually', () => {
    const specials = ['_', '*', '[', ']', '(', ')', '~', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    for (const char of specials) {
      expect(escapeMd(char)).toBe(`\\${char}`);
    }
  });
});
