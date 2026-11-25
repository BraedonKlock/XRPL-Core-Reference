import js from '@eslint/js';
import globals from 'globals';
import importPlugin, { createNodeResolver } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';

const noSourceComments = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow comments in application source code' },
    messages: { comment: 'Source comments are not allowed. Express intent through naming instead.' },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type !== 'Shebang') {
            context.report({ loc: comment.loc, messageId: 'comment' });
          }
        }
      },
    };
  },
};

export default [
  {
    ignores: [
      'node_modules/',
      '.cache/',
      'coverage/',
      'dist/',
      'public/data/',
      'playwright-report/',
      'test-results/',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.node },
    },
    settings: {
      'import-x/resolver-next': [createNodeResolver()],
    },
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
    plugins: {
      'import-x': importPlugin,
      project: { rules: { 'no-source-comments': noSourceComments } },
    },
    rules: {
      'project/no-source-comments': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'no-implicit-globals': 'error',
      'no-shadow': 'error',
      'no-param-reassign': ['error', { props: false }],
      eqeqeq: ['error', 'always'],
      'object-shorthand': 'error',
      'no-duplicate-imports': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-self-import': 'error',
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'never',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{js,jsx}', 'tests/e2e/**/*.js', 'tests/setup/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/scripts/**'],
              message: 'The browser must depend only on the published data contract.',
            },
            { group: ['node:*'], message: 'Node built-ins are not available in the browser.' },
          ],
        },
      ],
    },
  },
];
