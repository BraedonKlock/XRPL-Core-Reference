import { z } from 'zod';
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

export const commitShaSchema = z.string().regex(COMMIT_SHA_PATTERN, 'must be a full 40-character commit SHA');
export const symbolPathSchema = z
  .string()
  .min(1)
  .refine((path) => !path.startsWith('/') && !path.endsWith('/') && !path.includes('//'), {
    message: 'must be a relative path without empty segments',
  });

export const referenceTargetSchema = z.strictObject({
  path: symbolPathSchema,
  fragment: z.string().min(1).optional(),
  resolution: z.enum(REFERENCE_RESOLUTIONS),
});

export const typeTokenSchema = z.strictObject({
  text: z.string().min(1),
  target: referenceTargetSchema.optional(),
});

export const typeExpressionSchema = z.array(typeTokenSchema);

export const inlineSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('text'), text: z.string().min(1) }),
  z.strictObject({ type: z.literal('code'), text: z.string().min(1) }),
  z.strictObject({ type: z.literal('emphasis'), text: z.string().min(1) }),
  z.strictObject({ type: z.literal('strong'), text: z.string().min(1) }),
  z.strictObject({ type: z.literal('link'), text: z.string().min(1), target: referenceTargetSchema }),
  z.strictObject({ type: z.literal('url'), text: z.string().min(1), href: z.url() }),
]);

export const inlineContentSchema = z.array(inlineSchema).min(1);

export const blockSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('paragraph'), content: inlineContentSchema }),
  z.strictObject({
    type: z.literal('list'),
    ordered: z.boolean(),
    items: z.array(inlineContentSchema).min(1),
  }),
  z.strictObject({ type: z.literal('code'), text: z.string().min(1) }),
]);

export const documentationSchema = z.strictObject({
  status: z.enum(DOCUMENTATION_STATUSES),
  brief: inlineContentSchema.nullable(),
  description: z.array(blockSchema),
  returns: inlineContentSchema.nullable(),
  notes: z.array(z.strictObject({ kind: z.enum(NOTE_KINDS), content: inlineContentSchema })),
  suppressionReason: z.string().min(1).nullable(),
});

const lineNumberSchema = z.number().int().positive();

export const sourcePositionSchema = z.strictObject({
  file: z.string().min(1),
  line: lineNumberSchema.nullable(),
});

export const sourceLocationSchema = z.strictObject({
  declaration: sourcePositionSchema,
  definition: z
    .strictObject({ file: z.string().min(1), line: lineNumberSchema, endLine: lineNumberSchema.nullable() })
    .nullable(),
});

export const templateParameterSchema = z.strictObject({
  type: typeExpressionSchema,
  name: z.string().min(1).nullable(),
  defaultValue: typeExpressionSchema.nullable(),
});

const templateParametersSchema = z.array(templateParameterSchema).nullable();

const symbolBaseShape = {
  path: symbolPathSchema,
  name: z.string().min(1),
  qualifiedName: z.string().min(1),
  scope: symbolPathSchema.nullable(),
  category: z.enum(SOURCE_CATEGORIES),
  access: z.enum(ACCESS_LEVELS).nullable(),
  documentation: documentationSchema,
  location: sourceLocationSchema.nullable(),
  corrections: z.array(z.string().min(1)),
};

const inheritanceEdgeSchema = z.strictObject({
  name: z.string().min(1),
  target: referenceTargetSchema.nullable(),
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
  friends: z.array(z.strictObject({ name: z.string().min(1), target: referenceTargetSchema.nullable() })),
  deductionGuides: z.array(
    z.strictObject({ declaration: typeExpressionSchema, location: sourcePositionSchema.nullable() }),
  ),
  nested: z.array(symbolPathSchema),
  members: z.array(symbolPathSchema),
  declaration: typeExpressionSchema,
});

export const conceptSymbolSchema = z.strictObject({
  ...symbolBaseShape,
  kind: z.literal('concept'),
  templateParameters: templateParametersSchema,
  definition: typeExpressionSchema.nullable(),
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
  referenceQualifier: z.enum(['lvalue', 'rvalue']).nullable(),
});

