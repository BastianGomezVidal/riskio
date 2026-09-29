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

# TBT va en 300, no en los 200 de Google, y la diferencia es deliberada.
#
# Con mediana de 3 runs la portada mide 257 ms (rango 200-273). Los 200 de
# Google estan al borde del rango, asi que como puerta solo producia un rojo
# permanente, que es la forma mas rapida de enseñar a ignorar un audit.
#
# 200 sigue siendo el objetivo, pero no la puerta. Bajar de 300 exige un
# recorte real del bundle, no tocar el numero: el login usa antd de verdad
# (`InternalAuth` con Input+Button, `ThemeProvider` con ConfigProvider+App), asi
# que el TBT lo domina evaluar React (82 kB) + antd (183 kB) antes del primer
# pintado. Se descarto hacer lazy el error boundary porque no ahorraba nada: el
# login ya carga antd por su cuenta. Y no hay baronada de iconos: 20 iconos en
# uso y el chunk no arrastra ninguno extra.
#
# Cuando el bundle baje, este numero baja con el; no lo subas para tapar una
# regresion.
TBT_MAX_MS="${TBT_MAX_MS:-300}"

LH_VERSION="${LH_VERSION:-12.8.2}"
# Runs por métrica, y se usa la mediana.
#
# Un solo run no puede decidir un umbral aqui. Medido sobre la portada, cinco
# runs seguidos dieron TBT de 233, 300, 205, 201 y 223 ms: un rango de 100 ms
# alrededor de un umbral de 200, con la mediana en 223. Con una sola muestra el
# resultado era practicamente una moneda al aire, y el audit fallaba o pasaba
# segun el dia.
#
# La mediana de 3 es el minimo que quita el ruido de una sola muestra extrema sin
# alargar la auditoria demasiado. Sube LH_RUNS si quieres mas estabilidad.
LH_RUNS="${LH_RUNS:-3}"

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
step "Lighthouse sobre $TARGET ($LH_RUNS runs, mediana)"
info "lab, desktop, cache frío. Umbrales: LCP<=${LCP_MAX_MS}ms CLS<=${CLS_MAX} TBT<=${TBT_MAX_MS}ms"

# Cada run escribe en su propio fichero, y al final se lee la mediana de cada
# métrica. El último run es además el que se queda en lighthouse.json, que es lo
# que leen axe y el informe: mejor un resultado real entre N que uno fabricated
# que casara con una mediana.
rm -f "$OUT"/lighthouse-run-*.json
for run in $(seq 1 "$LH_RUNS"); do
  CHROME_PATH="$CHROME_PATH" \
    npx --yes lighthouse@"$LH_VERSION" "$TARGET" \
      --only-categories=performance,accessibility \
      --form-factor=desktop \
      --screenEmulation.disabled \
      --output=json --output-path="$OUT/lighthouse-run-$run.json" \
      --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage" \
      --quiet 2>"$OUT/lighthouse.err" \
    || { warn "lighthouse fallo en el run $run; ver $OUT/lighthouse.err"; cat "$OUT/lighthouse.err" | tail -5; rc=1; }
done

# La mediana se calcula con node y no con sort|awk porque los nombres de las
# claves de Lighthouse son largos y no queremos depender de su orden alfabetico.
MEDIAN=$(node -e '
const fs = require("fs");
const path = require("path");
const dir = process.argv[1];
const files = fs.readdirSync(dir).filter((f) => /^lighthouse-run-\d+\.json$/.test(f));
if (files.length === 0) { process.stdout.write("null"); process.exit(0); }
const pick = (r, path) => path.split(".").reduce((a, k) => a?.[k], r);
const med = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const acc = { lcp: [], cls: [], tbt: [], fcp: [] };
let scores = [];
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  acc.lcp.push(pick(j, "audits.largest-contentful-paint.numericValue") ?? 0);
  acc.cls.push(pick(j, "audits.cumulative-layout-shift.numericValue") ?? 0);
  acc.tbt.push(pick(j, "audits.total-blocking-time.numericValue") ?? 0);
  acc.fcp.push(pick(j, "audits.first-contentful-paint.numericValue") ?? 0);
  scores.push({
    perf: Math.round((pick(j, "categories.performance.score") ?? 0) * 100),
    a11y: Math.round((pick(j, "categories.accessibility.score") ?? 0) * 100),
  });
}
process.stdout.write(JSON.stringify({
  runs: files.length,
  lcp: med(acc.lcp), cls: med(acc.cls), tbt: med(acc.tbt), fcp: med(acc.fcp),
  tbtMin: Math.min(...acc.tbt), tbtMax: Math.max(...acc.tbt),
  perf: med(scores.map((s) => s.perf)), a11y: med(scores.map((s) => s.a11y)),
}));
' "$OUT" 2>/dev/null)

