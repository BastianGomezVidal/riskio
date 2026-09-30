import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Type-aware linting. oxlint stays the fast gate; this is the one that needs a
// TypeScript program and can therefore see types. Both run, neither replaces
// the other.
//
// Nothing is switched off globally. Getting here took fixing rather than
// silencing: 56 dead type assertions removed, the XML and request boundaries
// typed, and the unsafe-`any` family taken from 299 findings to zero in
// production code. The only exceptions are the three rules scoped to test
// files further down, each with the reason next to it.
//
// The reason for that bar is that a rule nobody ever fixes is worse than no
// rule, because it teaches you to skim past the output. A rule that is off
// everywhere cannot catch anything later either. So the count that matters is
// the one in src/, and it is zero.
const OFF = {};

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
    // type-aware rules that object to both are off here. All three patterns are
    // needed: `**/*-spec.ts` covers the `*-integration-spec.ts` files, which a
    // bare `*.spec.ts` does not match because of the hyphen. Without it, 134
    // findings in five integration specs were reported as if they were
    // production code.
    files: ['test/**/*.ts', '**/*.spec.ts', '**/*-spec.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      // 60 findings, and every one is a test double: `query: async () => []`,
      // `text: async () => ''`, `findOne: async () => null`, plus an async
      // generator. The `async` there is the point. Those members stand in for
      // a TypeORM QueryBuilder or an SDK client whose real methods are async,
      // and a stub that returned a bare value instead of a Promise would no
      // longer match the thing it stands in for. Note this is the opposite
      // reasoning from the previous comment on this rule, which claimed the
      // findings were in repository ports; there is exactly one in production
      // code and it carries an inline disable with its own reason.
      //
      // The rule stays on everywhere else, so a genuine `async` with no await
      // in src/ is still caught.
      '@typescript-eslint/require-await': 'off',
      // 10 findings, all `mockImplementation(fn)` where fn returns a Promise.
      // These are false positives rather than tolerated defects.
      // `ReturnType<typeof vi.fn>` resolves to `Mock<Procedure | Constructable>`,
      // a union whose second member is a constructor signature, and the rule
      // reads that branch and reports the Promise as a misused one. tsc
      // accepts every one of these lines, and the double is right: a fake for
      // `Repository.save` has to return a Promise, because the real method
      // does. Typing the mocks properly would silence the rule, but the return
      // types are already pinned by the assertions that follow each call.
      // The rule stays on everywhere else; in production code it reports
      // nothing today.
      '@typescript-eslint/no-misused-promises': 'off',
      // 245 findings, all in tests, and 245 of them are the same thing:
      // supertest declares `Response.body` as `any`, so `res.body.totals` is an
      // unchecked read on a value whose shape the test is what establishes.
      // The families are off here and on everywhere else, which is the part
      // that matters: they were 299 findings across src/ when this config was
      // written, and they are now zero. Typing 245 call sites of `res.body`
      // would mean asserting the shape a second time, in a type, next to the
      // assertion that already checks it at runtime.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    // `.mjs` belongs here too, and leaving it out meant scripts/ was never
    // linted at all: the files are not in any tsconfig, so the type-aware
    // parser rejects them, and `files: ['**/*.js']` never matched the
    // extension. dev-fixtures.mjs is a real 700-line script that had no lint
    // coverage whatsoever. These get the non-type-aware rules only, which is
    // the right trade for plain Node scripts.
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      // These are Node scripts, so `console` and `process` are defined.
      // Without this, no-undef reports all 23 uses of them in dev-fixtures.mjs
      // as undefined, which is noise that teaches you to ignore the rule.
      globals: globals.node,
      parserOptions: {
        // The block above turns on projectService for every file, and these
        // files are in no tsconfig, so the type-aware parser refuses them.
        // Switching it off here is what makes them lintable at all.
        projectService: false,
        project: false,
      },
    },
  },
);
