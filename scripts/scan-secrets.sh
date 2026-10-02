#!/usr/bin/env bash
#
# Gate de secretos con gitleaks.
#
# Vive aqui, en su propio script y no dentro de check.sh a proposito. Un
# escaner de secretos necesita el arbol completo para ser util, y meterlo en la
# puerta que se ejecuta en cada cambio pequeno lo convierte en el paso que todo
# el mundo se salta. Ademas su valor no depende del codigo que escribes:
# depende de lo que ya hay commiteado, asi que pertenece al pipeline de cadena
# de suministro y no al gate de desarrollo.
#
# Como semgrep, este script no se fia de su propio cero. Antes de mirar el
# repositorio escribe una credencial de prueba y exige que la encuentre.
#
# Eso se aprendio por el camino, y merece quedar escrito. El primer intento de
# gitleaks devolvio cero secretos, y la conclusion razonable habria sido que la
# herramienta no detectaba nada. No la detectaba: el contenedor ni siquiera
# arranco, porque un nombre de imagen sin prefijo de registro no se resuelve sin
# terminal, y un parser que recibe salida vacia la lee igual que un "no hay
# hallazgos". Es el mismo falso verde que dio npm audit y semgrep, y la unica
# razon por la que se atrapa aqui es que el control positivo se escribe antes que
# el escaneo real. Si se invirtiera el orden, ese fallo habria pasado por
# "repositorio limpio" y nadie lo habria vuelto a mirar.
#
#   ./scripts/scan-secrets.sh
#   SKIP_SECRETS_CHECK=1 ...   omitir

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "${SKIP_SECRETS_CHECK:-0}" == "1" ]]; then
  echo "    omitido (SKIP_SECRETS_CHECK=1)"
  exit 0
fi

if ! command -v podman >/dev/null 2>&1; then
  echo "    podman no esta instalado: no se puede ejecutar gitleaks" >&2
  exit 1
fi

# Con la v delante: Docker Hub publica estos tags como v8.30.1, y un tag
# inexistente hace que podman salga con 125 antes de ejecutar nada.
IMAGE="docker.io/zricethezav/gitleaks:v8.30.1"

run_gitleaks() {
  podman run --rm \
    --user "$(id -u):$(id -g)" \
    -v "$ROOT:/w:z" \
    -w /w \
    "$IMAGE" \
    detect \
      --no-banner \
      --report-format json \
      --report-path /dev/stdout \
      "$@" 2>/dev/null
}

# El control positivo usa modo NO-git (`--no-git` en la llamada de mas abajo),
# porque su fichero es recien creado y esta sin trackear y en modo git gitleaks
# lo ignoraria. El escaneo del repositorio usa modo git a proposito: lo que
# importa es lo commiteado, no lo que hay tirado por el arbol de trabajo de
# quien lo esta tocando. Con --no-git, un .env local y un log de desarrollo
# salen como hallazgos y un `.env` de desarrollo es exactamente lo que hay en
# cualquier maquina, lo que vuelve la puerta inusable sin insegura.

# Imprime el numero de hallazgos, o la palabra "unreadable" si la salida no es
# JSON. Esa distincion es el motivo de que exista la funcion: gitleaks sin
# hallazgos escribe salida vacia, y una salida vacia no se puede distinguir de
# un escaner que no arranco. Es exactamente el fallo descrito arriba.
count_leaks() {
  node -e '
    let raw = "";
    process.stdin.on("data", (c) => (raw += c)).on("end", () => {
      try {
        console.log(JSON.parse(raw.trim() || "[]").length);
      } catch {
        console.log("unreadable");
      }
    });
  '
}

print_leaks() {
  node -e '
    let raw = "";
    process.stdin.on("data", (c) => (raw += c)).on("end", () => {
      try {
        JSON.parse(raw.trim() || "[]").forEach((f) => {
          const where =
            String(f.File || "?").replace("/w/", "") + ":" + (f.StartLine || 0);
          console.log("      " + (f.RuleID || "?") + "  " + where);
          if (f.Match) console.log("        " + String(f.Match).slice(0, 60));
        });
      } catch {
        /* ya se ha reportado como unreadable */
      }
    });
  '
}

# --- Control positivo -------------------------------------------------------

PROBE_DIR="$ROOT/secrets-probe"
rm -rf "$PROBE_DIR"
mkdir -p "$PROBE_DIR"
trap 'rm -rf "$PROBE_DIR"' EXIT

# No se usa el par de ejemplo de la documentacion de AWS
# (AKIAIOSFODNN7EXAMPLE) a proposito: es una cadena que aparece literalmente en
# la documentacion de Amazon y los escaneres la excluyen para no marcar cada
# README del mundo. Un positivo de control que depende de una excepcionKnown no
# demuestra que el escaner funciona.
cat >"$PROBE_DIR/probe.env" <<'PROBE'
AWS_ACCESS_KEY_ID=AKIAQ7ZR3XPLM2N9VT4K
aws_secret_access_key=kQ7zR2xL9wP4mN6vT8yB1cD3eF5gH7jK
PROBE

# gitleaks sale con 1 cuando encuentra algo, que aqui es lo esperado. Sin
# `|| true` y sin `-e` desactivado, el script cortaria antes de poder decidir si
# ese 1 significa "control correcto" o "no detecto nada".
probe_raw="$(run_gitleaks --no-git --source /w/secrets-probe || true)"
probe_found="$(printf '%s' "$probe_raw" | count_leaks)"

if [[ "$probe_found" == "unreadable" ]]; then
  echo "    gitleaks no devolvio un informe utilizable en el control positivo." >&2
  echo "    Si el escaner no se puede leer, su 0 no significa nada." >&2
  exit 1
fi

if [[ "$probe_found" == "0" ]]; then
  echo "    CONTROL POSITIVO FALLIDO: gitleaks deberia marcar la credencial" >&2
  echo "    de prueba y no marco nada. Sus ceros no significarian que el" >&2
  echo "    repositorio este limpio, sino que el escaner esta parado." >&2
  exit 1
fi

echo "    control positivo ok ($probe_found detecciones sobre 1 esperada)"

# --- Repositorio ------------------------------------------------------------

findings="$(run_gitleaks --source /w --log-opts="--all" || true)"
leaks="$(printf '%s' "$findings" | count_leaks)"

if [[ "$leaks" == "unreadable" ]]; then
  echo "    gitleaks no devolvio un informe utilizable sobre el repositorio" >&2
  exit 1
fi

if (( leaks > 0 )); then
  echo "    ${leaks} secreto(s) en el arbol de trabajo:" >&2
  printf '%s' "$findings" | print_leaks >&2
  exit 1
fi

echo "    0 secretos en el arbol de trabajo"
