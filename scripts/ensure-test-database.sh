#!/usr/bin/env bash
#
# Makes sure the test database is reachable, starting it if it is not.
#
# The contract and integration suites are the only tests in the repository that
# touch a real Postgres: `test/setup-integration.ts` drops and recreates
# `riskio_test` before each file and lets the app run its migrations. That
# dependency is also why they were skipped rather than run. `check.sh` probed for
# the database, found nothing, and printed a line saying so, and the summary
# still said `all checks passed`. Since CI defines no database service either,
# those two suites had never executed anywhere, in any environment: 7 files and
# 31 integration tests, and a 12-test contract suite that pins every response
# shape, all of it present and verified by nobody.
#
# A skip that reads as a pass is the same defect as a linter that scans nothing
# and exits 0, which is what the semgrep control check and the gitleaks positive
# test exist to rule out. So the gate now brings the database up itself instead
# of tolerating its absence. `./scripts/check.sh` already requires podman for the semgrep
# and image stages; needing it for the database as well is the same requirement,
# not a new one.
#
#   ./scripts/ensure-test-database.sh
#
# To point at a database that is already running somewhere else, set
# DATABASE_URL and PGHOST/PGPORT as usual; this script then only probes.

set -euo pipefail

cd "$(dirname "$0")/.."

# Same values as `db:` in docker-compose.yml, which reads them from .env. The
# suites hard-code this connection string in test/setup-integration.ts, so the
# two have to agree; sourcing .env keeps that from silently drifting.
#
# Sourced without clobbering: compose gives the shell precedence over .env, and
# so does this. Source first and put back anything that was already set, or a
# caller who exports POSTGRES_PASSWORD to test a different database gets silently
# overridden and a probe that says "reachable" for a server it never reached.
if [ -f .env ]; then
  __pg_preset=()
  for __pg_var in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB POSTGRES_PORT PGHOST PGPORT; do
    [ -n "${!__pg_var:-}" ] && __pg_preset+=("${__pg_var}=${!__pg_var}")
  done
  # shellcheck disable=SC1091
  set -a && . ./.env && set +a
  for __pg_entry in ${__pg_preset+"${__pg_preset[@]}"}; do
    export "${__pg_entry?}"
  done
  unset __pg_preset __pg_var __pg_entry
fi

DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${POSTGRES_USER:-riskio}"
DB_NAME="${POSTGRES_DB:-riskio}"
DB_PASSWORD="${POSTGRES_PASSWORD:-riskio_dev_password}"
ADMIN_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# The parentheses are load-bearing. Written as a `cd backend` followed by the
# node call and then a `cd ..`, this function reports the database as reachable
# even when nothing is listening: node exits 1, but the `cd` that follows exits 0
# and that is the value the caller sees. A probe that cannot fail is worse than
# no probe, because the gate would then start a database it already believes is
# there. In a subshell the exit status is node's, which is the answer we wanted.
reachable() {
  (
    cd backend
    node -e "
      const {Client} = require('pg');
      const c = new Client({connectionString: process.argv[1]});
      c.connect()
        .then(() => c.end())
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    " "$ADMIN_URL" >/dev/null 2>&1
  )
}

if reachable; then
  echo "  postgres ya disponible en ${DB_HOST}:${DB_PORT}"
  exit 0
fi

# Already-running-but-different-credentials is a different problem from
# not-running, and the fix is not to try to start a second copy. If something is
# listening, say so and fail rather than recreating a container that will not
# help.
if command -v podman >/dev/null 2>&1; then
  if podman ps --format '{{.Names}}' 2>/dev/null | grep -qx 'riskio_db_1'; then
    echo "  riskio_db_1 esta levantado pero ${DB_HOST}:${DB_PORT} no acepta" >&2
    echo "  la conexion de .env. Revisa POSTGRES_* en .env." >&2
    exit 1
  fi

  echo "  arrancando el servicio db (Postgres)..."
  if ! podman-compose up -d db >/dev/null 2>&1; then
    echo "  no se pudo arrancar db con podman-compose." >&2
    echo "  Alternativa: levanta un Postgres accesible en ${DB_HOST}:${DB_PORT}" >&2
    echo "  con el usuario '${DB_USER}' y la base '${DB_NAME}'." >&2
    exit 1
  fi

  # pg_isready through the container, because the port mapping may still be
  # settling. 60 tries at 1s matches the healthcheck's start_period in
  # docker-compose.yml; after that the container is genuinely broken rather than
  # slow, and waiting longer only hides the error.
  for _ in $(seq 1 60); do
    if podman exec riskio_db_1 pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      if reachable; then
        echo "  postgres listo"
        exit 0
      fi
    fi
    sleep 1
  done
fi

echo "  no hay Postgres en ${DB_HOST}:${DB_PORT} y no se pudo arrancar." >&2
echo "  Sin base de datos no se pueden ejecutar los tests de contrato ni los de" >&2
echo "  integracion, y no se pueden omitir: lo que no se ejecuta no se verifica." >&2
echo >&2
echo "  Opciones:" >&2
echo "    podman-compose up -d db        levanta la base de desarrollo" >&2
echo "    export DATABASE_URL=...        apunta a un Postgres ya existente" >&2
exit 1
