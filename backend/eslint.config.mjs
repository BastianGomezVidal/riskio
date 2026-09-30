import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// Type-aware linting. oxlint stays the fast gate; this is the one that needs a
// TypeScript program and can therefore see types. Both run, neither replaces
// the other.
//
// Every rule switched off below is off for a stated reason, and each was
// looked at rather than silenced on sight. A rule nobody ever fixes is worse
// than no rule, because it teaches you to skim past the output.
const OFF = {
  // 187 findings. The `any` lives where a DTO, a query builder or a
  // third-party SDK hands back something untyped. Typing those boundaries
  // properly is a refactor of the data layer, not a lint fix, and doing it
  // half-way would be worse than leaving it visible.
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-return': 'off',

  // 50 findings, all in the repository ports. A port implements an async
  // interface and stays async for that reason even when the body is
  // synchronous; dropping `async` would change the interface it satisfies.
  '@typescript-eslint/require-await': 'off',

  // 56 findings, 46 of them auto-fixable. These are genuinely dead `as`
  // casts and are worth removing, but that is 56 edits across the tree and
  // belongs in its own reviewable commit rather than inside the one that
  // introduces the tooling. This is the immediate next step.
  '@typescript-eslint/no-unnecessary-type-assertion': 'off',

  // 3 findings, checked and found not to be defects. pino is configured
  // with `formatters.level` in config/observability.module.ts, which makes
  // it emit levels as the string label, so `String(record.level)` is a no-op
  // and the SEVERITY lookup resolves. The type is only `unknown` because it
  // came out of JSON.parse. Turning this on would be a change with no
  // behaviour behind it.
  '@typescript-eslint/no-base-to-string': 'off',

  // 3 findings, all `${err}` in a catch block. `err` is `unknown` under
  // useUnknownInCatchVariables, and stringifying an Error is correct at
  // runtime. This is the rule fighting the type system, not the code.
  '@typescript-eslint/restrict-template-expressions': 'off',

  // One finding, at the XML parser boundary in nhc-parser.ts. The output of
  // the mapping is typed as RssItem, which is the direction that matters; the
  // input is the NHC document as the parser hands it over, with namespaced
  // keys and no schema. Giving it a real type means narrowing at every
  // `raw['nhc:...']` access, which is a job for whenever that document is
  // modelled, not for a lint rule to force.
  '@typescript-eslint/no-explicit-any': 'off',

  // NestJS DI tokens and decorator arguments are `void`-returning by
  // signature, which the rule reads as a misused promise.
  '@typescript-eslint/no-misused-promises': 'off',
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'test/pacts/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...OFF,
      // Requiring explicit return types on every NestJS provider method
      // is noise; the interface already declares them.
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Unused args are legitimate when a signature has to match an
      // interface. The underscore prefix is the opt-out.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // Tests assert on malformed input on purpose and stub modules, so the
    // type-aware rules that object to both are off here.
    files: ['test/**/*.ts', 'src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
    },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
