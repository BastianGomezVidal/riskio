#!/usr/bin/env bash
#
# dev.sh — el bucle rapido de desarrollo.
#
# QUE HACE Y POR QUE ESTA PARTIDO ASI
#
# Editar un fichero era un rebuild de 60 segundos. Aqui los contenedores se
# llevan lo que no cambia mientras escribes — Postgres, Redis, SeaweedFS y los
# seis servicios backend, construidos una vez — y en el host quedan solo las dos
# cosas que realmente editas: la API con `nest start --watch` y la SPA con vite.
# Tocar un fichero pasa a ser recargar la pagina.
#
# `podman-compose up --build` sigue siendo la forma de mirar la aplicacion
# entera, construida y en modo produccion. Este script es para el bucle de
# trabajo, no para enseñar la app.
#
# LA API EN EL 3100, Y POR QUE
#
# El compose publica la API en 3000. Aqui va en 3100 a proposito: asi los dos
# pueden estar levantados a la vez, con la app real mostrando el build de
# produccion en el 80 y tu version en caliente en el 5173. Si compartieran
# puerto, cambiar de uno a otro implicaria tirar uno abajo.
#
# LOS PUERTOS LOOPBACK DE LOS SERVICIOS
#
# Los seis servicios solo se alcanzaban por DNS de compose. Un proceso en el
# host no resuelve `backend-auth`, asi que la API en watch no habria podido
# llamar a nada. Por eso los seis publican ahora un puerto en 127.0.0.1: es lo
# unico que ha cambiado en la exposicion, y sigue siendo solo local.
#
# EL .ENV MANDA, Y ESTO LO RESPETA
#
# El script carga `.env` y `.env.local`, y por eso las URLs se DERIVAN de los
# puertos despues de cargarlos, no se fijan antes. Dos veces que se hizo al reves
# y las dos salieron mal: `DATABASE_URL` llegaba con host `db`, que solo resuelve
# dentro de compose, y la API moria con ENOTFOUND; y `VITE_API_URL` apuntaba al
# stack de compose, asi que vite hablaba con la API del 3000 mientras la de
# desarrollo escuchaba en el 3100 sin que nadie la usara. Si anades un valor
# aqui, ponlo despues de `load_env`, no antes.
#
# MODOS DE USO
#
#   ./dev.sh              infra + servicios + API + web     (lo normal)
#   ./dev.sh infra        solo Postgres, Redis y SeaweedFS
#   ./dev.sh services     los seis servicios backend
#   ./dev.sh api          solo la API, en watch
#   ./dev.sh web          solo la SPA
#   ./dev.sh status       que hay levantado
#   ./dev.sh stop         pararcontainers (deja caer tambien los de compose)
#
#   tail -f .dev-logs/api.log     ver la API mientras recompila
#   tail -f .dev-logs/web.log      ver vite
#
# VARIABLES
#
# Todas se pueden cambiar desde el entorno o desde `.env.local` (esta en
# .gitignore). Las que se usan a menudo:
#
#   DEV_API_PORT=3100          puerto de la API en el host
#   DEV_WEB_PORT=5173          puerto de vite
#   AUTH_PORT=3008             puerto loopback del servicio de auth
#   CACHE_PORT=3005            idem cache        FEEDS_PORT=3006   idem feeds
#   WEATHER_PORT=3007          idem weather      DASHBOARD_PORT=3009 idem dashboard
#   STORAGE_API_PORT=3004      idem storage. OJO: no es STORAGE_PORT, que ya es
#                             el de SeaweedFS (8333). Mezclarlos fue el error
#                             que hizo que auth recibiera el puerto de storage.
#   DEV_VITE_API_URL=...       forzar la URL que ve la SPA (si no, se deriva)
#   LOG_DIR=.dev-logs          donde van los logs de API y web
#
# NOTAS PRACTICAS
#
# - Ctrl-C para la API y la SPA; los containers se quedan levantados. `./dev.sh stop`
#   para todo. Es deliberado: tardar 30 s en levantar la base de datos cada vez
#   que se para a tomar un cafe es peor que dejar un postgres en memoria.
# - La primera compilacion de nest tarda (~15-20 s). El script lo dice mientras
#   espera, y comprueba que el PID siga vivo: un proceso muerto y un build lento
#   se ven igual, y esperar 115 s a algo que ya no existe no es tener paciencia.
# - Los containers se construyen una vez. Si tocas codigo de un servicio backend
#   hay que reconstruirlo: `./dev.sh services` no lo hace por ti, porque rehacer
#   las seis imagenes en cada arranque cuesta mas que lo que ahorra.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# --------------------------------------------------------------------------
# Variables. Defaults are the ones you want most of the time; override any of
# them from the shell or from .env.local.
# --------------------------------------------------------------------------
DEV_API_PORT="${DEV_API_PORT:-3100}"      # the host API. Not 3000: compose owns
                                          # that, so both can run at once.
