import * as z from 'zod/mini';
import {
  ACCESS_LEVELS,
  DOCUMENTATION_STATUSES,
  FUNCTION_ROLES,
  NOTE_KINDS,
  REFERENCE_RESOLUTIONS,
  SCHEMA_VERSION,
  SEARCH_INDEX_COLUMNS,
  SOURCE_CATEGORIES,
  SYMBOL_KINDS,
} from './constants.js';

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

const nonEmptyString = () => z.string().check(z.minLength(1));
const nonEmptyArray = (schema) => z.array(schema).check(z.minLength(1));
const positiveInteger = () => z.number().check(z.int(), z.positive());
const nonNegativeInteger = () => z.number().check(z.int(), z.nonnegative());

export const commitShaSchema = z
  .string()
  .check(z.regex(COMMIT_SHA_PATTERN, { error: 'must be a full 40-character commit SHA' }));
export const symbolPathSchema = z.string().check(
  z.minLength(1),
  z.refine((path) => !path.startsWith('/') && !path.endsWith('/') && !path.includes('//'), {
    error: 'must be a relative path without empty segments',
  }),
);

export const referenceTargetSchema = z.strictObject({
  path: symbolPathSchema,
  fragment: z.optional(nonEmptyString()),
  resolution: z.enum(REFERENCE_RESOLUTIONS),
});

export const typeTokenSchema = z.strictObject({
  text: nonEmptyString(),
  target: z.optional(referenceTargetSchema),
});

export const typeExpressionSchema = z.array(typeTokenSchema);

export const inlineSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('text'), text: nonEmptyString() }),
  z.strictObject({ type: z.literal('code'), text: nonEmptyString() }),
  z.strictObject({ type: z.literal('emphasis'), text: nonEmptyString() }),
  z.strictObject({ type: z.literal('strong'), text: nonEmptyString() }),
  z.strictObject({ type: z.literal('link'), text: nonEmptyString(), target: referenceTargetSchema }),
  z.strictObject({ type: z.literal('url'), text: nonEmptyString(), href: z.url() }),
]);

export const inlineContentSchema = nonEmptyArray(inlineSchema);

export const blockSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('paragraph'), content: inlineContentSchema }),
  z.strictObject({
    type: z.literal('list'),
    ordered: z.boolean(),
    items: nonEmptyArray(inlineContentSchema),
  }),
  z.strictObject({ type: z.literal('code'), text: nonEmptyString() }),
]);

export const documentationSchema = z.strictObject({
  status: z.enum(DOCUMENTATION_STATUSES),
  brief: z.nullable(inlineContentSchema),
  description: z.array(blockSchema),
  returns: z.nullable(inlineContentSchema),
  notes: z.array(z.strictObject({ kind: z.enum(NOTE_KINDS), content: inlineContentSchema })),
  suppressionReason: z.nullable(nonEmptyString()),
  inheritedFrom: z.nullable(
    z.strictObject({ name: nonEmptyString(), target: z.nullable(referenceTargetSchema) }),
  ),
});

const lineNumberSchema = positiveInteger();

export const sourcePositionSchema = z.strictObject({
  file: nonEmptyString(),
  line: z.nullable(lineNumberSchema),
});

export const sourceLocationSchema = z.strictObject({
  declaration: sourcePositionSchema,
  definition: z.nullable(
    z.strictObject({ file: nonEmptyString(), line: lineNumberSchema, endLine: z.nullable(lineNumberSchema) }),
  ),
});

export const templateParameterSchema = z.strictObject({
  type: typeExpressionSchema,
  name: z.nullable(nonEmptyString()),
  defaultValue: z.nullable(typeExpressionSchema),
});

const templateParametersSchema = z.nullable(z.array(templateParameterSchema));

const symbolBaseShape = {
  path: symbolPathSchema,
  name: nonEmptyString(),
  qualifiedName: nonEmptyString(),
  scope: z.nullable(symbolPathSchema),
  category: z.enum(SOURCE_CATEGORIES),
  access: z.nullable(z.enum(ACCESS_LEVELS)),
  documentation: documentationSchema,
  location: z.nullable(sourceLocationSchema),
  corrections: z.array(nonEmptyString()),
};