export const parameterSchema = z.strictObject({
  name: z.string().min(1).nullable(),
  type: typeExpressionSchema,
  array: z.string().min(1).nullable(),
  defaultValue: typeExpressionSchema.nullable(),
  description: inlineContentSchema.nullable(),
  direction: z.enum(['in', 'out', 'inout']).nullable(),
});

export const functionSymbolSchema = z.strictObject({
  ...symbolBaseShape,
  kind: z.literal('function'),
  role: z.enum(FUNCTION_ROLES),
  overloadSet: symbolPathSchema,
  signatureKey: z.string().min(1),
  returnType: typeExpressionSchema.nullable(),
  parameters: z.array(parameterSchema),
  templateParameters: templateParametersSchema,
  requiresClause: typeExpressionSchema.nullable(),
  explicitSpecializations: z.array(sourcePositionSchema),
  qualifiers: functionQualifiersSchema,
  declaration: typeExpressionSchema,
});

export const variableSymbolSchema = z.strictObject({
  ...symbolBaseShape,
  kind: z.literal('variable'),
  type: typeExpressionSchema,
  initializer: typeExpressionSchema.nullable(),
  bitfield: z.string().min(1).nullable(),
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
  underlyingType: typeExpressionSchema.nullable(),
  enumerators: z.array(
    z.strictObject({
      name: z.string().min(1),
      initializer: typeExpressionSchema.nullable(),
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
  shard: z.string().min(1),
  symbols: z.array(symbolSchema).min(1),
});

export const searchIndexSchema = z
  .strictObject({
    ...datasetHeaderShape,
    columns: z.tuple(SEARCH_INDEX_COLUMNS.map((column) => z.literal(column))),
    shards: z.array(z.string().min(1)),
    rows: z.array(
      z.tuple([
        symbolPathSchema,
        z.string().min(1),
        z.string().min(1),
        z.enum(SYMBOL_KINDS),
        z.enum(FUNCTION_ROLES).nullable(),
        z.string().nullable(),
        z.enum(SOURCE_CATEGORIES),
        z.string().nullable(),
        z.number().int().nonnegative(),
        z.number().int().positive(),
      ]),
    ),
  })
  .refine((index) => index.rows.every((row) => row[8] < index.shards.length), {
    message: 'every row must reference an existing shard',
  });

const navigationNodeSchema = z.strictObject({
  path: symbolPathSchema,
  name: z.string().min(1),
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
      base: symbolPathSchema.nullable(),
      baseName: z.string().min(1),
      access: z.enum(ACCESS_LEVELS),
      isVirtual: z.boolean(),
    }),
  ),
  aliases: z.array(z.strictObject({ alias: symbolPathSchema, targets: z.array(symbolPathSchema).min(1) })),
  friends: z.array(
    z.strictObject({ owner: symbolPathSchema, friend: symbolPathSchema.nullable(), name: z.string().min(1) }),
  ),
});

const fileEntrySchema = z.strictObject({
  path: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(SHA256_PATTERN),
});

export const sourceRevisionSchema = z.strictObject({
  repository: z.string().min(1),
  repositoryUrl: z.url(),
  webUrl: z.url(),
  branch: z.string().min(1),
  commitSha: commitShaSchema,
  commitDate: z.iso.datetime({ offset: true }),
});

export const manifestSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  source: sourceRevisionSchema,
  generation: z.strictObject({
    generatedAt: z.iso.datetime(),
    extractedAt: z.iso.datetime(),
    generatorVersion: z.string().min(1),
    extractor: z.strictObject({
      name: z.literal('doxygen'),
      version: z.string().min(1),
      configSha256: z.string().regex(SHA256_PATTERN),
    }),
  }),
  scope: z.strictObject({
    categories: z.array(z.enum(SOURCE_CATEGORIES)).min(1),
    inputs: z.array(z.string().min(1)).min(1),
  }),
  files: z.strictObject({
    searchIndex: fileEntrySchema,
    navigation: fileEntrySchema,
    relationships: fileEntrySchema,
    coverage: fileEntrySchema,
    upstreamLicense: fileEntrySchema,
    shards: z.strictObject({
      directory: z.string().min(1),
      count: z.number().int().positive(),
      bytes: z.number().int(),
    }),
  }),
  counts: z.record(z.string(), z.number().int().nonnegative()),
});

export const currentDatasetPointerSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  commitSha: commitShaSchema,
  manifest: z.string().min(1),
});
