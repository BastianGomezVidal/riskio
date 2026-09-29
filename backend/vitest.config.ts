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

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',

      /*
       * Only files the suite actually imports are counted.
       *
       * Vite's `coverage.all` used to force every matched file into the report,
       * which diluted the number with every main.ts, entity and DTO no test
       * imports: a number that moves whenever a file is added, which makes it
       * useless as a gate. Vitest 4 dropped that option and counts only what the
       * suite touched, so the `exclude` list below is about the files that
       * genuinely cannot be unit tested, not about shrinking the denominator.
       */

      /*
       * The entrypoints are the seven process bootstraps in
       * `<name>-service/main.ts`, plus the module that wires each one. They open
       * sockets and read the environment at import time, so no unit test can
       * reach inside them without starting the world. Excluding them is not a
       * way to make the number look better; they are genuinely not unit
       * testable, and pretending otherwise would only produce a test that
       * asserts `module.exports` is defined.
       */
      exclude: [
        '**/main.ts',
        '**/*.module.ts',
        '**/index.ts',
        '**/*.dto.ts',
        '**/dto/**',
        '**/entities/**',
        '**/*.entity.ts',
        '**/migrations/**',
        'src/instrumentation.ts',
        /**
         * Contracts and ports: types, interfaces, and the token constants that
         * pair with them. There is no executable statement to cover in a type
         * declaration, and a `const` used only as an injection token is listed
         * as a file with uncovered lines the moment the file is imported.
         */
        '**/contracts/**',
        '**/authz/*.ports.ts',
        '**/*.tokens.ts',
      ],

      /*
       * Thresholds. `npm run coverage` fails below them, which is what makes
       * the number a gate rather than a decoration.
       *
       * Set just under the measured values (72.4% lines, 73.0% functions,
       * 71.9% statements, 68.4% branches) so one uncovered line does not turn
       * the suite red, but a real regression in what is tested does. Raise them
       * deliberately as coverage improves; do not let them ratchet.
       *
       * The gaps are known and worth naming rather than hiding behind an
       * exclude: `storms.service.ts` and `users.service.ts` are the two lowest,
       * and `computeFindMany` in particular assembles its filter list in a way
       * that is easy to get wrong. Those are the places to write tests next.
       */
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
  },
});
