import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const INDEX_PATH = '/index.html';
const CURRENT_DATASET_PATH = '/data/current.json';
const EXCLUDED_FILES = new Set(['/404.html']);
const MINIMUM_COMPRESSED_BYTES = 1024;
const ALLOWED_METHODS = 'GET, HEAD';
const HSTS_VALUE = 'max-age=31536000';
const ANALYTICS_SCRIPT_SOURCE = 'https://static.cloudflareinsights.com/beacon.min.js';
const ANALYTICS_REPORTING_ORIGIN = 'https://cloudflareinsights.com';

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
});
const COMPRESSIBLE_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.txt', '.svg', '.webmanifest']);
const ASSET_REQUEST =
  /\.(html?|[cm]?js|jsx|tsx?|css|json|txt|map|md|xml|ya?ml|toml|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|webmanifest|wasm)$/i;
const ASSET_DIRECTORIES = ['/assets/', '/data/'];

const CACHE_POLICIES = Object.freeze({
  revalidate: 'no-cache',
  immutable: 'public, max-age=31536000, immutable',
  dataset: 'public, max-age=3600',
  standard: 'public, max-age=3600',
  error: 'no-store',
});

export class SiteLoadError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SiteLoadError';
  }
}

function cachePolicyFor(urlPath) {
  if (urlPath === INDEX_PATH || urlPath === CURRENT_DATASET_PATH) {
    return CACHE_POLICIES.revalidate;
  }
  if (urlPath.startsWith('/assets/')) {
    return CACHE_POLICIES.immutable;
  }
  if (urlPath.startsWith('/data/')) {
    return CACHE_POLICIES.dataset;
  }
  return CACHE_POLICIES.standard;
}

function listPublishableFiles(root, directory = root) {
  return readdirSync(directory).flatMap((name) => {
    if (name.startsWith('.')) {
      return [];
    }
    const path = join(directory, name);
    const stats = lstatSync(path);
    if (stats.isSymbolicLink()) {
      return [];
    }
    if (stats.isDirectory()) {
      return listPublishableFiles(root, path);
    }
    return stats.isFile() ? [path] : [];
  });
}

function toUrlPath(root, path) {
  return `/${relative(root, path).split(sep).join('/')}`;
}

function inlineScriptHashes(html) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    ([, source]) => `'sha256-${createHash('sha256').update(source).digest('base64')}'`,
  );
}

