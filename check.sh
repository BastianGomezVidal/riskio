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
# Exit code is non-zero if any step failed, so CI can call it and stop.

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

run "backend typecheck"  bash -c 'cd backend && npx tsc --noEmit -p tsconfig.json'
run "backend lint"       bash -c 'cd backend && npx oxlint src/ test/'
run "backend tests"      bash -c 'cd backend && npx vitest run'

# The contract test needs a live Postgres, unlike everything above it. Skipped
# rather than failed when the database is not up, so a laptop without the stack
# running still gets the other four checks; CI runs it against a service
# container and there it is not optional.
if bash -c 'cd backend && node -e "
  const {Client} = require(\"pg\");
  const c = new Client({connectionString: \"postgresql://riskio:riskio_dev_password@localhost:5432/riskio\"});
  c.connect().then(()=>c.end()).then(()=>process.exit(0)).catch(()=>process.exit(1));
"' 2>/dev/null; then
  run "contract test" bash -c 'cd backend && npx vitest run --config ./vitest.config.pact.ts --testTimeout=300000'
else
  printf '\n\033[33m    SKIPPED contract test — no Postgres on localhost:5432\033[0m\n'
fi

if [ "$FAST" -eq 0 ]; then
  run "backend coverage" bash -c 'cd backend && npx vitest run --coverage'
fi

run "frontend typecheck" bash -c 'cd frontend && npx tsc --noEmit'
run "frontend knip"      bash -c 'cd frontend && npx knip'
run "frontend build"     bash -c 'cd frontend && npx vite build'

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
