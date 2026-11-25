import { describe, expect, it } from 'vitest';
import { functionSymbol, location, parameter, text } from '../../../../tests/helpers/symbol-builders.js';
import {
  isLiteralText,
  RECLASSIFY_LITERAL_INITIALIZED_CONSTANTS,
  reclassifyLiteralInitializedConstants,
} from './reclassify-literal-initialized-constants.js';

function jssAccount(overrides = {}) {
  return functionSymbol({
    id: 'jss-account',
    qualifiedName: 'xrpl::jss::Account',
    returnType: [{ text: '::json::StaticString', refId: 'classjson_1_1StaticString' }],
    parameters: [parameter('"Account"')],
    location: location('include/xrpl/protocol/jss.h', 28),
    origin: { ownerKind: 'namespace', argsString: '("Account")' },
    ...overrides,
  });
}

describe(RECLASSIFY_LITERAL_INITIALIZED_CONSTANTS, () => {
  it('reclassifies a constant initialized with a string literal', () => {
    const [variable] = reclassifyLiteralInitializedConstants([jssAccount()]).symbols;
    expect(variable).toMatchObject({
      kind: 'variable',
      qualifiedName: 'xrpl::jss::Account',
      type: [{ text: '::json::StaticString', refId: 'classjson_1_1StaticString' }],
      initializer: [{ text: '("Account")' }],
      corrections: [RECLASSIFY_LITERAL_INITIALIZED_CONSTANTS],
    });
  });

  it('joins multiple literal arguments', () => {
    const constant = jssAccount({ parameters: [parameter('1000'), parameter('"dropped"')] });
    expect(reclassifyLiteralInitializedConstants([constant]).symbols[0].initializer).toEqual([
      { text: '(1000, "dropped")' },
    ]);
  });

  it('keeps real function declarations', () => {
    const typed = jssAccount({ parameters: [parameter('int')] });
    const named = jssAccount({ parameters: [parameter('"Account"', 'name')] });
    const constructor = jssAccount({ role: 'constructor' });
    const result = reclassifyLiteralInitializedConstants([typed, named, constructor]);
    expect(result.symbols.map((symbol) => symbol.kind)).toEqual(['function', 'function', 'function']);
    expect(result.applied).toHaveLength(0);
  });

  it.each(['"x"', "'a'", '42', "1'000'000", '0x0070', '-1', '3.5e2', 'true', 'nullptr', 'u8"s"'])(
    'treats %s as a literal',
    (literal) => expect(isLiteralText(literal)).toBe(true),
  );

  it.each(['int', 'QUALITY_ONE', 'std::string', 'access', 'T&&'])('does not treat %s as a literal', (value) =>
    expect(isLiteralText(value)).toBe(false),
  );

  it('does not use the return type text when deciding', () => {
    expect(
      reclassifyLiteralInitializedConstants([jssAccount({ returnType: text('void'), parameters: [] })])
        .applied,
    ).toHaveLength(0);
  });
});
