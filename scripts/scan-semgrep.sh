#!/usr/bin/env bash
#
# Gate de analisis estatico con semgrep.
#
# Existe por una reason concreta, no por gusto de tener mas herramientas. Al
# anadir el primer eje de seguridad a este repositorio aparecio un patron que
# conviene no repetir: cuatro de las seis herramientas de la fase de seguridad
# estaban marcadas como "ya funcionando" y ninguna daba un numero. Dos no
# existian. Una fallaba en silencio contra un mirror. Y una cuarta, npm audit,
#aba cero sin haberse ejecutado nunca.
#
# Un escaner que devuelve cero ha dicho exactamente lo mismo que un escaner
# roto: cero. La unica forma de que "cero" signifique algo es demostrar antes
# que el escaner detecta lo que deberia detectar. Por eso este script no se
# limita a pasarle el codigo: primero le pasa un fichero deliberadamente
# vulnerable y exige que lo marque. Si el control no dispara, el gate falla,
# aunque el codigo real este impecable. Es lo unico que distingue un eje de
# seguridad de una linea que dice "OK".
#
# El ruleset que se usa es local y esta versionado en el repo. Los rulesets
# remotos de semgrep (p/ci, p/security-audit) no se usan como puerta: sin
# `semgrep login` el registro solo sirve unas 18 reglas, y p/ci ejecuta
# exactamente 18 sobre 166 ficheros. Cuantas reglas decide servir un servidor
# ajeno no es una propiedad de este repositorio, asi que un gate que dependa
# de ello cambia de veredicto sin que cambie una linea de codigo.
#
#   ./scripts/scan-semgrep.sh          analyze
#   SKIP_SEMGREP_CHECK=1 ./check.sh    omitir (sin semgrep, sin podman)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "${SKIP_SEMGREP_CHECK:-1}" == "1" ]]; then
  echo "    omitido (SKIP_SEMGREP_CHECK=1)"
  exit 0
fi

if ! command -v podman >/dev/null 2>&1; then
  echo "    podman no esta instalado: no se puede ejecutar semgrep" >&2
  exit 1
fi

IMAGE="docker.io/semgrep/semgrep:1.178.0"
RULES="backend/semgrep/rules.yml"
TARGET="backend/src"

# El contenedor corre como el usuario del host, no como root: sin esto deja
# ficheros propiedad de root en el arbol de trabajo. `:z` relabela el volumen,
# que es necesario porque SELinux esta en modo Enforcing y sin el el montaje
# falla con Permission denied en silencio aparente.
run_semgrep() {
  podman run --rm \
    --user "$(id -u):$(id -g)" \
    -v "$ROOT:/w:z" \
    -w /w \
    "$IMAGE" \
    semgrep scan \
      --config "$RULES" \
      --exclude node_modules \
      --exclude '*.spec.ts' \
      --metrics=off \
      --quiet \
      --json "$@" 2>/dev/null || true
}

count_findings() {
  node -e '
    let raw = "";
    process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
      const text = raw.trim();
      if (!text.startsWith("{")) {
        console.log("PARSE_ERROR");
        return;
      }
      try {
        const report = JSON.parse(text);
        if ((report.errors || []).length > 0) {
          console.log("ERRORS:" + report.errors.length);
          return;
        }
        console.log(report.results.length);
      } catch {
        console.log("PARSE_ERROR");
      }
    });
  '
}

# --- Control positivo -------------------------------------------------------
#
# Se escribe fuera de TARGET a proposito. Si el fichero se metiera en src/ y el
# escaneo fallara antes de borrarlo, el resto del gate veria codigo de prueba.
# Aqui se escanea solo, en un directorio propio.

PROBE_DIR="$ROOT/semgrep-probe"
rm -rf "$PROBE_DIR"
mkdir -p "$PROBE_DIR"
trap 'rm -rf "$PROBE_DIR"' EXIT

cat >"$PROBE_DIR/probe.ts" <<'PROBE'
import { createHash } from 'crypto';
import { exec } from 'child_process';

export function weakAndShelly(input: string): string {
  exec('some-tool ' + input);
  return createHash('md5').update(input).digest('hex');
}

export function evaluated(input: string): unknown {
  return eval(input);
}
PROBE

expected_detections=3
probe_raw="$(run_semgrep "/w/semgrep-probe/probe.ts")"
probe_result="$(printf '%s' "$probe_raw" | count_findings)"

case "$probe_result" in
  PARSE_ERROR)
    echo "    control positivo ilegible: semgrep no devolvio JSON" >&2
    printf '%s' "$probe_raw" | head -c 1500 >&2
    exit 1
    ;;
  ERRORS:*)
    echo "    el ruleset local no se pudo aplicar. semgrep dice:" >&2
    printf '%s' "$probe_raw" | node -e '
      let raw = "";
      process.stdin.on("data", (c) => (raw += c)).on("end", () => {
        try {
          JSON.parse(raw).errors.forEach((e) =>
            console.error("      " + (e.long_msg || e.short_msg || e.message)),
          );
        } catch {
          console.error(raw.slice(0, 1500));
        }
      });
    '
    exit 1
    ;;
esac

if (( probe_result < expected_detections )); then
  echo "    CONTROL POSITIVO FALLIDO: semgrep deberia marcar" >&2
  echo "    $expected_detections patrones en el fichero de prueba y solo marcó $probe_result." >&2
  echo "    Eso significa que las reglas ya no detectan lo que dicen detectar," >&2
  echo "    asi que el 0 del codigo real no significa que el codigo este limpio." >&2
  exit 1
fi

echo "    control positivo ok ($probe_result detecciones sobre $expected_detections esperadas)"

# --- Codigo real ------------------------------------------------------------

real_raw="$(run_semgrep "$TARGET")"
findings="$(printf '%s' "$real_raw" | count_findings)"

if [[ "$findings" == "PARSE_ERROR" || "$findings" == ERRORS:* ]]; then
  echo "    semgrep no produjo un informe utilizable ($findings)" >&2
  echo "    un escaner que no se puede leer no puede aprobar ni suspender nada" >&2
  printf '%s' "$real_raw" | head -c 1500 >&2
  exit 1
fi

if (( findings == 0 )); then
  echo "    0 hallazgos en ${TARGET}"
  exit 0
fi

echo "    ${findings} hallazgo(s) en ${TARGET}:" >&2
printf '%s' "$real_raw" | node -e '
  let raw = "";
  process.stdin.on("data", (c) => (raw += c)).on("end", () => {
    JSON.parse(raw).results.forEach((r) => {
      const short = r.check_id.split(".").pop();
      const where = r.path.replace("/w/", "") + ":" + r.start.line;
      console.error("      " + short + "  " + where);
      const note = (r.extra && r.extra.message ? r.extra.message : "")
        .split("\n")[0]
        .trim();
      if (note) console.error("        " + note);
    });
  });
' >&2
exit 1
