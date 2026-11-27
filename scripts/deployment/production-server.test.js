import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { classifyRequestPath, createProductionServer, loadSite, SiteLoadError } from './production-server.js';

const COMMIT_SHA = 'c2534ff9c84422e00711da31629a76f3f59feb98';
const THEME_SCRIPT = "document.documentElement.dataset.theme = 'light';";
const INDEX_HTML = `<!doctype html><html><head><script>${THEME_SCRIPT}</script></head><body><div id="root"></div></body></html>`;
const SCRIPT_BODY = `console.log(${JSON.stringify('x'.repeat(4000))});`;
const OUTSIDE_SECRET = 'outside-the-site-root';

function writeFiles(root, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
}

function createSiteDirectory() {
  const parent = mkdtempSync(join(tmpdir(), 'xcr-server-'));
  const root = join(parent, 'dist');
  writeFiles(parent, { 'secret.txt': OUTSIDE_SECRET, 'package.json': '{"private":true}' });
  writeFiles(root, {
    'index.html': INDEX_HTML,
    '404.html': INDEX_HTML,
    '.nojekyll': '',
    '.env': 'NOT_A_REAL_VALUE=placeholder',
    '.git/config': '[core]',
    'assets/.hidden.js': 'hidden',
    'assets/index-abc123.js': SCRIPT_BODY,
    'assets/index-abc123.css': 'body{margin:0}',
    'assets/logo-abc123.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    'data/current.json': JSON.stringify({
      schemaVersion: '1.0.0',
      commitSha: COMMIT_SHA,
      manifest: `${COMMIT_SHA}/manifest.json`,
    }),
    [`data/${COMMIT_SHA}/manifest.json`]: JSON.stringify({ commitSha: COMMIT_SHA }),
    [`data/${COMMIT_SHA}/symbols/a1b2.json`]: JSON.stringify({ symbols: [] }),
  });
  symlinkSync(join(parent, 'secret.txt'), join(root, 'linked-secret.txt'));
  return { parent, root };
}

function rawRequest(port, path, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({ host: '127.0.0.1', port, path, method, headers }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () =>
        resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }),
      );
    });
    request.on('error', reject);
    request.end();
  });
}

function socketRequest(port, requestLine) {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', () => {
      socket.write(`${requestLine}\r\nHost: localhost\r\nConnection: close\r\n\r\n`);
    });
    let received = '';
    socket.on('data', (chunk) => {
      received += chunk.toString('latin1');
    });
    socket.on('end', () => resolve(received));
    socket.on('error', reject);
  });
}

