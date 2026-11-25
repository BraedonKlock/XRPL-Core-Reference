import { describe, expect, it } from 'vitest';
import { createInMemorySourceFileReader } from '../../parsing/source-files.js';
import { location, variableSymbol } from '../../../../tests/helpers/symbol-builders.js';
import {
  CORRECT_MACRO_LOCATION_LINES,
  correctMacroLocationLines,
  macroInvocationNamesOf,
} from './correct-macro-location-lines.js';

const SFIELDS = 'include/xrpl/protocol/detail/sfields.macro';
const FEATURES = 'include/xrpl/protocol/detail/features.macro';
const SOURCE = createInMemorySourceFileReader({
  [SFIELDS]: [
    'TYPED_SFIELD(sfAccount,                  ACCOUNT,    1)',
    'TYPED_SFIELD(sfOwner,                    ACCOUNT,    2)',
    'TYPED_SFIELD(sfAMMID,                    UINT256,   14,',
    '    SField::kSmdPseudoAccount | SField::kSmdDefault)',
    '',
    '// 256-bit (uncommon)',
  ].join('\n'),
  [FEATURES]: [
    'XRPL_FIX    (Cleanup3_6_0,                Supported::Yes, VoteBehavior::DefaultNo)',
    'XRPL_FEATURE(Cosign, Supported::No, VoteBehavior::DefaultNo)',
    '',
  ].join('\n'),
});

function macroVariable(name, file, line) {
  return variableSymbol({ id: name, qualifiedName: `xrpl::${name}`, location: location(file, line) });
}

describe(CORRECT_MACRO_LOCATION_LINES, () => {
  it('keeps lines that already mention the symbol', () => {
    const owner = macroVariable('sfOwner', SFIELDS, 2);
    expect(correctMacroLocationLines([owner], { sourceFiles: SOURCE }).applied).toHaveLength(0);
    expect(owner.location.declaration.line).toBe(2);
  });

  it('moves a line reported just after a single-line invocation', () => {
    const account = macroVariable('sfAccount', SFIELDS, 2);
    const result = correctMacroLocationLines([account], { sourceFiles: SOURCE });
    expect(account.location.declaration.line).toBe(1);
    expect(account.corrections).toEqual([CORRECT_MACRO_LOCATION_LINES]);
    expect(result.applied).toHaveLength(1);
  });

  it('moves a line reported after a multi-line invocation to the invocation start', () => {
    const ammId = macroVariable('sfAMMID', SFIELDS, 5);
    correctMacroLocationLines([ammId], { sourceFiles: SOURCE });
    expect(ammId.location.declaration.line).toBe(3);
  });

  it('matches token-pasted names against the macro argument', () => {
    const cosign = macroVariable('featureCosign', FEATURES, 3);
    const cleanup = macroVariable('fixCleanup3_6_0', FEATURES, 2);
    correctMacroLocationLines([cosign, cleanup], { sourceFiles: SOURCE });
    expect(cosign.location.declaration.line).toBe(2);
    expect(cleanup.location.declaration.line).toBe(1);
    expect(macroInvocationNamesOf('retiredFeatureAMM')).toContain('AMM');
    expect(macroInvocationNamesOf('fixture')).toEqual(['fixture']);
  });

  it('removes a line it cannot verify and reports it', () => {
    const unknown = macroVariable('sfUnknown', SFIELDS, 6);
    const result = correctMacroLocationLines([unknown], { sourceFiles: SOURCE });
    expect(unknown.location.declaration).toEqual({ file: SFIELDS, line: null });
    expect(result.unresolved).toHaveLength(1);
  });

  it('ignores positions outside .macro files', () => {
    const header = macroVariable('sfAccount', 'include/xrpl/protocol/SField.h', 99);
    expect(correctMacroLocationLines([header], { sourceFiles: SOURCE }).applied).toHaveLength(0);
  });
});
