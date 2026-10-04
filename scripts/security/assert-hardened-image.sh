#!/usr/bin/env bash
#
# Asserts the production image is actually hardened, by building it and looking
# inside, rather than by reading the Dockerfile and hoping.
#
# The Dockerfile went multi-stage so the builder's devDependency tree, the 26
# .spec.ts files and test/pact would not ship. That is the kind of thing that
# regresses silently: someone adds `COPY . .` back to make a debugging change
# work, the image gets 200 MB heavier, and nothing fails because the build
# still succeeds. So this builds the image and looks.
#
# Cheap enough to run in the gate: the second npm ci is a cache hit, so this is
# a build of two thin layers over the builder rather than a full compile.
#
#   ./scripts/security/assert-hardened-image.sh            uses localhost/riskio_backend:latest
#   IMAGE=mi-imagen:tag ./scripts/security/assert-hardened-image.sh
#
# To skip it when iterating on the Dockerfile, SKIP_IMAGE_CHECK=1.

set -euo pipefail

cd "$(dirname "$0")/../.."

IMAGE="${IMAGE:-localhost/riskio_backend:latest}"

if [ "${SKIP_IMAGE_CHECK:-0}" = "1" ]; then
  echo "  SKIPPED image hardening — SKIP_IMAGE_CHECK=1"
  exit 0
fi

if ! command -v podman >/dev/null 2>&1; then
  echo "  podman no disponible; no se puede comprobar la imagen" >&2
  exit 1
fi

echo "  construyendo $IMAGE para inspeccionarla..."
podman build -q -t "$IMAGE" backend >/dev/null

cid="$(podman create "$IMAGE")"
trap 'podman rm -f "$cid" >/dev/null 2>&1 || true' EXIT

listing="$(podman export "$cid" | tar -t)"

fail=0

# The 26 .spec.ts files and test/pact are the actual exposure: a public
# repository that names a public image should not be describing its own test
# fixtures, and the OAuth secret, the admin password and JWT_SECRET are on that
# host. Zero is the only acceptable number.
check_zero() {
  local label="$1" pattern="$2" found
  found="$(printf '%s\n' "$listing" | grep -c -- "$pattern" || true)"
  if [ "$found" = "0" ]; then
    printf '    ok    %s (0)\n' "$label"
  else
    printf '    FAILED %s (%s, debe ser 0)\n' "$label" "$found"
    printf '%s\n' "$listing" | grep -- "$pattern" | head -5 | sed 's/^/            /'
    fail=1
  fi
}

check_zero ".spec.ts en la imagen"        '\.spec\.ts$'
check_zero "directorio test/"             '^usr/src/app/test/'
check_zero "directorio scripts/"          '^usr/src/app/scripts/'
check_zero "sources .ts propias"           '^usr/src/app/src/'

# A non-declared user means the image still runs as root. Worth asserting
# separately from the file listing because it is a different kind of exposure.
user="$(podman inspect -f '{{.Config.User}}' "$IMAGE")"
if [ -n "$user" ] && [ "$user" != "0" ] && [ "$user" != "root" ]; then
  printf '    ok    usuario no root (%s)\n' "$user"
else
  printf '    FAILED la imagen corre como root (User=%s)\n' "${user:-vacio}"
  fail=1
fi

# A size ceiling, so a regression shows up as a number before it shows up as a
# bill. 424 MB is the measured hardened build; the old single-stage one was
# 651 MB. 500 MB leaves room for a legitimate dependency addition while still
# failing on a full devDependency tree.
size_mb="$(podman image inspect -f '{{.Size}}' "$IMAGE" | awk '{printf "%d", $1/1048576}')"
if [ "$size_mb" -le 500 ]; then
  printf '    ok    tamano %s MB (techo 500)\n' "$size_mb"
else
  printf '    FAILED tamano %s MB, sobre el techo de 500\n' "$size_mb"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo
  echo "  la imagen de produccion ya no esta endurecida" >&2
  exit 1
fi

echo "  imagen endurecida verificada"