const inheritanceEdgeSchema = z.strictObject({
  name: nonEmptyString(),
  target: z.nullable(referenceTargetSchema),
  access: z.enum(ACCESS_LEVELS),
  isVirtual: z.boolean(),
});

export const namespaceSymbolSchema = z.strictObject({
  ...symbolBaseShape,
  kind: z.literal('namespace'),
  nested: z.array(symbolPathSchema),
  members: z.array(symbolPathSchema),
});

export const classSymbolSchema = z.strictObject({
  ...symbolBaseShape,
  kind: z.enum(['class', 'struct', 'union']),
  templateParameters: templateParametersSchema,
  isTemplateSpecialization: z.boolean(),
  isFinal: z.boolean(),
  isAbstract: z.boolean(),
  baseClasses: z.array(inheritanceEdgeSchema),
  derivedClasses: z.array(inheritanceEdgeSchema),
  friends: z.array(z.strictObject({ name: nonEmptyString(), target: z.nullable(referenceTargetSchema) })),
  deductionGuides: z.array(
    z.strictObject({ declaration: typeExpressionSchema, location: z.nullable(sourcePositionSchema) }),
  ),
  nested: z.array(symbolPathSchema),
  members: z.array(symbolPathSchema),
  declaration: typeExpressionSchema,
});

export const conceptSymbolSchema = z.strictObject({
  ...symbolBaseShape,
  kind: z.literal('concept'),
  templateParameters: templateParametersSchema,
  definition: z.nullable(typeExpressionSchema),
  declaration: typeExpressionSchema,
});

export const functionQualifiersSchema = z.strictObject({
  isStatic: z.boolean(),
  isConst: z.boolean(),
  isConstexpr: z.boolean(),
  isConsteval: z.boolean(),
  isExplicit: z.boolean(),
  isInline: z.boolean(),
  isNoexcept: z.boolean(),
  isNodiscard: z.boolean(),
  isDeleted: z.boolean(),
  isDefaulted: z.boolean(),
  isPureVirtual: z.boolean(),
  isOverride: z.boolean(),
  isFinal: z.boolean(),
  virtuality: z.enum(['non-virtual', 'virtual', 'pure-virtual']),
  referenceQualifier: z.nullable(z.enum(['lvalue', 'rvalue'])),
});

export const parameterSchema = z.strictObject({
  name: z.nullable(nonEmptyString()),
  type: typeExpressionSchema,
  array: z.nullable(nonEmptyString()),
  defaultValue: z.nullable(typeExpressionSchema),
  description: z.nullable(inlineContentSchema),
  direction: z.nullable(z.enum(['in', 'out', 'inout'])),
});

export const functionSymbolSchema = z.strictObject({
  ...symbolBaseShape,
  kind: z.literal('function'),
  role: z.enum(FUNCTION_ROLES),
  overloadSet: symbolPathSchema,
  signatureKey: nonEmptyString(),
  returnType: z.nullable(typeExpressionSchema),
  parameters: z.array(parameterSchema),
  templateParameters: templateParametersSchema,
  requiresClause: z.nullable(typeExpressionSchema),
  explicitSpecializations: z.array(sourcePositionSchema),
  qualifiers: functionQualifiersSchema,
  declaration: typeExpressionSchema,
});

export const variableSymbolSchema = z.strictObject({
  ...symbolBaseShape,
  kind: z.literal('variable'),
  type: typeExpressionSchema,
  initializer: z.nullable(typeExpressionSchema),
  bitfield: z.nullable(nonEmptyString()),
  qualifiers: z.strictObject({ isStatic: z.boolean(), isConstexpr: z.boolean(), isMutable: z.boolean() }),
  declaration: typeExpressionSchema,
});

export const typeAliasSymbolSchema = z.strictObject({
  ...symbolBaseShape,
  kind: z.literal('typeAlias'),
  aliasStyle: z.enum(['using', 'typedef']),
  type: typeExpressionSchema,
  templateParameters: templateParametersSchema,
  declaration: typeExpressionSchema,
});

export const enumSymbolSchema = z.strictObject({
  ...symbolBaseShape,
  kind: z.literal('enum'),
  isScoped: z.boolean(),
  underlyingType: z.nullable(typeExpressionSchema),
  enumerators: z.array(
    z.strictObject({
      name: nonEmptyString(),
      initializer: z.nullable(typeExpressionSchema),
      documentation: documentationSchema,
    }),
  ),
  declaration: typeExpressionSchema,
});

