#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProductionServer, loadSite, SiteLoadError } from './production-server.js';

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE_ROOT = join(PROJECT_ROOT, 'dist');
const HOST = '0.0.0.0';
const DEFAULT_PORT = 8080;
const SHUTDOWN_GRACE_MILLISECONDS = 10000;

function portFromEnvironment(value) {
  if (value === undefined || value === '') {
    return DEFAULT_PORT;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new SiteLoadError(`PORT must be an integer between 1 and 65535; received "${value}".`);
  }
  return port;
}

function start() {
  const port = portFromEnvironment(process.env.PORT);
  const site = loadSite(SITE_ROOT);
  const server = createProductionServer(site, {
    onError: (error) => console.error(`Request failed: ${error.name}: ${error.message}`),
  });
  server.listen(port, HOST, () => {
    console.log(
      `XRPLD C++ Reference: serving ${site.files.size} files for rippled ${site.commitSha.slice(0, 12)} on ${HOST}:${port}`,
    );
  });
  const shutdown = (signal) => {
    console.log(`Received ${signal}; shutting down.`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MILLISECONDS).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

try {
  start();
} catch (error) {
  const message = error instanceof SiteLoadError ? error.message : `${error.name}: ${error.message}`;
  console.error(`XRPLD C++ Reference failed to start. ${message}`);
  process.exit(1);
}
