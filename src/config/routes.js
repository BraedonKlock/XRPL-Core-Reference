export const HOME_ROUTE = '/';
export const SEARCH_ROUTE = '/search';
export const SYMBOL_ROUTE_PREFIX = '/symbols/';

export function symbolUrl(symbolPath, fragment) {
  const url = `${SYMBOL_ROUTE_PREFIX}${symbolPath}`;
  return fragment ? `${url}#${encodeURIComponent(fragment)}` : url;
}

export function searchUrl(query, { kind = null, scope = null } = {}) {
  const parameters = new URLSearchParams();
  if (query) {
    parameters.set('q', query);
  }
  if (kind) {
    parameters.set('kind', kind);
  }
  if (scope) {
    parameters.set('scope', scope);
  }
  const search = parameters.toString();
  return search ? `${SEARCH_ROUTE}?${search}` : SEARCH_ROUTE;
}

export function symbolPathFromPathname(pathname) {
  if (!pathname.startsWith(SYMBOL_ROUTE_PREFIX)) {
    return null;
  }
  const symbolPath = pathname.slice(SYMBOL_ROUTE_PREFIX.length).replace(/\/+$/, '');
  return symbolPath.length > 0 ? symbolPath : null;
}
