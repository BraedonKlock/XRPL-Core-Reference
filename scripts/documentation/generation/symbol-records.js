import { hasDocumentationContent } from '../normalization/documentation.js';
import { declarationOf, deductionGuideDeclaration } from './declarations.js';

function documentationStatus(documentation) {
  if (documentation.suppressionReason) {
    return 'suppressed';
  }
  return hasDocumentationContent(documentation) ? 'present' : 'absent';
}

function resolveBlocks(blocks, resolver, context) {
  return blocks.map((block) => {
    if (block.type === 'paragraph') {
      return { type: 'paragraph', content: resolver.resolveInlineContent(block.content, context) };
    }
    if (block.type === 'list') {
      return { ...block, items: block.items.map((item) => resolver.resolveInlineContent(item, context)) };
    }
    return { ...block };
  });
}

export function publicDocumentation(documentation, resolver, context) {
  return {
    status: documentationStatus(documentation),
    brief: resolver.resolveInlineContent(documentation.brief, context),
    description: resolveBlocks(documentation.description, resolver, context),
    returns: resolver.resolveInlineContent(documentation.returns, context),
    notes: documentation.notes.map((note) => ({
      kind: note.kind,
      content: resolver.resolveInlineContent(note.content, context),
    })),
    suppressionReason: documentation.suppressionReason ?? null,
  };
}

function publicLocation(location) {
  if (!location) {
    return null;
  }
  return {
    declaration: { file: location.declaration.file, line: location.declaration.line ?? null },
    definition: location.definition
      ? {
          file: location.definition.file,
          line: location.definition.line,
          endLine: location.definition.endLine ?? null,
        }
      : null,
  };
}

function publicTemplateParameters(templateParameters, resolver, context) {
  if (!templateParameters) {
    return null;
  }
  return templateParameters.map((parameter) => ({
    type: resolver.resolveExpression(parameter.type, context),
    name: parameter.name,
    defaultValue: resolver.resolveExpression(parameter.defaultValue, context),
  }));
}

function memberPathsOf(symbol, symbolsById) {
  return (symbol.memberIds ?? []).map((id) => symbolsById.get(id)?.path).filter(Boolean);
}

function nestedPathsOf(symbol, symbolsById) {
  return (symbol.innerIds ?? []).map((id) => symbolsById.get(id)?.path).filter(Boolean);
}

function publicEdges(edges, resolver, context) {
  return edges.map((edge) => ({
    name: edge.name,
    target: resolver.resolveEdgeTarget(edge.refId, edge.name, context),
    access: edge.access,
    isVirtual: edge.isVirtual,
  }));
}

function kindSpecificFields(symbol, { resolver, symbolsById, context }) {
  const expression = (value) => resolver.resolveExpression(value, context);
  const declaration = () => expression(declarationOf(symbol));
  switch (symbol.kind) {
    case 'namespace':
      return { nested: nestedPathsOf(symbol, symbolsById), members: memberPathsOf(symbol, symbolsById) };
    case 'class':
    case 'struct':
    case 'union':
      return {
        templateParameters: publicTemplateParameters(symbol.templateParameters, resolver, context),
        isTemplateSpecialization: symbol.isTemplateSpecialization,
        isFinal: symbol.isFinal,
        isAbstract: symbol.isAbstract,
        baseClasses: publicEdges(symbol.baseClasses, resolver, context),
        derivedClasses: publicEdges(symbol.derivedClasses, resolver, context),
        friends: symbol.friendClasses.map((friendClass) => ({
          name: friendClass.name,
          target: resolver.resolveEdgeTarget(friendClass.refId, friendClass.name, context),
        })),
        deductionGuides: symbol.deductionGuides.map((guide) => ({
          declaration: expression(deductionGuideDeclaration(guide, symbol.name)),
          location: guide.location ? { file: guide.location.file, line: guide.location.line ?? null } : null,
        })),
        nested: nestedPathsOf(symbol, symbolsById),
        members: memberPathsOf(symbol, symbolsById),
        declaration: declaration(),
      };
    case 'concept':
      return {
        templateParameters: publicTemplateParameters(symbol.templateParameters, resolver, context),
        definition: expression(symbol.definition),
        declaration: declaration(),
      };
    case 'function':
      return {
        role: symbol.role,
        overloadSet: symbol.overloadSetPath,
        signatureKey: symbol.signatureKey,
        returnType: expression(symbol.returnType),
        parameters: symbol.parameters.map((parameter) => ({
          name: parameter.name,
          type: expression(parameter.type),
          array: parameter.array,
          defaultValue: expression(parameter.defaultValue),
          description: resolver.resolveInlineContent(parameter.description, context),
          direction: parameter.direction,
        })),
        templateParameters: publicTemplateParameters(symbol.templateParameters, resolver, context),
        requiresClause: expression(symbol.requiresClause),
        explicitSpecializations: symbol.explicitSpecializations.map((position) => ({
          file: position.file,
          line: position.line ?? null,
        })),
        qualifiers: { ...symbol.qualifiers },
        declaration: declaration(),
      };
    case 'variable':
      return {
        type: expression(symbol.type),
        initializer: expression(symbol.initializer),
        bitfield: symbol.bitfield,
        qualifiers: { ...symbol.qualifiers },
        declaration: declaration(),
      };
    case 'typeAlias':
      return {
        aliasStyle: symbol.aliasStyle,
        type: expression(symbol.type),
        templateParameters: publicTemplateParameters(symbol.templateParameters, resolver, context),
        declaration: declaration(),
      };
    case 'enum':
      return {
        isScoped: symbol.isScoped,
        underlyingType: expression(symbol.underlyingType),
        enumerators: symbol.enumerators.map((enumerator) => ({
          name: enumerator.name,
          initializer: expression(enumerator.initializer),
          documentation: publicDocumentation(enumerator.documentation, resolver, context),
        })),
        declaration: declaration(),
      };
    default:
      throw new Error(`Cannot publish symbol ${symbol.qualifiedName} of kind ${symbol.kind}`);
  }
}

export function toPublicRecord(symbol, { resolver, symbolsById }) {
  const context = symbol.qualifiedName;
  return {
    path: symbol.path,
    kind: symbol.kind,
    name: symbol.name,
    qualifiedName: symbol.qualifiedName,
    scope: symbol.scopePath,
    category: symbol.category,
    access: symbol.access,
    documentation: publicDocumentation(symbol.documentation, resolver, context),
    location: publicLocation(symbol.location),
    corrections: [...symbol.corrections],
    ...kindSpecificFields(symbol, { resolver, symbolsById, context }),
  };
}