describe('production server', () => {
  let directories;
  let server;
  let port;
  const get = (path, options) => rawRequest(port, path, options);

  beforeAll(async () => {
    directories = createSiteDirectory();
    server = createProductionServer(loadSite(directories.root));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directories.parent, { recursive: true, force: true });
  });

  describe('application routes', () => {
    it('serves the application shell at the root without long-term caching', async () => {
      const response = await get('/');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.body.toString()).toBe(INDEX_HTML);
    });

    it.each([
      '/symbols/xrpl/ApplyContext',
      '/symbols/xrpl/detail/ApplyViewBase/open/3d5a0786',
      '/symbols/std/hash%3Cxrpl%3A%3AAccountID%3E',
      '/symbols/xrpl/detail/IsContiguousContainer%3CContainer%2Cstd%3A%3Avoid_t%3Cdecltype%28std%3A%3Adeclval%3CContainer_const%3E%28%29.size%28%29%29%3E%3E',
      '/symbols/beast/IsUniquelyRepresented%3Cstd%3A%3Atuple%3CT...%3E%3E',
      '/search?q=ApplyContext&kind=class',
      '/no-such-page',
    ])('falls back to the application shell for %s', async (path) => {
      const response = await get(path);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.body.toString()).toBe(INDEX_HTML);
    });
  });

  describe('static files', () => {
    it('serves hashed assets with their MIME type and immutable caching', async () => {
      const script = await get('/assets/index-abc123.js');
      expect(script.status).toBe(200);
      expect(script.headers['content-type']).toBe('text/javascript; charset=utf-8');
      expect(script.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      expect(script.body.toString()).toBe(SCRIPT_BODY);
      expect((await get('/assets/index-abc123.css')).headers['content-type']).toBe('text/css; charset=utf-8');
      expect((await get('/assets/logo-abc123.png')).headers['content-type']).toBe('image/png');
    });

    it('serves the dataset pointer for revalidation and dataset files with short caching', async () => {
      const pointer = await get('/data/current.json');
      expect(pointer.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(pointer.headers['cache-control']).toBe('no-cache');
      expect(JSON.parse(pointer.body).commitSha).toBe(COMMIT_SHA);
      const shard = await get(`/data/${COMMIT_SHA}/symbols/a1b2.json`);
      expect(shard.status).toBe(200);
      expect(shard.headers['cache-control']).toBe('public, max-age=3600');
    });

    it('compresses text when the client accepts gzip', async () => {
      const response = await get('/assets/index-abc123.js', { headers: { 'Accept-Encoding': 'gzip, br' } });
      expect(response.headers['content-encoding']).toBe('gzip');
      expect(response.headers.vary).toBe('Accept-Encoding');
      expect(gunzipSync(response.body).toString()).toBe(SCRIPT_BODY);
    });

    it('answers conditional requests with 304 Not Modified', async () => {
      const { headers } = await get('/assets/index-abc123.js');
      const revalidated = await get('/assets/index-abc123.js', {
        headers: { 'If-None-Match': headers.etag },
      });
      expect(revalidated.status).toBe(304);
      expect(revalidated.body.length).toBe(0);
    });

    it('sends headers without a body for HEAD requests', async () => {
      const response = await get('/assets/index-abc123.js', { method: 'HEAD' });
      expect(response.status).toBe(200);
      expect(Number(response.headers['content-length'])).toBe(Buffer.byteLength(SCRIPT_BODY));
      expect(response.body.length).toBe(0);
    });
  });

  describe('missing files', () => {
    it.each([
      '/assets/missing-abc123.js',
      '/assets/missing.css',
      '/data/missing.json',
      `/data/${COMMIT_SHA}/symbols/missing.json`,
      '/favicon.ico',
      '/robots.txt',
      '/symbols/xrpl/source.js.map',
      '/404.html',
      '/src/main.jsx',
      '/package.json',
      '/package-lock.json',
      '/README.md',
      '/railpack.json',
      '/scripts/deployment/serve.js',
    ])('returns a plain-text 404, never the application shell, for %s', async (path) => {
      const response = await get(path);
      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body.toString()).toBe('Not found\n');
    });
  });

  describe('request hardening', () => {
    it.each([
      '/.env',
      '/.git/config',
      '/.nojekyll',
      '/assets/.hidden.js',
      '/.well-known/anything',
      '/%2Eenv',
    ])('does not serve hidden files such as %s', async (path) => {
      const response = await get(path);
      expect(response.status).toBe(404);
      expect(response.body.toString()).toBe('Not found\n');
    });

    it('does not follow symbolic links out of the site', async () => {
      const response = await get('/linked-secret.txt');
      expect(response.status).toBe(404);
      expect(response.body.toString()).not.toContain(OUTSIDE_SECRET);
    });

    it.each([
      '/../secret.txt',
      '/../package.json',
      '/assets/../../secret.txt',
      '/%2e%2e/secret.txt',
      '/%2E%2E%2Fsecret.txt',
      '/assets/%2e%2e%2f%2e%2e%2fsecret.txt',
      '/symbols/..%2F..%2Fsecret.txt',
      '/./index.html',
      '/assets/..%5C..%5Csecret.txt',
      '/%5C..%5Csecret.txt',
      '/index.html%00.js',
      '/%E0%A4%A',
      '/%zz',
      '//evil.example/path',
    ])('rejects the malformed or traversal path %s with 400', async (path) => {
      const response = await get(path);
      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
      expect(response.body.toString()).toBe('Bad request\n');
      expect(response.body.toString()).not.toContain(OUTSIDE_SECRET);
    });

    it('rejects absolute-form and asterisk request targets', async () => {
      expect(await socketRequest(port, 'GET http://evil.example/../secret.txt HTTP/1.1')).toMatch(
        /^HTTP\/1\.1 400/,
      );
      expect(await socketRequest(port, 'OPTIONS * HTTP/1.1')).toMatch(/^HTTP\/1\.1 405/);
    });

    it('answers garbage on the socket with 400 and no details', async () => {
      const response = await socketRequest(port, 'NOT AN HTTP REQUEST');
      expect(response).toMatch(/^HTTP\/1\.1 400 Bad Request/);
      expect(response).not.toMatch(/Error|at |node:/);
    });

    it.each(['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'TRACE'])('refuses %s with 405', async (method) => {
      const response = await get('/', { method });
      expect(response.status).toBe(405);
      expect(response.headers.allow).toBe('GET, HEAD');
    });
  });

  describe('security headers', () => {
    it('sends the security headers on pages, assets and errors', async () => {
      for (const path of ['/', '/assets/index-abc123.js', '/assets/missing.js', '/..%2F']) {
        const { headers } = await get(path);
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['cross-origin-opener-policy']).toBe('same-origin');
        expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
        expect(headers['x-powered-by']).toBeUndefined();
      }
    });

    it('allows only the inline theme script by its hash', async () => {
      const policy = (await get('/')).headers['content-security-policy'];
      const hash = createHash('sha256').update(THEME_SCRIPT).digest('base64');
      expect(policy).toContain(`script-src 'self' 'sha256-${hash}'`);
      expect(policy).not.toContain('unsafe-inline');
      expect(policy).not.toContain('unsafe-eval');
      expect(policy).toContain("default-src 'self'");
      expect(policy).toContain("object-src 'none'");
    });

    it('allows only the Cloudflare Web Analytics beacon and its reporting origin as external sources', async () => {
      const directives = Object.fromEntries(
        (await get('/')).headers['content-security-policy'].split('; ').map((directive) => {
          const [name, ...sources] = directive.split(' ');
          return [name, sources];
        }),
      );
      const external = (sources) => sources.filter((source) => source.startsWith('https:'));
      expect(external(directives['script-src'])).toEqual([
        'https://static.cloudflareinsights.com/beacon.min.js',
      ]);
      expect(directives['connect-src']).toEqual(["'self'", 'https://cloudflareinsights.com']);
      for (const name of ['default-src', 'style-src', 'img-src', 'font-src']) {
        expect(external(directives[name]), name).toEqual([]);
      }
    });

    it('sends HSTS only for requests that arrived over HTTPS', async () => {
      expect((await get('/')).headers['strict-transport-security']).toBeUndefined();
      const secure = await get('/', { headers: { 'X-Forwarded-Proto': 'https' } });
      expect(secure.headers['strict-transport-security']).toBe('max-age=31536000');
    });
  });
});

