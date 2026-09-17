# Build & Deploy

- Always use `--no-cache` when building with podman-compose:
  `podman-compose build --no-cache` (or `podman-compose up -d --build --no-cache`).
- Deploy with `podman-compose up -d --force-recreate`.

# Frontend code changed

podman-compose up -d --build frontend

# Backend code changed

podman-compose up -d --build backend-api backend-worker

# Both changed

podman-compose up -d --build frontend backend-api backend-worker
