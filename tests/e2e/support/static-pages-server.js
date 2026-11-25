#!/usr/bin/env node
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const [rootArgument = 'dist-pages', portArgument = '4174', basePath = '/XRPL-Core-Reference/'] =
  process.argv.slice(2);
const ROOT = resolve(rootArgument);
const NOT_FOUND_PAGE = join(ROOT, '404.html');
const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
});

function resolveFile(pathname) {
  if (!pathname.startsWith(basePath)) {
    return null;
  }
  const relativePath = decodeURIComponent(pathname.slice(basePath.length));
  const candidate = normalize(join(ROOT, relativePath));
  if (candidate !== ROOT && !candidate.startsWith(`${ROOT}${sep}`)) {
    return null;
  }
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    const index = join(candidate, 'index.html');
    return existsSync(index) ? index : null;
  }
  return existsSync(candidate) ? candidate : null;
}

function send(response, status, file) {
  response.writeHead(status, { 'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
}

createServer((request, response) => {
  let file;
  try {
    file = resolveFile(new URL(request.url, 'http://localhost').pathname);
  } catch {
    file = null;
  }
  if (file) {
    send(response, 200, file);
  } else {
    send(response, 404, NOT_FOUND_PAGE);
  }
}).listen(Number(portArgument), () => {
  console.log(`Serving ${ROOT} at http://localhost:${portArgument}${basePath} with GitHub Pages semantics`);
});