DEV_WEB_PORT="${DEV_WEB_PORT:-5173}"      # vite's own default.
BACKEND_API_PORT="${BACKEND_API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-80}"

# These are DERIVED, after load_env, not defaulted at the top. .env carries
# VITE_API_URL and FRONTEND_URL for the compose stack — :3000 and :80 — and
# sourcing it overwrote the dev values, so vite talked to the compose API while
# the dev API sat unused on :3100. The ports are the configurable part; the URLs
# follow from them. Override the result with DEV_VITE_API_URL / DEV_FRONTEND_URL.
derive_urls() {
  VITE_API_URL="${DEV_VITE_API_URL:-http://localhost:${DEV_API_PORT}}"
  FRONTEND_URL="${DEV_FRONTEND_URL:-http://localhost:${DEV_WEB_PORT}}"
  export VITE_API_URL FRONTEND_URL
}

# The published loopback ports of the services the host API has to reach. These
# must match the ports docker-compose.yml publishes, and those are overridable
# too, so both sides read the same names.
CACHE_PORT="${CACHE_PORT:-3005}"
FEEDS_PORT="${FEEDS_PORT:-3006}"
WEATHER_PORT="${WEATHER_PORT:-3007}"
AUTH_PORT="${AUTH_PORT:-3008}"
DASHBOARD_PORT="${DASHBOARD_PORT:-3009}"
STORAGE_API_PORT="${STORAGE_API_PORT:-3004}"

LOG_DIR="${LOG_DIR:-$ROOT/.dev-logs}"

# The containers that do not need a rebuild loop.
INFRA=(db redis storage)
# The services the host API calls. backend-api itself is deliberately absent:
# in dev it is the watch process below.
SERVICES=(backend-cache backend-feeds backend-storage backend-weather backend-auth backend-dashboard)

# --------------------------------------------------------------------------
# Output. Every step says what it is about to do and then says what happened,
# because a silent script is indistinguishable from a hung one.
# --------------------------------------------------------------------------
if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'
  YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi

step()  { printf '%s==>%s %s\n' "$BLUE$BOLD" "$RESET" "$*"; }
info()  { printf '    %s\n' "$*"; }
ok()    { printf '    %s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn()  { printf '    %s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
die()   { printf '%serror:%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not installed"; }

# Waits for something to answer, and says so while it waits. This is the whole
# reason the script does not simply sleep: a fixed sleep either wastes ten
# seconds every run or gives up before the service is up.
wait_for() {
  local url="$1" name="$2" tries="${3:-60}" i=1
  while (( i <= tries )); do
    if curl -fsS -o /dev/null --max-time 2 "$url" 2>/dev/null; then
      ok "$name is up ($url)"
      return 0
    fi
    if (( i % 5 == 0 )); then
      info "still waiting for $name (${i}s)…"
    fi
    sleep 1
    (( i++ ))
  done
  warn "$name did not answer at $url after ${tries}s — carrying on anyway"
  return 1
}

load_env() {
  # Compose reads .env itself. The host processes need it too, and the values
  # the host API needs are not the ones compose resolves.
  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
  if [[ -f .env.local ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env.local
    set +a
    info "loaded .env.local"
  fi
}

# Same, but gives up the moment the process behind it is gone.
wait_for_watchdog() {
  local url="$1" name="$2" tries="$3" pid="$4" logfile="$5" i=1
  while (( i <= tries )); do
    if curl -fsS -o /dev/null --max-time 2 "$url" 2>/dev/null; then
      ok "$name is up ($url)"
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      die "$name exited after $(( i - 1 ))s. last lines of $logfile:
$(sed 's/^/      /' "$logfile" | tail -12)"
    fi
    if (( i % 5 == 0 )); then
      info "still waiting for $name (${i}s)…"
    fi
    sleep 1
    (( i++ ))
  done
  warn "$name did not answer at $url after ${tries}s — carrying on anyway"
  return 1
}

compose() { podman-compose "$@"; }

# --------------------------------------------------------------------------
# Steps
# --------------------------------------------------------------------------
start_infra() {
  step "Infrastructure: ${INFRA[*]}"
  compose up -d "${INFRA[@]}"
  wait_for "http://localhost:${STORAGE_PORT:-8333}/" "seaweedfs" 30 || true
  # Postgres and Redis answer on TCP rather than HTTP; podman reports health.
  local waited=0
  while (( waited < 60 )); do
    if compose ps --format json 2>/dev/null | grep -q '"Health":"healthy"'; then break; fi
    info "waiting on containers (${waited}s)…"
    sleep 2
    (( waited += 2 ))
  done
  ok "infrastructure up"
}

start_services() {
  step "Backend services: ${SERVICES[*]}"
  info "these are built images; the API is the only thing that hot-reloads"
  compose up -d "${SERVICES[@]}"
  wait_for "http://localhost:${AUTH_PORT}/health" "auth" 90
  wait_for "http://localhost:${CACHE_PORT}/health" "cache" 60
  wait_for "http://localhost:${DASHBOARD_PORT}/health" "dashboard" 60
  ok "services up"
}

# The host API. Environment is spelled out rather than inherited from compose,
# because compose resolves service names on the compose network and this process
# is not on it.
api_env() {
  # DATABASE_URL is rebuilt from the parts rather than inherited, on purpose.
  # .env carries the compose value, whose host is `db` — a name that only
  # resolves inside the compose network. A process on the host cannot resolve it
  # and dies with ENOTFOUND, which is exactly what happened the first time.
  # Same for every service URL below: localhost plus the published port, never
  # whatever the containers use between themselves.
  cat <<ENV
DATABASE_URL=postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-riskio}
CACHE_SERVICE_URL=http://localhost:${CACHE_PORT}
FEEDS_SERVICE_URL=http://localhost:${FEEDS_PORT}
WEATHER_SERVICE_URL=http://localhost:${WEATHER_PORT}
AUTH_SERVICE_URL=http://localhost:${AUTH_PORT}
DASHBOARD_SERVICE_URL=http://localhost:${DASHBOARD_PORT}
STORAGE_API_URL=http://localhost:${STORAGE_API_PORT}
CORS_ORIGINS=${FRONTEND_URL}
FRONTEND_URL=${FRONTEND_URL}
PORT=${DEV_API_PORT}
NODE_ENV=development
ENV
}

start_api() {
  step "API on :${DEV_API_PORT} (watch)"
  mkdir -p "$LOG_DIR"
  (
    cd backend
    # shellcheck disable=SC2046
    env $(api_env) npm run start:dev
  ) >"$LOG_DIR/api.log" 2>&1 &
  API_PID=$!
  info "pid $API_PID, log $LOG_DIR/api.log"
  # A process that has already exited is not "still starting". Waiting 120s on
  # a dead PID reads exactly like a slow build, so check liveness as we poll
  # and show the log when it dies.
  wait_for_watchdog "http://localhost:${DEV_API_PORT}/health" "api (first nest build is slow)" 120 "$API_PID" "$LOG_DIR/api.log"
  info "swagger on http://localhost:${DEV_API_PORT}/docs"
}

start_web() {
  step "SPA on :${DEV_WEB_PORT} (vite)"
  mkdir -p "$LOG_DIR"
  (
    cd frontend
    VITE_API_URL="$VITE_API_URL" npm run dev -- --port "$DEV_WEB_PORT" --strictPort
  ) >"$LOG_DIR/web.log" 2>&1 &
  WEB_PID=$!
  info "pid $WEB_PID, log $LOG_DIR/web.log"
  wait_for_watchdog "http://localhost:${DEV_WEB_PORT}/" "vite" 60 "$WEB_PID" "$LOG_DIR/web.log"
  info "talking to $VITE_API_URL"
}

cleanup() {
  trap - INT TERM EXIT
  step "stopping"
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null || true
  ok "api and web stopped; containers left running (./dev.sh stop for those)"
}

status() {
  step "containers"
  compose ps
  step "host processes"
  for name in api web; do
    if [[ -f "$LOG_DIR/$name.log" ]]; then
      printf '    %s: %s\n' "$name" "$(tail -1 "$LOG_DIR/$name.log" | cut -c1-90)"
    else
      printf '    %s: not started\n' "$name"
    fi
  done
}

stop_all() {
  step "stopping everything this script started"
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  compose down
}

main() {
  need podman-compose
  need curl
  load_env
  derive_urls

  local target="${1:-all}"
  case "$target" in
    infra)    start_infra ;;
    services) start_services ;;
    api)      trap cleanup INT TERM; start_api; wait "$API_PID" ;;
    web)      trap cleanup INT TERM; start_web; wait "$WEB_PID" ;;
    status)   status ;;
    stop)     stop_all ;;
    all)
      trap cleanup INT TERM
      start_infra
      start_services
      start_api
      start_web
      step "ready"
      printf '    %sapp%s     http://localhost:%s\n' "$BOLD" "$RESET" "$DEV_WEB_PORT"
      printf '    %sapi%s     http://localhost:%s/health\n' "$BOLD" "$RESET" "$DEV_API_PORT"
      printf '    %sswagger%s http://localhost:%s/docs\n' "$BOLD" "$RESET" "$DEV_API_PORT"
      printf '    %slogs%s    tail -f %s/{api,web}.log\n' "$BOLD" "$RESET" "$LOG_DIR"
      warn "Ctrl-C stops the API and the SPA, leaves the containers up"
      wait
      ;;
    *)
      die "unknown target '$target'. try: all, infra, services, api, web, status, stop"
      ;;
  esac
}

main "$@"
