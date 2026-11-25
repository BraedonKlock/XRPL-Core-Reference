import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { SOURCE_CATEGORIES } from '../../../contract/constants.js';
import { sourceRevisionSchema } from '../../../contract/schema.js';
import { EXTRACTION_FILES } from '../config/pipeline-config.js';

export const extractionRecordSchema = z.strictObject({
  source: sourceRevisionSchema,
  extractedAt: z.iso.datetime(),
  doxygenVersion: z.string().min(1),
  doxygenConfigSha256: z.string().regex(/^[0-9a-f]{64}$/),
  categories: z.array(z.enum(SOURCE_CATEGORIES)).min(1),
  inputs: z.array(z.string().min(1)).min(1),
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
