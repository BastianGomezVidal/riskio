# Riskio

Storm tracking platform. Ingests National Hurricane Center bulletins, serves them
as a live map with per-storm detail, and keeps an authenticated read-only account
system around it.

Backend is a NestJS monorepo-shaped monolith: seven processes from one image.
Frontend is a Vite + React 19 SPA. Observability is OpenTelemetry throughout, into
Prometheus, Loki and Jaeger, with Grafana on top.

---

## 1. Run it

### Requirements

- Podman with `podman-compose` (Docker Compose works, but every command below is
  written for Podman)
- Node.js 24 for the backend, 22+ for the frontend
- Around 6 GB of free disk

```bash
cp .env.example .env          # then fill in POSTGRES_PASSWORD and JWT_SECRET
podman-compose build --no-cache
podman-compose up -d
```

The app is on <http://localhost>. API health is at `http://localhost/api/health`.

`JWT_SECRET` must be at least 16 characters or the auth service refuses to start.
Grafana refuses to start on the default password unless `GRAFANA_PASSWORD` is set
explicitly.

### The admin account

A single `admin` account is seeded: **`admin@gmail.com`**. Its password is not in
this file, deliberately — a working credential in a public README is a working
credential for anyone who clones the repo. Set it yourself:

```bash
# from the repo root, with the stack running
cd backend && node -e "
  const bcrypt = require('bcryptjs');
  require('fs').writeFileSync('/tmp/pw', bcrypt.hashSync(process.argv[1], 12));
" 'your-password-here'

podman cp /tmp/pw riskio_db_1:/tmp/pw
podman exec riskio_db_1 psql -U riskio -d riskio -c \
  "update users set \"passwordHash\" = pg_read_file('/tmp/pw') where role='admin';"
podman exec riskio_db_1 rm -f /tmp/pw
```

`pg_read_file` rather than inlining the hash into the SQL: bcrypt hashes contain
`$` characters, and letting the shell and psql interpret them has produced a
truncated, 62-character value that fails to verify against any password.

On a fresh database there is no account at all. Register one through the sign-up
form, then promote it:

```bash
# add the address to ADMIN_EMAILS in .env first, then recreate backend-auth
podman-compose up -d --force-recreate --no-deps backend-auth
```

The role is applied at login, not at registration. Accounts created with Google or
Outlook need §6 first.

---

## 2. Commands

| Goal | Command |
|---|---|
| Build without cache | `podman-compose build --no-cache` |
| Rebuild and start | `podman-compose up -d --build --no-cache <services>` |
| Recreate with the image already built | `podman-compose up -d --force-recreate <services>` |
| List services | `podman-compose config --services` |
| Status | `podman ps --format '{{.Names}}  {{.Status}}'` |
| Logs | `podman logs -f riskio_backend-api_1` |
| Backend tests | `cd backend && npm test` |
| Backend typecheck | `cd backend && npx tsc --noEmit -p tsconfig.json` |
| Backend lint | `cd backend && npm run lint` |
| Frontend build (typechecks) | `cd frontend && npm run build` |
| Frontend dev server | `cd frontend && npm run dev` |
| Web performance audit | `./scripts/audit-web.sh` |
| Everything that can fail | `./scripts/check.sh` |

### After changing backend code

All seven backend services share one image tag, `localhost/riskio_backend:latest`.
Each service declares `image:` explicitly in the compose file, because otherwise
Compose derives one tag per service name and `build backend-api` leaves
`backend-auth` running yesterday's code.

So a backend change means rebuilding once and recreating all seven:

```bash
podman-compose build --no-cache backend-api
podman-compose up -d --force-recreate --no-deps \
  backend-api backend-auth backend-weather backend-dashboard \
  backend-feeds backend-storage backend-cache
```

`--force-recreate` with a single service name is unreliable here: asked for
`backend-auth`, it has been observed recreating `backend-api` and `frontend` and
skipping the one you named. Verify rather than trust the output:

```bash
for s in api auth weather dashboard feeds storage cache; do
  podman inspect -f "{{.ImageName}} {{.State.Health.Status}}" "riskio_backend-$s"_1
done
```

All seven must report the same image name and `healthy`.

After changing frontend code, only the frontend needs recreating:

```bash
podman-compose up -d --build --no-cache frontend
podman-compose up -d --force-recreate --no-deps frontend
```

---

## 3. Services and ports

There is no `backend-worker`. The ingestion pipeline lives in `backend-feeds` and is
triggered by `POST /admin/ingest/run`. Asking for `backend-worker` prints a warning
and starts nothing.

