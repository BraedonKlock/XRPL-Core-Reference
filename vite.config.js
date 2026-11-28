import { copyFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { excludeDraftNotes } from './scripts/build/exclude-draft-notes.js';

const OUTPUT_DIRECTORY = process.env.XCR_OUT_DIR ?? 'dist';
const ANALYTICS_ENABLED = process.env.XCR_BASE_PATH === undefined;
const ANALYTICS_SCRIPT =
  /\s*<script\b[^>]*\bsrc="https:\/\/static\.cloudflareinsights\.com\/[^"]*"[^>]*><\/script>/g;

function analyticsBeacon() {
  return {
    name: 'xcr-analytics-beacon',
    transformIndexHtml: (html) => (ANALYTICS_ENABLED ? html : html.replace(ANALYTICS_SCRIPT, '')),
  };
}

function staticHostingFiles() {
  let outputDirectory = OUTPUT_DIRECTORY;
  return {
    name: 'xcr-static-hosting-files',
    apply: 'build',
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      copyFileSync(join(outputDirectory, 'index.html'), join(outputDirectory, '404.html'));
      writeFileSync(join(outputDirectory, '.nojekyll'), '');
    },
  };
}

export default defineConfig({
  base: process.env.XCR_BASE_PATH ?? '/',
  plugins: [excludeDraftNotes(), react(), analyticsBeacon(), staticHostingFiles()],
  optimizeDeps: {
    entries: ['index.html', 'src/**/*.{js,jsx}', '!src/**/*.test.{js,jsx}'],
  },
  build: {
    outDir: OUTPUT_DIRECTORY,
    sourcemap: false,
  },
});
