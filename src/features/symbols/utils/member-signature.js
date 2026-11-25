import { expressionText } from '../../../utils/expressions.js';

export function parameterTypesText(record) {
  return record.parameters
    .map((parameter) => `${expressionText(parameter.type)}${parameter.array ?? ''}`)
    .join(', ');
}

export function memberSignatureText(record) {
  if (record.kind !== 'function') {
    return record.name;
  }
  const qualifiers = record.qualifiers;
  const suffixes = [
    qualifiers.isConst ? ' const' : '',
    qualifiers.referenceQualifier === 'lvalue' ? ' &' : '',
    qualifiers.referenceQualifier === 'rvalue' ? ' &&' : '',
  ].join('');
  return `${record.name}(${parameterTypesText(record)})${suffixes}`;
}

export function memberTagsOf(record) {
  const qualifiers = record.qualifiers ?? {};
  return [
    qualifiers.isStatic ? 'static' : null,
    qualifiers.isPureVirtual ? 'pure virtual' : null,
    !qualifiers.isPureVirtual && qualifiers.virtuality === 'virtual' && !qualifiers.isOverride
      ? 'virtual'
      : null,
    qualifiers.isOverride ? 'override' : null,
    qualifiers.isDeleted ? 'deleted' : null,
    qualifiers.isDefaulted ? 'defaulted' : null,
    qualifiers.isConstexpr ? 'constexpr' : null,
    qualifiers.isExplicit ? 'explicit' : null,
  ].filter(Boolean);
}