export const symbolSchema = z.union([
  namespaceSymbolSchema,
  classSymbolSchema,
  conceptSymbolSchema,
  functionSymbolSchema,
  variableSymbolSchema,
  typeAliasSymbolSchema,
  enumSymbolSchema,
]);

const datasetHeaderShape = {
  schemaVersion: z.literal(SCHEMA_VERSION),
  commitSha: commitShaSchema,
};

export const symbolShardSchema = z.strictObject({
  ...datasetHeaderShape,
  shard: nonEmptyString(),
  symbols: nonEmptyArray(symbolSchema),
});

export const searchIndexSchema = z
  .strictObject({
    ...datasetHeaderShape,
    columns: z.tuple(SEARCH_INDEX_COLUMNS.map((column) => z.literal(column))),
    shards: z.array(nonEmptyString()),
    rows: z.array(
      z.tuple([
        symbolPathSchema,
        nonEmptyString(),
        nonEmptyString(),
        z.enum(SYMBOL_KINDS),
        z.nullable(z.enum(FUNCTION_ROLES)),
        z.nullable(z.string()),
        z.enum(SOURCE_CATEGORIES),
        z.nullable(z.string()),
        nonNegativeInteger(),
        positiveInteger(),
      ]),
    ),
  })
  .check(
    z.refine((index) => index.rows.every((row) => row[8] < index.shards.length), {
      error: 'every row must reference an existing shard',
    }),
  );

const navigationNodeSchema = z.strictObject({
  path: symbolPathSchema,
  name: nonEmptyString(),
  kind: z.enum(['namespace', 'class', 'struct', 'union', 'concept']),
  category: z.enum(SOURCE_CATEGORIES),
  get children() {
    return z.array(navigationNodeSchema);
  },
});

export const navigationSchema = z.strictObject({
  ...datasetHeaderShape,
  roots: z.array(navigationNodeSchema),
});

export const relationshipsSchema = z.strictObject({
  ...datasetHeaderShape,
  inheritance: z.array(
    z.strictObject({
      derived: symbolPathSchema,
      base: z.nullable(symbolPathSchema),
      baseName: nonEmptyString(),
      access: z.enum(ACCESS_LEVELS),
      isVirtual: z.boolean(),
    }),
  ),
  aliases: z.array(z.strictObject({ alias: symbolPathSchema, targets: nonEmptyArray(symbolPathSchema) })),
  friends: z.array(
    z.strictObject({ owner: symbolPathSchema, friend: z.nullable(symbolPathSchema), name: nonEmptyString() }),
  ),
});

const fileEntrySchema = z.strictObject({
  path: nonEmptyString(),
  bytes: nonNegativeInteger(),
  sha256: z.string().check(z.regex(SHA256_PATTERN)),
});

export const sourceRevisionSchema = z.strictObject({
  repository: nonEmptyString(),
  repositoryUrl: z.url(),
  webUrl: z.url(),
  branch: nonEmptyString(),
  commitSha: commitShaSchema,
  commitDate: z.iso.datetime({ offset: true }),
});

export const manifestSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  source: sourceRevisionSchema,
  generation: z.strictObject({
    generatedAt: z.iso.datetime(),
    extractedAt: z.iso.datetime(),
    generatorVersion: nonEmptyString(),
    extractor: z.strictObject({
      name: z.literal('doxygen'),
      version: nonEmptyString(),
      configSha256: z.string().check(z.regex(SHA256_PATTERN)),
    }),
  }),
  scope: z.strictObject({
    categories: nonEmptyArray(z.enum(SOURCE_CATEGORIES)),
    inputs: nonEmptyArray(nonEmptyString()),
  }),
  files: z.strictObject({
    searchIndex: fileEntrySchema,
    navigation: fileEntrySchema,
    relationships: fileEntrySchema,
    coverage: fileEntrySchema,
    upstreamLicense: fileEntrySchema,
    shards: z.strictObject({
      directory: nonEmptyString(),
      count: positiveInteger(),
      bytes: z.number().check(z.int()),
    }),
  }),
  counts: z.record(z.string(), nonNegativeInteger()),
});

export const currentDatasetPointerSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  commitSha: commitShaSchema,
  manifest: nonEmptyString(),
});
