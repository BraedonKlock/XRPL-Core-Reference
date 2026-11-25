import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000,
    projects: [
      {
        test: {
          name: 'pipeline',
          environment: 'node',
          include: ['scripts/**/*.test.js', 'contract/**/*.test.js', 'tests/integration/**/*.test.js'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'browser',
          environment: 'jsdom',
          include: ['src/**/*.test.{js,jsx}'],
          setupFiles: ['tests/setup/dom-setup.js'],
          css: { modules: { classNameStrategy: 'non-scoped' } },
        },
      },
    ],
  },
});