Containers carry a `_1` suffix: `riskio_backend-api_1`, not `riskio_backend-api`.

### Application

| Service | Port | Interface | Notes |
|---|---|---|---|
| `frontend` | `80` | all | the only entry point to the app |
| `backend-api` | `3000` | all | gateway, see §4 |
| `storage` (SeaweedFS) | `8333` | all | see the warning below |
| `db` | `5432` | loopback | PostGIS |
| `redis` | `6379` | loopback | cache driver |
| `backend-auth` | `3008` | loopback | |
| `backend-weather` | `3007` | loopback | |
| `backend-feeds` | `3006` | loopback | |
| `backend-dashboard` | `3009` | loopback | |
| `backend-storage` | `3004` | loopback | |
| `backend-cache` | `3005` | loopback | |

The seven backend ports are published for local debugging only. Nothing should talk
to them directly; they are an implementation detail of the gateway.

**`storage` is published on all interfaces on purpose, and it is a real
exposure.** The browser downloads avatars straight from SeaweedFS with no
credentials, so the bucket is open to anyone who knows the URL. Put a domain with
access control in front of it before this is reachable by anything you care about.

### Observability

| Service | URL | Credentials |
|---|---|---|
| Grafana | <http://localhost:3001/login> | `GRAFANA_USER` / `GRAFANA_PASSWORD`, default `admin` / `admin` |
| Prometheus | <http://localhost:9090> | none |
| Pushgateway | <http://localhost:9091> | none |
| Jaeger | <http://localhost:16686> | none |
| Loki | not published | see below |
| OTel collector | `127.0.0.1:4318` (OTLP) | none |

Every one of these is bound to `127.0.0.1`.

**Loki has no published port** and lives only on the internal `core` network, so
there is nothing to open from the host. Read it through Grafana's *Riskio · Logs*
dashboard, or from a container that is on `core`:

```bash
NOW=$(date +%s); START=$((NOW-3600))
podman exec riskio_backend-api_1 node -e "
const u='http://loki:3100/loki/api/v1/query_range?query='
  + encodeURIComponent('{service_name=~\".+\"}')
  + '&start=${START}000000000&end=${NOW}000000000&limit=3';
fetch(u).then(r=>r.json()).then(j=>{
  for (const s of j.data?.result ?? []) console.log(s.stream.service_name, s.values.length);
});"
```

`/ready` on Loki returns 503 even while queries work, so a 503 there does not mean
it is down. Check a query instead.

Jaeger's query API is not on the paths v1 used (`/api/services`,
`/api/v2/services` all 404). Jaeger 2 serves the UI on 16686 and the UI talks
gRPC internally; the trace list in the UI is the working check.

### Grafana dashboards

Provisioned from `deploy/grafana/provisioning/dashboards/`, so they come back after
a volume reset:

| UID | Title |
|---|---|
| `riskio-api` | Riskio · API |
| `riskio-infra` | Riskio · Infraestructura |
| `riskio-logs` | Riskio · Logs |
| `riskio-web-vitals` | Web Vitals y accesibilidad |

Datasources are provisioned too: Prometheus, Loki and Jaeger, all pointing at the
internal service names.

---

## 4. How a request flows

```
browser
  │
  ├─ http://localhost/                 → nginx serves the SPA
  │
  └─ http://localhost/api/*            → nginx proxies to backend-api
                                          │
                                          ├─ /api/auth/*  /api/users/*  → auth service   (middleware proxy)
                                          ├─ /api/storms/*               → weather service (controller proxy)
                                          └─ /api/dashboard/*            → dashboard service
```

nginx serves the API under `/api/` and its `proxy_pass` **strips that prefix** before
the gateway sees it. The gateway serves its routes at the root, with no global
prefix. So the browser calls `/api/auth/login` and the gateway receives
`/auth/login`. Without the trailing slash on `proxy_pass` the backend would receive
`/api/auth/login` and 404.

Proxied requests to `/auth/*` and `/users/*` go through a Nest **middleware**, not a
controller, because a proxy has to match a path prefix with anything after it and
Express mounts that in a line. Everything else uses proxy controllers. The two are
not interchangeable.

`/auth/*` and `/users/*` also resolve the caller's identity *before* forwarding, and
pass the result on as a header. The auth service re-checks it against its own state
rather than trusting the proxy's word, so the decision is never taken on a proxy's
say-so.

### The seven backend processes