describe('loadSite', () => {
  it('refuses a directory without a production build', () => {
    const root = mkdtempSync(join(tmpdir(), 'xcr-empty-'));
    expect(() => loadSite(root)).toThrow(SiteLoadError);
    rmSync(root, { recursive: true, force: true });
  });

  it('refuses a build without the documentation dataset', () => {
    const root = mkdtempSync(join(tmpdir(), 'xcr-no-data-'));
    writeFiles(root, { 'index.html': INDEX_HTML });
    expect(() => loadSite(root)).toThrow(/data\/current\.json is missing/);
    rmSync(root, { recursive: true, force: true });
  });

  it('refuses a build whose dataset manifest is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'xcr-no-manifest-'));
    writeFiles(root, {
      'index.html': INDEX_HTML,
      'data/current.json': JSON.stringify({ commitSha: COMMIT_SHA, manifest: `${COMMIT_SHA}/manifest.json` }),
    });
    expect(() => loadSite(root)).toThrow(/manifest\.json is missing/);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('classifyRequestPath', () => {
  it('treats paths under the asset directories or with file extensions as assets', () => {
    expect(classifyRequestPath('/assets/x').kind).toBe('asset');
    expect(classifyRequestPath('/data/x').kind).toBe('asset');
    expect(classifyRequestPath('/logo.png').kind).toBe('asset');
    expect(classifyRequestPath('/symbols/xrpl/STTx').kind).toBe('route');
  });
});
