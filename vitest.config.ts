import { parse } from 'yaml';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __TAXPRESSO_VERSION__: JSON.stringify('0.0.0-test') },
  plugins: [
    {
      // Same as the esbuild plugin in extension/scripts/build.mjs: YAML data becomes a plain object.
      name: 'taxpresso-yaml',
      transform(code, id) {
        if (!id.endsWith('.yaml')) return null;
        return { code: `export default ${JSON.stringify(parse(code))};`, map: null };
      },
    },
  ],
  test: {
    include: ['{extension,packages,ui,site}/**/*.test.ts'],
    environment: 'node',
    // End-to-end tests (a whole household through the server) and the seeded 2,000-household
    // comparisons take a few seconds alone, and over a minute on a machine busy with parallel work.
    testTimeout: 300_000,
  },
});