function contentSecurityPolicy(scriptHashes) {
  return [
    "default-src 'self'",
    ["script-src 'self'", ...scriptHashes, ANALYTICS_SCRIPT_SOURCE].join(' '),
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${ANALYTICS_REPORTING_ORIGIN}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function createEntry(urlPath, body) {
  const extension = extname(urlPath).toLowerCase();
  const compressible = COMPRESSIBLE_EXTENSIONS.has(extension) && body.length >= MINIMUM_COMPRESSED_BYTES;
  return {
    body,
    gzipBody: compressible ? gzipSync(body) : null,
    contentType: CONTENT_TYPES[extension] ?? 'application/octet-stream',
    etag: `"${createHash('sha256').update(body).digest('hex').slice(0, 32)}"`,
    cacheControl: cachePolicyFor(urlPath),
  };
}

export function loadSite(root) {
  if (!existsSync(join(root, 'index.html'))) {
    throw new SiteLoadError(`No production build found at ${root}. Run "npm run build" first.`);
  }
  const files = new Map();
  for (const path of listPublishableFiles(root)) {
    const urlPath = toUrlPath(root, path);
    if (!EXCLUDED_FILES.has(urlPath)) {
      files.set(urlPath, createEntry(urlPath, readFileSync(path)));
    }
  }
  const pointer = files.get(CURRENT_DATASET_PATH);
  if (!pointer) {
    throw new SiteLoadError('The build has no documentation dataset (data/current.json is missing).');
  }
  const { commitSha, manifest } = JSON.parse(pointer.body.toString('utf8'));
  if (!files.has(`/data/${manifest}`)) {
    throw new SiteLoadError(`The build's dataset manifest data/${manifest} is missing.`);
  }
  const html = files.get(INDEX_PATH).body.toString('utf8');
  return {
    files,
    commitSha,
    contentSecurityPolicy: contentSecurityPolicy(inlineScriptHashes(html)),
  };
}

function securityHeaders(site, request) {
  const headers = {
    'Content-Security-Policy': site.contentSecurityPolicy,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  };
  if (request.headers['x-forwarded-proto'] === 'https') {
    headers['Strict-Transport-Security'] = HSTS_VALUE;
  }
  return headers;
}

function sendText(response, request, site, status, message, extraHeaders = {}) {
  const body = Buffer.from(`${message}\n`);
  response.writeHead(status, {
    ...securityHeaders(site, request),
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': CACHE_POLICIES.error,
    ...extraHeaders,
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

function acceptsGzip(request) {
  return /\bgzip\b/.test(request.headers['accept-encoding'] ?? '');
}

function sendEntry(response, request, site, entry) {
  const headers = {
    ...securityHeaders(site, request),
    'Content-Type': entry.contentType,
    'Cache-Control': entry.cacheControl,
    ETag: entry.etag,
  };
  if (entry.gzipBody) {
    headers.Vary = 'Accept-Encoding';
  }
  if (request.headers['if-none-match'] === entry.etag) {
    response.writeHead(304, headers);
    response.end();
    return;
  }
  const useGzip = entry.gzipBody !== null && acceptsGzip(request);
  const body = useGzip ? entry.gzipBody : entry.body;
  if (useGzip) {
    headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = body.length;
  response.writeHead(200, headers);
  response.end(request.method === 'HEAD' ? undefined : body);
}

export function classifyRequestPath(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.startsWith('/') || rawUrl.startsWith('//')) {
    return { kind: 'malformed' };
  }
  const rawPath = rawUrl.split(/[?#]/, 1)[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return { kind: 'malformed' };
  }
  if (/[\0\\]/.test(decodedPath)) {
    return { kind: 'malformed' };
  }
  const segments = decodedPath.split('/').slice(1);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return { kind: 'malformed' };
  }
  if (segments.some((segment) => segment.startsWith('.'))) {
    return { kind: 'hidden' };
  }
  const lookupPath = decodedPath === '/' ? INDEX_PATH : decodedPath;
  const isAsset =
    ASSET_DIRECTORIES.some((directory) => decodedPath.startsWith(directory)) || ASSET_REQUEST.test(rawPath);
  return { kind: isAsset ? 'asset' : 'route', lookupPath };
}

export function createRequestHandler(site, { onError = () => {} } = {}) {
  return (request, response) => {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendText(response, request, site, 405, 'Method not allowed', { Allow: ALLOWED_METHODS });
        return;
      }
      const target = classifyRequestPath(request.url);
      if (target.kind === 'malformed') {
        sendText(response, request, site, 400, 'Bad request');
        return;
      }
      if (target.kind === 'hidden') {
        sendText(response, request, site, 404, 'Not found');
        return;
      }
      const entry = site.files.get(target.lookupPath);
      if (entry) {
        sendEntry(response, request, site, entry);
        return;
      }
      if (target.kind === 'asset') {
        sendText(response, request, site, 404, 'Not found');
        return;
      }
      sendEntry(response, request, site, site.files.get(INDEX_PATH));
    } catch (error) {
      onError(error);
      if (!response.headersSent) {
        sendText(response, request, site, 500, 'Internal server error');
      } else {
        response.destroy();
      }
    }
  };
}

export function createProductionServer(site, options = {}) {
  const server = createServer(createRequestHandler(site, options));
  server.on('clientError', (error, socket) => {
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    } else {
      socket.destroy();
    }
  });
  return server;
}
