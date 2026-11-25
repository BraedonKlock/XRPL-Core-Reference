import { isClassLikeKind } from '../doxygen-symbols.js';
import { createCorrectionResult, markCorrected, recordApplied } from './correction-result.js';

export const ATTACH_DEDUCTION_GUIDES = 'attach-deduction-guides';

const TRAILING_RESULT_PATTERN = /\)\s*->\s*(.+)$/;
const NAMESPACE_SCOPED_OWNER_KINDS = new Set(['namespace', 'global']);

function escapeForPattern(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function deductionGuideResultOf(symbol) {
  if (
    symbol.kind !== 'function' ||
    symbol.returnType !== null ||
    !NAMESPACE_SCOPED_OWNER_KINDS.has(symbol.origin.ownerKind)
  ) {
    return null;
  }
  const match = TRAILING_RESULT_PATTERN.exec(symbol.origin.argsString);
  if (!match) {
    return null;
  }
  const resultText = match[1].trim();
  return new RegExp(`^${escapeForPattern(symbol.name)}\\s*(<.*>)?$`).test(resultText) ? resultText : null;
}

function classTemplateKeyOf(symbol) {
  return `${symbol.ownerId ?? ''}\u0000${symbol.qualifiedName}`;
}

export function attachDeductionGuides(symbols) {
  const result = createCorrectionResult([]);
  const classTemplates = new Map(
    symbols
      .filter((symbol) => isClassLikeKind(symbol.kind) && symbol.templateParameters)
      .map((symbol) => [classTemplateKeyOf(symbol), symbol]),
  );
  for (const symbol of symbols) {
    const resultText = deductionGuideResultOf(symbol);
    const classTemplate = resultText ? classTemplates.get(classTemplateKeyOf(symbol)) : undefined;
    if (!classTemplate) {
      result.symbols.push(symbol);
      continue;
    }
    classTemplate.deductionGuides = [
      ...(classTemplate.deductionGuides ?? []),
      {
        templateParameters: symbol.templateParameters,
        parameters: symbol.parameters,
        resultText,
        location: symbol.location?.declaration ?? null,
      },
    ];
    markCorrected(classTemplate, ATTACH_DEDUCTION_GUIDES);
    recordApplied(
      result,
      classTemplate,
      `attached deduction guide ${symbol.name}${symbol.origin.argsString}`,
    );
  }
  return result;
}
