import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';

const WARNING_LINE_PATTERN = /^(.+?):(\d+): warning: (.*)$/;
const UNTERMINATED_COMMENT_PATTERN =
  /still inside a \(nested\) comment.*possible line reference\(s\): ([\d, ]+)\)/;
const MAX_CATEGORY_LENGTH = 90;

function toRepositoryPath(file, sourceRoot) {
  return file.startsWith('/') ? relative(sourceRoot, file) : file;
}

export function categorizeWarningMessage(message) {
  return message
    .replace(/'[^']*'/g, "'…'")
    .replace(/\b(of|for|in|named|member|argument) .*$/, '$1 …')
    .slice(0, MAX_CATEGORY_LENGTH);
}

export function parseDoxygenWarnings(logText, sourceRoot) {
  const warnings = [];
  for (const line of logText.split('\n')) {
    const match = WARNING_LINE_PATTERN.exec(line);
    if (match) {
      warnings.push({
        file: toRepositoryPath(match[1], sourceRoot),
        line: Number(match[2]),
        message: match[3],
      });
    }
  }
  return warnings;
}

export function findUnterminatedComments(warnings) {
  return warnings.flatMap((warning) => {
    const match = UNTERMINATED_COMMENT_PATTERN.exec(warning.message);
    if (!match) {
      return [];
    }
    const startLines = match[1]
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
    return startLines.length > 0 ? [{ file: warning.file, startLine: Math.min(...startLines) }] : [];
  });
}

export function readDoxygenWarnings(warningLogPath, sourceRoot) {
  if (!existsSync(warningLogPath)) {
    throw new Error(`Doxygen warning log not found at ${warningLogPath}`);
  }
  return parseDoxygenWarnings(readFileSync(warningLogPath, 'utf8'), sourceRoot);
}

export function summarizeWarnings(warnings) {
  const byCategory = new Map();
  for (const warning of warnings) {
    const category = categorizeWarningMessage(warning.message);
    byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
  }
  return {
    total: warnings.length,
    byCategory: Object.fromEntries([...byCategory].sort(([, left], [, right]) => right - left)),
  };
}