| Service | Command | Owns |
|---|---|---|
| `backend-api` | none, uses the image default | gateway, own controllers, migrations |
| `backend-auth` | `start:auth` | `JWT_SECRET`, the `users` table, bcrypt, sessions |
| `backend-weather` | `start:weather` | storms and advisories read model |
| `backend-feeds` | `start:feeds` | NHC ingestion, the writers |
| `backend-dashboard` | `start:dashboard` | dashboard aggregation |
| `backend-storage` | `start:storage` | S3-compatible object access |
| `backend-cache` | `start:cache` | Redis cache driver |

Only `backend-auth` holds `JWT_SECRET`. The API holds none of it, the OAuth
credentials or the mailer password; the compose file separates those env blocks
deliberately so it is visible at a glance that the gateway cannot read a user's
password hash.

---

## 5. Layout

```
backend/              the NestJS API. Seven services, one image, entrypoints in src/*-service/main.ts
frontend/             the React SPA
deploy/               compose overlays and the observability configs (grafana, loki, prometheus, jaeger, otel)
scripts/              everything executable
  check.sh            the gate. The same script CI runs; see section 8
  dev.sh              the fast edit loop
  audit-web.sh        Lighthouse and axe-core, thresholds that fail
  ensure-test-database.sh   starts Postgres for the contract and integration suites
  security/           the scanners the workflows call
  audit/              the axe-core, Lighthouse and RUM scripts audit-web.sh drives

docker-compose.yml    the whole stack
.husky/               git hooks. Stays at the root because husky looks for it there
```

Three things cannot move, because the tools that read them resolve from the root:
`.husky/`, `.prettierrc.json` and `package.json`. Everything else that is a script
lives under `scripts/`.

```
backend/src/
  <name>-service/main.ts     seven entrypoints, one per process
  domain/                    auth, users, weather, feeds, dashboard, storage, cache
  common/                    authz ports, shared DTOs, contracts, interceptors
  config/env.validation.ts   Joi schema for every environment variable
  database/migrations/       TypeORM migrations
  instrumentation.ts         OpenTelemetry bootstrap, loaded via --import

frontend/src/
  app/router/                route table, one lazy() per route, guards
  pages/                     public/ and protected/ route components
  layout/public/             the signed-out shell
  global_components/         header, footer, layout, error boundaries
  features/                  weather, settings — feature-scoped components
  domain/                    types and pure logic, no React
  api/                       fetch client and Zod schemas
  design-system/             tokens, antd theme, public-page controls
  auth/                      session context
  observability/             web telemetry
```

The rule the frontend follows: `domain/` holds types and pure functions and imports
nothing from React; `features/` and `pages/` hold components. A change to a type
should not require touching a component.

---

## 6. OAuth (Google / Outlook)

Implemented, and it works, but it needs credentials that only you can create.

The flow is authorization-code, against Google's and Microsoft's standard
endpoints, with no provider SDK. The `state` token is kept in a short-lived in-memory
map to bind each callback to a request it issued.

Without credentials the start endpoint answers **503 `<provider> login is not
configured`**, and the sign-in page still shows both buttons. That 503 is the whole
symptom; there is no 501 anywhere in the backend.

### Three URLs, and they are not interchangeable

| Variable | What it is |
|---|---|
| `PUBLIC_BASE_URL` | public origin of the API |
| `API_PUBLIC_BASE_URL` | **the `redirect_uri`**, with the `/api` prefix included |
| `FRONTEND_URL` | where the browser lands when the flow finishes |

The `/api` prefix is not optional. nginx serves the API under `/api/` and strips the
prefix for the gateway, so the publicly reachable callback is
`/api/auth/oauth/<provider>/callback` while the gateway sees
`/auth/oauth/<provider>/callback`. Building the `redirect_uri` from the bare origin
produces a URL that is neither browser-reachable nor prefixed, and Google and
Microsoft reject it with `redirect_uri_mismatch` — after the user has already signed
in and consented, which is the worst moment to fail.

`API_PUBLIC_BASE_URL` left empty falls back to `PUBLIC_BASE_URL` + `/api`.

### To enable it

1. Create an OAuth client in the provider's console.
2. Register the authorized redirect URI as exactly `API_PUBLIC_BASE_URL` +
   `/auth/oauth/google/callback` (or `/outlook/callback`), character for character,
   including scheme, port and path.
3. Put the client id and secret in `.env` and recreate `backend-auth`:

```bash
podman-compose up -d --force-recreate --no-deps backend-auth
```

The value in the outgoing request is the one to compare against the console; if they
differ the provider will tell you so on the consent screen, not in your logs.

