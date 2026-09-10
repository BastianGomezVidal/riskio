import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.integration-spec.ts'],
    setupFiles: ['test/setup-integration.ts'],
    // Files run sequentially in one worker so the shared test database is
    // dropped/recreated cleanly for each file.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});