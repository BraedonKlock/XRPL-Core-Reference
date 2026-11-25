import { copyFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const OUTPUT_DIRECTORY = process.env.XCR_OUT_DIR ?? 'dist';

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
  plugins: [react(), staticHostingFiles()],
  build: {
    outDir: OUTPUT_DIRECTORY,
    sourcemap: false,
  },
});