# lighthouse.json se queda con el último run real, no con una mediana inventada.
cp "$OUT/lighthouse-run-$LH_RUNS.json" "$OUT/lighthouse.json" 2>/dev/null \
  || cp "$OUT"/lighthouse-run-*.json "$OUT/lighthouse.json" 2>/dev/null

if [[ -n "$MEDIAN" && "$MEDIAN" != "null" ]]; then
  LCP=$(node -e 'process.stdout.write(String(Math.round(JSON.parse(process.argv[1]).lcp)))' "$MEDIAN")
  CLS=$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).cls.toFixed(3)))' "$MEDIAN")
  TBT=$(node -e 'process.stdout.write(String(Math.round(JSON.parse(process.argv[1]).tbt)))' "$MEDIAN")
  TBT_MIN=$(node -e 'process.stdout.write(String(Math.round(JSON.parse(process.argv[1]).tbtMin)))' "$MEDIAN")
  TBT_MAX=$(node -e 'process.stdout.write(String(Math.round(JSON.parse(process.argv[1]).tbtMax)))' "$MEDIAN")
  PERF=$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).perf))' "$MEDIAN")
  A11Y=$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).a11y))' "$MEDIAN")

  printf '    LCP    %8s ms  (limite %s)\n' "$LCP" "$LCP_MAX_MS"
  printf '    CLS    %8s     (limite %s)\n' "$CLS" "$CLS_MAX"
  printf '    TBT    %8s ms  (limite %s)  <- mediana de %s runs, rango %s-%s ms\n' \
    "$TBT" "$TBT_MAX_MS" "$LH_RUNS" "$TBT_MIN" "$TBT_MAX"
  printf '    perf   %8s / 100   (mediana)\n' "$PERF"
  printf '    a11y   %8s / 100  <- lighthouse solo ve lo que axe tampoco; axe va aparte\n' "$A11Y"

  awk -v v="$LCP"  -v m="$LCP_MAX_MS"  'BEGIN{exit !(v>m)}' && { warn "LCP por encima del umbral"; rc=1; }
  awk -v v="$CLS"  -v m="$CLS_MAX"    'BEGIN{exit !(v>m)}' && { warn "CLS por encima del umbral"; rc=1; }
  awk -v v="$TBT"  -v m="$TBT_MAX_MS" 'BEGIN{exit !(v>m)}' && { warn "TBT por encima del umbral (mediana de $LH_RUNS runs)"; rc=1; }
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
# Para que el tablero de Grafana conserve el ultimo resultado y no solo el
# "ahora". Antes iba al collector, que lo perdiaba a los cinco minutos porque no
# hay nada que lo empuje periodicamente; ahora va a pushgateway, que lo retiene
# hasta la proxima auditoria. Si pushgateway no esta, el script NO falla: la
# auditoria local ya ha servido para decidir, y las metricas son una copia extra.
node .audit/report-metrics.mjs "${PUSHGATEWAY:-http://localhost:9091}" || true

# --------------------------------------------------------------------------
# Saltos HTTP de una sesion autenticada (opcional)
# --------------------------------------------------------------------------
# Solo si hay credenciales en el entorno. Sin ellas el paso se salta entero y
# no falla la auditoria: auditar la portada no necesita una sesion, y obligar a
# tener una cuenta para correr Lighthouse seria una barrera para nada.
#
# Mide las llamadas que hace una persona real, navigating con los enlaces del
# menu. Con page.goto entre fases el numero se duplica porque cada recarga tira
# la cache de React Query; los detalles estan en ARCHITECTURE-FRONTEND.md.
if [[ -n "${AUDIT_EMAIL:-}" && -n "${AUDIT_PASSWORD:-}" ]]; then
  step "Saltos HTTP con sesion autenticada"
  node .audit/session-capture.mjs "$TARGET" || warn "la captura de sesion fallo"
else
  info "sin AUDIT_EMAIL/AUDIT_PASSWORD: se omite la captura de sesion autenticada"
fi

step "resumen"
[[ $rc -eq 0 ]] && ok "todo dentro de umbrales" || warn "hay umbrales rotos o herramientas que fallaron"
info "informes: $OUT/{lighthouse.json,axe.json}"
info "INP no se mide aqui: requiere RUM real, que llega del navegador via el collector, no de este script"
info "Grafana -> 'Web Vitals y accesibilidad' (http://localhost:3001)"
exit $rc
