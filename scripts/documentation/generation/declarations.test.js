import { describe, expect, it } from 'vitest';
import {
  classSymbol,
  functionSymbol,
  parameter,
  text,
  variableSymbol,
} from '../../../tests/helpers/symbol-builders.js';
import { expressionText } from '../normalization/type-expression.js';
import { declarationOf, deductionGuideDeclaration } from './declarations.js';

function declarationText(symbol) {
  return expressionText(declarationOf(symbol));
}

describe('declarations', () => {
  it('renders a const nodiscard method with linked return type', () => {
    const view = functionSymbol({
      name: 'view',
      qualifiedName: 'xrpl::ApplyContext::view',
      role: 'method',
      returnType: [{ text: 'ApplyView', refId: 'av' }, { text: ' const&' }],
    });
    view.qualifiers = { ...view.qualifiers, isConst: true, isNodiscard: true };
    const declaration = declarationOf(view);
    expect(expressionText(declaration)).toBe('[[nodiscard]]\nApplyView const& view() const');
    expect(declaration.find((token) => token.refId)).toEqual({ text: 'ApplyView', refId: 'av' });
  });

  it('renders deleted, pure virtual and explicit members', () => {
    const copy = functionSymbol({
      name: 'ApplyContext',
      qualifiedName: 'x',
      role: 'constructor',
      returnType: null,
      parameters: [parameter('ApplyContext const&')],
    });
    copy.qualifiers = { ...copy.qualifiers, isDeleted: true };
    expect(declarationText(copy)).toBe('ApplyContext(ApplyContext const&) = delete');

    const read = functionSymbol({
      name: 'read',
      qualifiedName: 'x',
      role: 'method',
      returnType: text('SLE::const_pointer'),
      parameters: [parameter('Keylet const&', 'k')],
    });
    read.qualifiers = { ...read.qualifiers, isConst: true, isPureVirtual: true, virtuality: 'pure-virtual' };
    expect(declarationText(read)).toBe('virtual SLE::const_pointer read(Keylet const& k) const = 0');

    const explicitConstructor = functionSymbol({
      name: 'Foo',
      qualifiedName: 'x',
      role: 'constructor',
      returnType: null,
      parameters: [parameter('beast::Journal', 'journal', { defaultValue: text('beast::Journal{}') })],
    });
    explicitConstructor.qualifiers = { ...explicitConstructor.qualifiers, isExplicit: true };
    expect(declarationText(explicitConstructor)).toBe(
      'explicit Foo(beast::Journal journal = beast::Journal{})',
    );
  });

  it('renders templates with requires clauses', () => {
    const insert = functionSymbol({
      name: 'insert',
      qualifiedName: 'x',
      role: 'method',
      templateParameters: [{ type: text('bool'), name: 'MaybeMulti', defaultValue: text('IsMulti') }],
      returnType: text('iterator'),
      parameters: [parameter('value_type const&', 'value')],
      requiresClause: text('MaybeMulti'),
    });
    expect(declarationText(insert)).toBe(
      'template <bool MaybeMulti = IsMulti>\niterator insert(value_type const& value)\n    requires MaybeMulti',
    );
  });

  it('renders classes, variables, aliases, enums and deduction guides', () => {
    const sttx = classSymbol({
      name: 'STTx',
      qualifiedName: 'xrpl::STTx',
      isFinal: true,
      baseClasses: [
        { name: 'STObject', refId: 'sto', access: 'public', isVirtual: false },
        { name: 'CountedObject< STTx >', refId: null, access: 'public', isVirtual: false },
      ],
    });
    expect(declarationText(sttx)).toBe('class STTx final : public STObject, public CountedObject< STTx >');

    const constant = variableSymbol({
      name: 'Account',
      qualifiedName: 'x',
      type: text('::json::StaticString'),
      initializer: text('("Account")'),
      qualifiers: { isStatic: false, isConstexpr: true, isMutable: false },
    });
    expect(declarationText(constant)).toBe('constexpr ::json::StaticString Account("Account")');
    const assigned = variableSymbol({
      name: 'kMax',
      qualifiedName: 'x',
      type: text('int'),
      initializer: text('= 5'),
    });
    expect(declarationText(assigned)).toBe('int kMax = 5');

    expect(
      declarationText({
        kind: 'typeAlias',
        name: 'TER',
        aliasStyle: 'using',
        type: text('TERSubset<CanCvtToTER>'),
        templateParameters: null,
      }),
    ).toBe('using TER = TERSubset<CanCvtToTER>');
    expect(
      declarationText({
        kind: 'enum',
        name: 'LedgerEntryType',
        isScoped: false,
        underlyingType: text('std::uint16_t'),
      }),
    ).toBe('enum LedgerEntryType : std::uint16_t');
    expect(
      expressionText(
        deductionGuideDeclaration(
          {
            templateParameters: [{ type: text('class'), name: 'EF', defaultValue: null }],
            parameters: [parameter('EF')],
            resultText: 'ScopeExit< EF >',
          },
          'ScopeExit',
        ),
      ),
    ).toBe('template <class EF>\nScopeExit(EF) -> ScopeExit< EF >');
  });
});
