#!/usr/bin/env bash
#
# Quality gate. Runs everything that can fail, in the order that fails fastest,
# and prints one summary at the end.
#
# Exists because the checks were spread across three `package.json` files and two
# directories, and "did I run all of them" was a real question. It is a script
# rather than a GitHub Actions workflow so it also runs locally, on a laptop,
# before anything is pushed.
#
#   ./check.sh          run everything
#   ./check.sh --fast   skip coverage, which is the slow part
#
# Needs podman and a container engine, for three stages: the semgrep ruleset, the
# image hardening check, and the Postgres that the contract and integration
# suites boot the app against. The database stage starts the `db` service itself
# if it is not up, so `./check.sh` on a fresh laptop brings up what it needs
# rather than skipping what it cannot find.
#
# The same script is the CI gate. `./check.sh` is the only list of commands that
# decides whether this code is good; the workflow calls it rather than repeating
# it, so a green laptop run and a green run on the remote cannot disagree.
#
# The pre-commit hook runs a smaller subset, on staged files only, because a
# hook that costs half a minute stops being used. A hook is ergonomics; this
# script, and the branch protection on the remote, is the rule.

set -uo pipefail

cd "$(dirname "$0")"

FAST=0
[ "${1:-}" = "--fast" ] && FAST=1

FAILED=()
STEP=0

run() {
  local name="$1"
  shift
  STEP=$((STEP + 1))
  printf '\n\033[1m[%d] %s\033[0m\n' "$STEP" "$name"
  if "$@"; then
    printf '\033[32m    ok\033[0m\n'
  else
    printf '\033[31m    FAILED\033[0m\n'
    FAILED+=("$name")
  fi
}

echo "=== Riskio quality gate ==="

run "backend format"      bash -c 'cd backend && npm run --silent format:check'
run "backend lint fast"   bash -c 'cd backend && npm run --silent lint:fast'
run "backend typecheck"   bash -c 'cd backend && npx tsc --noEmit -p tsconfig.json'
run "backend lint typed"  bash -c 'cd backend && npm run --silent lint:types'
run "backend duplication" bash -c 'cd backend && npm run --silent dupes'
run "backend knip"        bash -c 'cd backend && npm run --silent knip'
run "backend tests"       bash -c 'cd backend && npx vitest run'

# The contract and integration suites are the only ones that need a real
# Postgres, and they are no longer allowed to be absent. This used to probe for
# the database, print `SKIPPED contract test` when there was none, and still end
# with `all checks passed`. CI defines no database service, so both suites were
# skipped on every run the remote has ever produced: 7 files and 31 integration
# tests, plus 12 contract tests pinning every response shape, verified by nobody.
#
# A skip that reads as a pass is the same defect as a linter that scans nothing
# and exits 0. So the gate brings the database up itself rather than tolerating
# its absence, and the two suites run unconditionally below. `./check.sh` already
# required podman for the semgrep and image stages.
run "test database"       ./scripts/ensure-test-database.sh
run "contract test"       bash -c 'cd backend && npm run --silent test:pact'
run "integration tests"   bash -c 'cd backend && npm run --silent test:integration'

if [ "$FAST" -eq 0 ]; then
  run "backend coverage" bash -c 'cd backend && npx vitest run --coverage'
fi

run "frontend format"     bash -c 'cd frontend && npm run --silent format:check'
run "frontend lint fast"  bash -c 'cd frontend && npm run --silent lint:fast'
run "frontend typecheck"  bash -c 'cd frontend && npx tsc --noEmit'
run "frontend duplication" bash -c 'cd frontend && npm run --silent dupes'
run "frontend knip"       bash -c 'cd frontend && npx knip'
run "frontend build"      bash -c 'cd frontend && npx vite build'

# Static analysis over the source, with a ruleset that lives in the repo instead
# of being fetched at run time. This one is unusual: before analysing anything it
# checks that it can still detect what it claims to detect, using a throwaway
# file with three known-bad patterns. A gate that returns 0 because it silently
# scanned nothing is indistinguishable from a clean tree, and that ambiguity is
# how the six security axes in the plan came to be marked done while three of
# them did not exist. Needs podman, like the image check.
run "semgrep rules"       bash -c 'SKIP_SEMGREP_CHECK=0 ./scripts/scan-semgrep.sh'

# Last, because it is the only check that needs a container engine and the only
# one that looks at a built image rather than at the source. It is what stops
# the hardening from silently regressing: a Dockerfile change that put
# `COPY . .` back would still build fine and still pass every step above.
run "image hardening"     bash -c 'SKIP_IMAGE_CHECK=0 ./scripts/assert-hardened-image.sh'

printf '\n=== summary ===\n'
if [ ${#FAILED[@]} -eq 0 ]; then
  printf '\033[32mall checks passed\033[0m\n'
  exit 0
fi

printf '\033[31m%d failed:\033[0m\n' "${#FAILED[@]}"
for f in "${FAILED[@]}"; do
  printf '  - %s\n' "$f"
done
exit 1
