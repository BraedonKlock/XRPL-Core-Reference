import { describe, expect, it } from 'vitest';
import { symbolPathFromPathname, symbolUrl } from './routes.js';

describe('symbol routes', () => {
  it('builds symbol URLs with optional fragments', () => {
    expect(symbolUrl('xrpl/ApplyContext')).toBe('/symbols/xrpl/ApplyContext');
    expect(symbolUrl('xrpl/TERcodes', 'terRETRY')).toBe('/symbols/xrpl/TERcodes#terRETRY');
  });

  it('keeps percent-encoded segments exactly as published', () => {
    expect(symbolPathFromPathname('/symbols/std/hash%3Cxrpl%3A%3AAccountID%3E')).toBe(
      'std/hash%3Cxrpl%3A%3AAccountID%3E',
    );
    expect(symbolPathFromPathname('/symbols/xrpl/ApplyContext/')).toBe('xrpl/ApplyContext');
  });

  it('ignores non-symbol routes', () => {
    expect(symbolPathFromPathname('/')).toBeNull();
    expect(symbolPathFromPathname('/symbols/')).toBeNull();
  });
});
