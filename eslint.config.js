import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// C2: code that runs inside the extension never opens an outbound connection. These bans are the
// first line; scripts/check-bundle.mjs and test/offline/run.mjs are the next two.
const C2 = 'C2: the extension makes no outbound network requests (SPEC.md section 2).';
const NETWORK_BUILTINS = [
  'https',
  'http2',
  'tls',
  'net',
  'dgram',
  'dns',
  'dns/promises',
  'child_process',
  'cluster',
];
const NETWORK_PACKAGES = [
  'undici',
  'axios',
  'node-fetch',
  'got',
  'ky',
  'ws',
  'eventsource',
  'superagent',
  'request',
  '@modelcontextprotocol/client',
];
const RESTRICTED_IMPORTS = [
  ...[...NETWORK_BUILTINS.flatMap((m) => [m, `node:${m}`]), ...NETWORK_PACKAGES].map((name) => ({
    name,
    message: C2,
    allowTypeImports: true,
  })),
  // node:http is allowed for the dashboard server, not for its client half.
  ...['http', 'node:http'].map((name) => ({
    name,
    importNames: ['request', 'get', 'Agent', 'globalAgent'],
    message: C2,
  })),
];

export default defineConfig(
  {
    ignores: [
      '.claude/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/build-meta/**',
      'coverage/**',
      'docs/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['vitest.config.ts', 'eslint.config.js', 'api/review.d.mts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['extension/src/**/*.ts', 'packages/*/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { paths: RESTRICTED_IMPORTS }],
      'no-restricted-globals': [
        'error',
        ...['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({
          name,
          message: C2,
        })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'http', property: 'request', message: C2 },
        { object: 'http', property: 'get', message: C2 },
      ],
    },
  },
  {
    // "Open my Taxpresso folder": the one file that runs the system's file manager, with execFile
    // only (extension/test/open-folder.test.ts pins its one call site).
    files: ['extension/src/open-folder.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            ...RESTRICTED_IMPORTS.filter(
              (r) => r.name !== 'child_process' && r.name !== 'node:child_process',
            ),
            ...['child_process', 'node:child_process'].map((name) => ({
              name,
              allowImportNames: ['execFile'],
              message: 'Only execFile, to open the folder in the file manager.',
            })),
          ],
        },
      ],
    },
  },
  {
    files: ['ui/src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  prettier,
);
