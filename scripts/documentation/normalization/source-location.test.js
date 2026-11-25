import { describe, expect, it } from 'vitest';
import { sourceLocationFromAttributes } from './source-location.js';

describe('source locations', () => {
  it('maps a header declaration with a separate body', () => {
    expect(
      sourceLocationFromAttributes({
        file: 'include/xrpl/tx/ApplyContext.h',
        line: '30',
        bodyfile: 'src/libxrpl/tx/ApplyContext.cpp',
        bodystart: '22',
        bodyend: '44',
      }),
    ).toEqual({
      declaration: { file: 'include/xrpl/tx/ApplyContext.h', line: 30 },
      definition: { file: 'src/libxrpl/tx/ApplyContext.cpp', line: 22, endLine: 44 },
    });
  });

  it('treats declfile as the declaration for out-of-line variable definitions', () => {
    expect(
      sourceLocationFromAttributes({
        file: 'src/libxrpl/protocol/Rate2.cpp',
        line: '12',
        declfile: 'include/xrpl/protocol/Rate.h',
        declline: '80',
      }),
    ).toEqual({
      declaration: { file: 'include/xrpl/protocol/Rate.h', line: 80 },
      definition: { file: 'src/libxrpl/protocol/Rate2.cpp', line: 12, endLine: null },
    });
  });

  it('rejects generated locations and ignores missing body ends', () => {
    expect(sourceLocationFromAttributes({ file: '[generated]', line: '1' })).toBeNull();
    expect(
      sourceLocationFromAttributes({
        file: 'a.h',
        line: '61',
        bodyfile: 'a.h',
        bodystart: '61',
        bodyend: '-1',
      }).definition,
    ).toEqual({ file: 'a.h', line: 61, endLine: null });
  });
});
