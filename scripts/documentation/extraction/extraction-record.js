import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as z from 'zod/mini';
import { SOURCE_CATEGORIES } from '../../../contract/constants.js';
import { sourceRevisionSchema } from '../../../contract/schema.js';
import { EXTRACTION_FILES } from '../config/pipeline-config.js';

export const extractionRecordSchema = z.strictObject({
  source: sourceRevisionSchema,
  extractedAt: z.iso.datetime(),
  doxygenVersion: z.string().check(z.minLength(1)),
  doxygenConfigSha256: z.string().check(z.regex(/^[0-9a-f]{64}$/)),
  categories: z.array(z.enum(SOURCE_CATEGORIES)).check(z.minLength(1)),
  inputs: z.array(z.string().check(z.minLength(1))).check(z.minLength(1)),
});

export function writeExtractionRecord(extractionDirectory, record) {
  const validated = extractionRecordSchema.parse(record);
  writeFileSync(
    join(extractionDirectory, EXTRACTION_FILES.revision),
    `${JSON.stringify(validated, null, 2)}\n`,
  );
  return validated;
}

export function readExtractionRecord(extractionDirectory) {
  const path = join(extractionDirectory, EXTRACTION_FILES.revision);
  return extractionRecordSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}