---

## 7. Configuration

`.env.example` documents all 68 variables. The ones that matter most:

| Variable | Notes |
|---|---|
| `POSTGRES_PASSWORD`, `DATABASE_URL` | password must match in both |
| `JWT_SECRET` | ≥16 chars, auth service will not start otherwise |
| `ADMIN_EMAILS` | comma separated; these get `admin` at login |
| `GRAFANA_PASSWORD` | Grafana will not start on the default |
| `MAIL_TRANSPORT` | `log` writes reset links to the log instead of sending them |
| `API_PUBLIC_BASE_URL` | §6 |
| `STORAGE_PUBLIC_URL` | browser-facing avatar URL, not the internal endpoint |

`MAIL_TRANSPORT=log` is convenient and unsafe anywhere real: a password reset link in
a log is a working credential. The API says so at boot while it is active.

---

## 8. Testing and quality

One command runs everything that can fail:

```bash
./scripts/check.sh          # typecheck, lint, tests, coverage, dead code, build
./scripts/check.sh --fast   # same, minus coverage
```

It exits non-zero if any step failed. The GitHub Actions workflow calls this exact
script, so a green local run is a green run on the remote — there is no second list
of commands to drift.

| Check | Command | What it catches |
|---|---|---|
| Backend typecheck | `cd backend && npm run typecheck` | type errors, including in specs |
| Backend lint | `cd backend && npm run lint` | `oxlint`: unused imports, dead locals |
| Backend tests | `cd backend && npm test` | behaviour |
| Backend coverage | `cd backend && npm run coverage` | below-threshold coverage, fails the run |
| Frontend typecheck | `cd frontend && npm run typecheck` | type errors |
| Frontend dead code | `cd frontend && npm run knip` | unused files, unused and undeclared deps |
| Frontend build | `cd frontend && npm run build` | production build succeeds |

### Coverage

```
Statements   71.94%  ( 818/1137 )
Branches     68.39%  ( 474/693  )
Functions    72.95%  ( 143/196  )
Lines        72.39%  ( 771/1065 )
```

Thresholds live in `backend/vitest.config.ts` and **`npm run coverage` fails below
them**: 70% lines, 70% functions, 70% statements, 65% branches. So coverage is a
gate, not a decoration. The HTML report is at `backend/coverage/index.html`.

The thresholds sit just under the measured numbers on purpose. A threshold set
exactly at today's figure turns red the first time anyone adds an uncovered line,
and gets disabled the same week. Raise them deliberately as coverage improves.

`coverage-metrics/summary.json` in the repo root is the machine-readable snapshot,
and the CI workflow rewrites and commits it on every push to `main`, so the numbers
in this README are never more than one push behind reality. The workflow also
comments the table onto the commit and uploads the HTML report as an artifact.

Files are counted only when a test imports them, so adding an untested file does not
silently move the number. The `exclude` list holds entrypoints, modules, DTOs,
entities, migrations and DI tokens — files with no unit-testable behaviour.

The frontend has no unit test suite. Its gate is typecheck, `knip` and a successful
build, plus `scripts/audit-web.sh` for what users actually experience.

### Where the gaps are

`users.service.ts` (~30%) and `storms.service.ts` are the two lowest-covered
service files. `computeFindMany` in particular assembles a filter list where a
mistake is invisible to a type checker, so it is the first place to write tests
next.

---

## 9. Volumes

| Volume | Keeps |
|---|---|
| `pgdata` | the database |
| `storage_data` | avatars in SeaweedFS |
| `redis_data` | Redis |
| `loki_data` | logs |
| `grafana_data` | Grafana state |
| `prometheus_data` | metric series, 15d retention |
| `pushgateway_data` | the **last** audit result only, not a history |
| `jaeger_data` | traces in Badger |

All survive `--force-recreate`. For audit history, `scripts/audit-web.sh` keeps the reports.

---

## 10. House rules

**Comments explain why, not what.** A comment that restates the code is noise; one
that records a constraint someone will otherwise re-break is the point. Most of them
in this repo exist because the obvious version of that code is wrong in a way that
is not visible from reading it.

**Measure before claiming.** Numbers in this file were measured. When one stops
being true, replace it rather than deleting it.

**Secrets never enter git.** `.env` is ignored. `.env.example` carries no real
values.

**A number nobody reproduces is a rumour.** Coverage figures, bundle sizes and
latency claims in this file were measured, and `scripts/check.sh` is how you re-measure
them. If one goes stale, replace it.
