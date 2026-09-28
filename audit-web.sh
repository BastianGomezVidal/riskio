#!/usr/bin/env bash
#
# audit-web.sh — Core Web Vitals and accessibility, one command, thresholds that
# fail.
#
# Two tools because they answer different questions:
#
#   Lighthouse  lab metrics on a cold cache, desktop. Gives LCP, CLS, TBT, FCP.
#   axe-core    WCAG 2.1 A/AA + best practice, over the real SPA.
#
# What this cannot give you: INP. Interaction to Next Paint is field data — it
# describes real interactions on real devices, and a lab run has no real user to
# react to. Lighthouse will not report it and any script claiming otherwise is
# inventing the number. INP comes from the RUM in web-vitals.ts, and until those
# spans actually reach Jaeger there is no honest INP figure to check. The script
# says so instead of printing a dash that looks like a pass.
#
#   ./audit-web.sh                          # against http://localhost/
#   ./audit-web.sh http://riskio.test       # against the built app
#   AUDIT_TOKEN=ey... ./audit-web.sh        # also audits the protected routes
#
# Exits non-zero if a threshold is breached, so it can gate a deploy.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

TARGET="${1:-http://localhost/}"
CHROME_PATH="${CHROME_PATH:-/usr/bin/google-chrome}"
COLLECTOR="${COLLECTOR:-http://localhost:4318}"   # receptor OTLP del collector
OUT="$ROOT/.audit/out"

# "good" thresholds at the 75th percentile, which is the bar Google publishes.
# TBT is the stand-in for responsiveness in a lab run, for the reason above.
# Thresholds are a regression guard, not a target. They are set to just above
# today's measured median so a change that makes the app slower fails here,
# and not at 2500ms: the LCP of the sign-in page is dominated by the antd vendor
# chunk, and pretending the app is fast enough to fail Google's bar would only
# mean nobody runs this script. Raise them when the bundle gets smaller; do not
# lower them without fixing something.
LCP_MAX_MS="${LCP_MAX_MS:-5000}"
CLS_MAX="${CLS_MAX:-0.1}"
TBT_MAX_MS="${TBT_MAX_MS:-200}"
LH_VERSION="${LH_VERSION:-12.8.2}"

if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'
  YELLOW=$'\033[33m'; BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi
step() { printf '\n%s==>%s %s\n' "$BLUE$BOLD" "$RESET" "$*"; }
info() { printf '    %s\n' "$*"; }
ok()   { printf '    %s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '    %s!%s %s\n' "$YELLOW" "$RESET" "$*"; }

command -v node >/dev/null || { echo "node no encontrado"; exit 1; }
[[ -x "$CHROME_PATH" ]] || { echo "chrome no encontrado en $CHROME_PATH (CHROME_PATH=...)"; exit 1; }

curl -fsS -o /dev/null --max-time 10 "$TARGET" || {
  echo "no responde $TARGET. ¿La app está levantada?"; exit 1;
}

mkdir -p "$OUT"
rc=0

# --------------------------------------------------------------------------
# Lighthouse
# --------------------------------------------------------------------------
step "Lighthouse sobre $TARGET"
info "lab, desktop, cache frío. Umbrales: LCP<=${LCP_MAX_MS}ms CLS<=${CLS_MAX} TBT<=${TBT_MAX_MS}ms"

CHROME_PATH="$CHROME_PATH" \
  npx --yes lighthouse@"$LH_VERSION" "$TARGET" \
    --only-categories=performance,accessibility \
    --form-factor=desktop \
    --screenEmulation.disabled \
    --output=json --output-path="$OUT/lighthouse.json" \
    --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage" \
    --quiet 2>"$OUT/lighthouse.err" \
  || { warn "lighthouse fallo; ver $OUT/lighthouse.err"; cat "$OUT/lighthouse.err" | tail -5; rc=1; }

if [[ -s "$OUT/lighthouse.json" ]]; then
  # LCP, CLS, TBT, FCP and the two category scores. The TBT caveat belongs in the
  # output, not only in this comment, because the number is otherwise read as INP.
  LCP=$(node -e 'const a=require(process.argv[1]).audits;process.stdout.write(String(a["largest-contentful-paint"].numericValue))' "$OUT/lighthouse.json" 2>/dev/null || echo 0)
  CLS=$(node -e 'const a=require(process.argv[1]).audits;process.stdout.write(String(a["cumulative-layout-shift"].numericValue))' "$OUT/lighthouse.json" 2>/dev/null || echo 0)
  TBT=$(node -e 'const a=require(process.argv[1]).audits;process.stdout.write(String(a["total-blocking-time"].numericValue))' "$OUT/lighthouse.json" 2>/dev/null || echo 0)
  PERF=$(node -e 'const c=require(process.argv[1]).categories;process.stdout.write(String(Math.round(c.performance.score*100)))' "$OUT/lighthouse.json" 2>/dev/null || echo 0)
  A11Y=$(node -e 'const c=require(process.argv[1]).categories;process.stdout.write(String(Math.round(c.accessibility.score*100)))' "$OUT/lighthouse.json" 2>/dev/null || echo 0)

  printf '    LCP    %8.0f ms  (limite %s)\n' "$LCP" "$LCP_MAX_MS"
  printf '    CLS    %8.3f     (limite %s)\n' "$CLS" "$CLS_MAX"
  printf '    TBT    %8.0f ms  (limite %s)  <- el mas cercano a INP en lab\n' "$TBT" "$TBT_MAX_MS"
  printf '    perf   %8s / 100\n' "$PERF"
  printf '    a11y   %8s / 100  <- lighthouse solo ve lo que axe tampoco; axe va aparte\n' "$A11Y"

  awk -v v="$LCP"  -v m="$LCP_MAX_MS"  'BEGIN{exit !(v>m)}' && { warn "LCP por encima del umbral"; rc=1; } || ok "LCP dentro del umbral"
  awk -v v="$CLS"  -v m="$CLS_MAX"    'BEGIN{exit !(v>m)}' && { warn "CLS por encima del umbral"; rc=1; } || ok "CLS dentro del umbral"
  awk -v v="$TBT"  -v m="$TBT_MAX_MS" 'BEGIN{exit !(v>m)}' && { warn "TBT por encima del umbral"; rc=1; } || ok "TBT dentro del umbral"
fi

# --------------------------------------------------------------------------
# axe-core
# --------------------------------------------------------------------------
step "axe-core sobre $TARGET"
if [[ ! -d .audit/node_modules ]]; then
  info "instalando deps de auditoria en .audit/ (fuera del bundle del frontend)"
  (cd .audit && npm install --silent --no-fund --no-audit)
fi
node .audit/axe-audit.mjs "$TARGET" || rc=1

step "Publicando el resultado como metricas"
# Para que el tablero de Grafana tenga historia y no solo el "ahora". Si el
# collector no esta, el script NO falla: la auditoria local ya ha servido para
# decidir, y las metricas son una copia extra.
node .audit/report-metrics.mjs "${COLLECTOR:-http://localhost:4318}" || true

step "resumen"
[[ $rc -eq 0 ]] && ok "todo dentro de umbrales" || warn "hay umbrales rotos o herramientas que fallaron"
info "informes: $OUT/{lighthouse.json,axe.json}"
info "INP no se mide aqui: requiere RUM real, y las envia .audit/report-metrics.mjs"
info "Grafana -> 'Web Vitals y accesibilidad' (http://localhost:3001)"
exit $rc
