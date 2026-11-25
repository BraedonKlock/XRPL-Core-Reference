import { existsSync, readFileSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';

export function createSourceFileReader(sourceRoot) {
  const cache = new Map();
  const readLines = (file) => {
    if (!cache.has(file)) {
      const absolutePath = normalize(join(sourceRoot, file));
      const isInsideRoot = absolutePath.startsWith(normalize(sourceRoot) + sep);
      cache.set(
        file,
        isInsideRoot && existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8').split('\n') : null,
      );
    }
    return cache.get(file);
  };
  return {
    lineAt(file, line) {
      return readLines(file)?.[line - 1] ?? null;
    },
    exists(file) {
      return readLines(file) !== null;
    },
  };
}

export function createInMemorySourceFileReader(filesByPath) {
  const linesByPath = new Map(Object.entries(filesByPath).map(([path, text]) => [path, text.split('\n')]));
  return {
    lineAt(file, line) {
      return linesByPath.get(file)?.[line - 1] ?? null;
    },
    exists(file) {
      return linesByPath.has(file);
    },
  };
}
