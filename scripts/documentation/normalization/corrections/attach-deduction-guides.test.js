import { describe, expect, it } from 'vitest';
import {
  classSymbol,
  functionSymbol,
  location,
  parameter,
} from '../../../../tests/helpers/symbol-builders.js';
import { ATTACH_DEDUCTION_GUIDES, attachDeductionGuides } from './attach-deduction-guides.js';

const TEMPLATE_PARAMETERS = [{ type: [{ text: 'class' }], name: 'EF', defaultValue: null }];

function scopeExitGuide(overrides = {}) {
  return functionSymbol({
    id: 'guide',
    qualifiedName: 'xrpl::ScopeExit',
    ownerId: 'namespacexrpl',
    returnType: null,
    templateParameters: TEMPLATE_PARAMETERS,
    parameters: [parameter('EF')],
    location: location('include/xrpl/basics/scope.h', 65),
    origin: { ownerKind: 'namespace', argsString: '(EF) -> ScopeExit< EF >' },
    ...overrides,
  });
}

describe(ATTACH_DEDUCTION_GUIDES, () => {
  it('attaches a deduction guide to its class template', () => {
    const scopeExit = classSymbol({
      id: 'scopeexit',
      qualifiedName: 'xrpl::ScopeExit',
      ownerId: 'namespacexrpl',
      templateParameters: TEMPLATE_PARAMETERS,
    });
    const result = attachDeductionGuides([scopeExit, scopeExitGuide()]);
    expect(result.symbols).toEqual([scopeExit]);
    expect(scopeExit.deductionGuides).toEqual([
      {
        templateParameters: TEMPLATE_PARAMETERS,
        parameters: [parameter('EF')],
        resultText: 'ScopeExit< EF >',
        location: { file: 'include/xrpl/basics/scope.h', line: 65 },
      },
    ]);
    expect(scopeExit.corrections).toEqual([ATTACH_DEDUCTION_GUIDES]);
  });

  it('leaves functions with trailing return types of other names untouched', () => {
    const scopeExit = classSymbol({
      id: 'scopeexit',
      qualifiedName: 'xrpl::ScopeExit',
      ownerId: 'namespacexrpl',
      templateParameters: TEMPLATE_PARAMETERS,
    });
    const other = scopeExitGuide({
      origin: { ownerKind: 'namespace', argsString: '(EF) -> OtherType< EF >' },
    });
    expect(attachDeductionGuides([scopeExit, other]).symbols).toHaveLength(2);
  });

  it('requires a class template with the same name in the same scope', () => {
    const nonTemplate = classSymbol({
      id: 'scopeexit',
      qualifiedName: 'xrpl::ScopeExit',
      ownerId: 'namespacexrpl',
    });
    expect(attachDeductionGuides([nonTemplate, scopeExitGuide()]).applied).toHaveLength(0);
  });
});
