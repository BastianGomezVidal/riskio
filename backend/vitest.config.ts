import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    // scripts/ is included on purpose: dev-fixtures.spec.ts covers the advisory
    // counter, and the failure mode it guards against is a silent skip that
    // looks like a healthy ingestion run. A helper that only breaks in the
    // developer's hands is a helper that will.
    include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
    exclude: ['**/*.integration-spec.ts'],
  },
});
