import { HOME_ROUTE, symbolUrl } from '../../../config/routes.js';
import { ancestorPathsOf } from '../../../services/documentation/symbol-directory.js';

function currentLabel(resolution, symbolPath) {
  if (!resolution) {
    return symbolPath;
  }
  return resolution.overloadPath ? `${resolution.entry.name}(\u2026)` : resolution.entry.name;
}

export function breadcrumbItemsFor(symbolPath, directory) {
  const ancestors = ancestorPathsOf(symbolPath)
    .map((path) => directory.get(path))
    .filter(Boolean)
    .map((entry) => ({ href: symbolUrl(entry.path), label: entry.name }));
  const resolution = directory.resolve(symbolPath);
  return [
    { href: HOME_ROUTE, label: 'Overview' },
    ...ancestors,
    { href: symbolUrl(symbolPath), label: currentLabel(resolution, symbolPath) },
  ];
}
