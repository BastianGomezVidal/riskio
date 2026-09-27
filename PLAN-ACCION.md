# Plan de acción - Riskio

Plan a ejecutar **paso a paso junto**. Cada paso explica el porqué para aprender.

Reglas del plan:
- Sin tests nuevos como entregable (el usuario ya tiene suite backend en verde; no se agregan tests).
- Se **sí** permite una **auditoría de accesibilidad (a11y) y Web Vitals** como actividad.
- Nada se commitea sin revisar el diff del paso.

---

## Fase 0 — Consolidar el trabajo actual (sin testear)

### Paso 0.1 — Inventario y clasificación de los 115 archivos sin commitear

Clasificar los cambios por dominio para hacer commits coherentes (no un commit gigante).

> Nota: los grupos de la tabla son **candidatos**. Antes de commitear hay que confirmar
> si un mismo archivo toca dos dominios (p. ej. `app.module.ts` que registra y quita módulos).

| Grupo | Ámbito | Archivos (real) |
|---|---|---|
| **A** | Backend: `weather/storms` + `advisories` + dashboard | `domain/weather/storms/*` (7, incl. `dto/storm.dto.ts`, `utils/*`), `domain/weather/advisories/*` (3), `domain/dashboard/*` (3) |
| **B** | Backend: `history` → `storm-history` (renombre) | `domain/history/*` (6, borrados), `domain/storm-history/*` (5, nuevos) |
| **C** | Backend: auth + users | `domain/auth/*` (7), `domain/users/*` (5) |
| **D** | Backend: storage S3 (nuevo) | `domain/storage/*` (5) |
| **E** | Backend: messaging/cache/health (nuevos) | `domain/messaging/*` (7), `domain/cache/*` (2), `health/*` (2) |
| **F** | Backend: ingestion | `domain/feeds/ingestion/*` (2) |
| **G** | Backend: infra de build | `app.module.ts`, `test/helpers/test-app.ts`, `tsconfig.json`, `package.json`, `package-lock.json` |
| **H** | Backend: migración | `database/migrations/1892000000000-AddUserAvatarUrl.ts` |
| **I** | Frontend: auth feature | `features/auth/*` (13), `auth/*` (2) |
| **J** | Frontend: weather features (dashboard/history/advisories/pages) | `features/weather/*` (18) |
| **K** | Frontend: storms layout | `layout/protected/storms/*` (7) |
| **L** | Frontend: resto de layout (advisory/dashboard/settings/public) | `layout/protected/*` (17), `layout/public/*` (10) |
| **M** | Frontend: `global_components`, `pages`, `hooks` | `global_components/*` (12), `pages/*` (9), `hooks/*` (2) |
| **N** | Frontend: capa de datos y dominio | `api/client.ts`, `data/promises.ts`, `domain/*` (20), `helpers/*` (8), `app/router/routes.tsx` |
| **O** | Infra | `docker-compose.yml` |
| **P** | Docs (este plan + análisis) | `ARCHITECTURE-COMPOSE.md`, `ARCHITECTURE-FRONTEND.md`, `PLAN-ACCION.md` |

**⚠️ Hallazgo relevante durante el inventario (no bloquea el commit):**
hay **código duplicado en dos capas** que conviene documentar ahora y resolver después:

- Backend: conviven `domain/history/`, `domain/storm-history/` y `domain/weather/storms/`.
  El log de arranque muestra que `StormHistoryController` sigue montado en `/storm-history`.
- Frontend: `helpers/*` duplica `domain/*` (`geo/`, `storms/basins`, `storms/metrics`, `datetime`);
  `global_components/StormCard` y `global_components/StormList` duplican los de
  `features/weather/components/dashboard/`; `PageFallBack/` y `PageFAllBack/` (typo) coexisten;
  `pages/protected/*` duplica `features/weather/pages/*`.

Esto **no se resuelve antes de commitear** (sería mezclar un commit con un refactor grande).
Se registra como Fase 4 del plan.


### Paso 0.2 — Verificación previa (rápida, sin escribir tests)

Antes de commitear, confirmar que el árbol está en estado comiteable:
- Backend: `npm run build` y `npm run lint` en verde, y `npm test` en verde (ya se solo verifica, no se escriben tests nuevos).
- Frontend: lint + build en verde.
- Sin secretos en `.env` (confirmar que `.env` está en `.gitignore`).

**Explicación**: commitear código que no compila rompe el bisect y el CI. La verificación es una lectura del estado, no trabajo nuevo.

### Paso 0.3 — Commits por grupo (A→K)

Un commit por grupo, con mensaje estilo Conventional Commits (el repo ya usa `feat(web):`, `fix(api):`, `refactor(api):`).

Reglas:
- Cada commit debe compilar por sí solo cuando sea posible (evitar commits "intermedios" rotos si el cambio es atómico).
- No incluir `.env` ni secretos.
- Los archivos de docs van en un commit final.

**Explicación**: los commits son la unidad de historia. Grouping por dominio hace que `git log` cuente la historia del software, y `git bisect` encuentra regresiones rápido.

### Paso 0.4 — Push (opcional)

Solo si el usuario lo pide explícitamente. Rama y remoto se confirman antes.

### Paso 0.5 — ✅ Ejecutado (2026-09-26)

**Resultado: 20 commits, working tree limpio** (solo queda `contexto.txt` sin trackear,
que son notas de trabajo y no código).

| # | Commit | Alcance |
|---|---|---|
| 1 | `81c015d chore(api)` | deps AWS SDK, cache, messaging, multer types |
| 2 | `7384787 feat(migrations)` | columna `avatarUrl` |
| 3 | `065f3cc feat(api)` | `S3StorageService` + bootstrap de bucket |
| 4 | `13a2e9f feat(api)` | `CacheService` (memory/Redis) |
| 5 | `e10a983 feat(api)` | brokers memory/SQS/Kafka + orphan cleanup |
| 6 | `e56e0fa refactor(api)` | `history/` → `storm-history/` |
| 7 | `4875dd9 feat(api)` | `JwtAuthGuard` global + `@Public()` |
| 8 | `87d5c9e chore(api)` | `/health` público |
| 9 | `7244d00 feat(api)` | `UsersModule` (perfil, avatar) |
| 10 | `ab31a18 refactor(api)` | DTOs: `StormDto` aggregate + advisory por número |
| 11 | `4e425ae feat(api)` | totales por cuenca en dashboard |
| 12 | `bd9f8a4 feat(api)` | invalidación de cache tras ingest |
| 13 | `9aa2716 chore(api)` | wiring en `AppModule` + test harness |
| 14 | `e2a5722 refactor(web)` | auth → `pages/public/` + `layout/public/` |
| 15 | `d51947b refactor(web)` | weather → `pages/protected/` + `layout/protected/` |
| 16 | `cdd3ecc refactor(web)` | `domain/` (tipos) vs `helpers/` (runtime) + users domain |
| 17 | `9186d63 feat(web)` | inactividad, `useMediaQuery`, `useScrollToTop` |
| 18 | `a41e748 refactor(web)` | `global_components/` + fix typo `PageFAllBack` |
| 19 | `6a4cda4 feat(web)` | layout de settings |
| 20 | `697abb4 feat(web)` | layout del directorio de tormentas |
| 21 | `49f5f6d feat(web)` | endpoints en `api/client.ts` |
| 22 | `7ad571a feat(web)` | preloaders storms/storm/profile |
| 23 | `9116fb2 refactor(web)` | rutas `/storms` en vez de `/history` |
| 24 | `c03047c chore(infra)` | SeaweedFS + Redis |
| 25 | `a41465e docs(infra)` | diagramas + plan |

Git detectó **20 renombres**, así que el historial muestra los movimientos como
`viejo => nuevo` y no como borrado+creado.

**Estado de verificación tras la Fase 0:**
- Backend `build`: 0 ✅
- Backend `lint`: 0 ✅
- Frontend `build`: 0 ✅
- Backend `test`: ❌ **3 failed | 171 passed | 1 skipped (175)** → ver Deuda D1

---

## Deuda técnica registrada

> Todo lo que se decidió **no** arreglar en esta fase, para no mezclar un commit
> con un refactor grande. Cada punto tiene su paso en la fase correspondiente.
>
> D1–D5 se recogieron al agrupar el trabajo previo. **D6–D9 aparecieron al ejecutar las
> Fases 1 y 2** y aún no tienen paso asignado: son de las que se encontraron buscando, no
> previstas en el plan.

### D1 — Specs de backend con tests comentados (⏸ aplazado por decisión)

> **Decisión del usuario (2026-09-26): aplazar.** No es deuda que se vaya a resolver sola ni
> un olvido: queda registrada como aplazada a propósito. Sigue siendo la puerta que bloquea
> cualquier cambio de backend que toque código cubierto por estos specs. Mientras tanto,
> `npm test` no se ejecuta como criterio de aceptación — la verificación es `npm run build` +
> navegador.

**Estado actual:** `npm test` → **3 failed | 171 passed | 1 skipped (175)**.
Antes de la Fase 0 la suite estaba en **209/209**.

**Causa:** al agrupar los cambios se preservó tal cual un bloque de tests que ya estaba
comentado en el working tree. No lo introdujo el agrupado.

| Archivo | Problema | Efecto |
|---|---|---|
| `backend/src/domain/weather/storms/storms.service.spec.ts:78` | `/*service = new StormsService(repository);` abre un bloque que comenta **hasta el final del archivo** | Vitest: "No test found in suite". De 6 tests a **0** ejecutados |
| `backend/src/domain/dashboard/dashboard.service.spec.ts` | 8 bloques comentados, entre ellos `//service = new DashboardService(...)` y `it.skip` en el primer test | El `service` nunca se instancia → aserciones fallan |
| `backend/src/domain/dashboard/dashboard.service.spec.ts:168` | Un `it()` quedó **anidado dentro de otro `it()`** (por el `/*` mal cerrado) | Error: "Calling the test function inside another test function is not allowed" |

**Impacto:** `findOne` de storms y `getSummary` de dashboard **no tienen cobertura
ejecutable**. El refactor de DTOs (`ab31a18`) no está protegido por tests.

**Alcance del arreglo:** ~34 tests por reactivar (209 − 175). Requiere:
1. Cerrar bien el `/*` de `storms.service.spec.ts` y descomentar el `beforeEach`.
2. Reinstaurar `new DashboardService(...)` y quitar el `it.skip`; añadir `pacific`/`atlantic`
   a la aserción de `totals` (el servicio ya las devuelve desde `4e425ae`).
3. Reubicar el `it()` anidado de la línea 168 al nivel de `describe`.

**Explicación:** un test comentado no es cobertura: es la *impresión* de cobertura. Deja el
`describe` en verde mientras la función puede romperse sin que nadie lo note. Un `it.skip`
es legítimo como deuda declarada; un bloque `/* */` que se traga el archivo entero es un
accidente, y por eso el síntoma es "No test found in suite" en vez de un fallo claro.

→ Ver **Paso 4.4**

### D2 — Código duplicado en backend

`domain/history/`, `domain/storm-history/` y `domain/weather/storms/` conviven;
`StormHistoryController` sigue montado en `/storm-history`. → **Paso 4.1**

### D3 — Código duplicado en frontend

`helpers/` vs `domain/`; `global_components/StormCard|StormList` vs
`features/weather/components/dashboard/`; `pages/protected/*` vs `features/weather/pages/*`.
→ **Paso 4.2**

### D4 — Otras observaciones

- ~~`contexto.txt` sin trackear en la raíz.~~ **Resuelto**: añadido a `.gitignore` por
  decisión del usuario (2026-09-26). Son notas personales, no código.
- `npm run lint` del frontend es un alias de `npm run build` (`"lint": "vite build"`):
  no hay linter real. El build sí ejecuta `tsc -b`, así que hay type-checking.
- ~~Bundle inicial del frontend: **1.063 kB** (gzip 337 kB) con un chunk que dispara el
  aviso de Vite (>500 kB).~~ → **Resuelto en el Paso 2.6**: el chunk de entrada pasó de
  1.200 kB a **25 kB**, y el shell (react + antd + zod/TanStack) quedó en ~318 kB gzip
  repartido en chunks de vendor que sobreviven a un deploy. El límite de aviso se subió a
  600 kB con el motivo escrito en `vite.config.ts` (antd y `@rc-component` no se pueden
  separar sin romper la app al cargar).

### D6 — `forgot-password` resetea la contraseña pero nunca entrega la nueva (🔴 prioritaria)

**Síntoma**: un usuario pide recuperar su contraseña, la UI confirma "If that address has an
account, sign in with the temporary password", y no puede iniciar sesión con ninguna
contraseña. La antigua dejó de funcionar y la nueva no se la conoce.

**Causa**: `AuthService.resetPassword()` (`backend/src/domain/auth/auth.service.ts:174-178`)
genera la contraseña temporal, la hashea, **guarda el usuario** y luego llama a
`MailerService.sendTemporaryPassword()`. Ese mailer es un placeholder que solo escribe en el
log del backend (`backend/src/domain/auth/mailer.service.ts:19`):

```ts
this.logger.log(`[MAIL] to=${to} temporaryPassword=${password}`);
```

**Por qué es peor que D5**: D5 es un silencio (se acumulan avatares huérfanos). Aquí el
endpoint es **destructivo y sin salida**: invalida la credencial vigente del usuario y no le
da ninguna forma de conocer la nueva, salvo acceso al log del contenedor. Cualquier
intento de recuperación acaba en un password reset manual desde la base de datos.

**Agravante**: el mensaje neutro de la API ("has been sent") describe un envío que no ocurre.
El frontend ya no puede corregirlo — la respuesta solo trae `message` — porque el
contrato es correcto y lo que falta es la entrega.

**Arreglo**: implementar un mailer real (nodemailer/Resend) con configuración SMTP por
entorno. Mientras no exista, la UI no debería prometer un envío.

### D7 — `VITE_API_URL` es un build arg muerto: la URL de la API funciona por casualidad

**Síntoma**: el build de la imagen del frontend emite
`one or more build args were not consumed: [VITE_API_URL]`, y aun así la app funciona.

**Causa**: `docker-compose.yml:162` pasa `VITE_API_URL` como `build.args`, pero
`frontend/Dockerfile` no declara ningún `ARG VITE_API_URL` ni lo usa en ninguna capa. La
URL real sale del fallback in-code de `frontend/src/api/client.ts:17`:

```ts
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
```

**Impacto**: en el stack actual funciona porque el navegador y la API comparten host. En
cualquier despliegue donde el frontend se sirva en otro origen, `API_URL` queda fijado a
`localhost:3000` y apunta al navegador del usuario, no al servidor. El fallo no aparece en
build ni en CI.

**Arreglo**: declarar `ARG VITE_API_URL` en la etapa de build y escribirlo en el stage, o
sacar la URL del runtime (config inyectada en `index.html`) en vez de compilarla.

### D8 — `api.health()` y `api.tokens()` son código muerto

**Causa**: al añadir los schemas Zod (Paso 2.3) se contractuaron también `healthSchema` y
`apiTokenListSchema`, pero no hay ningún consumidor: `rg 'api\.(tokens|health)\(' src` no
devuelve nada. Son restos de un health check que se retiró.

**Arreglo**: borrarlos (cliente y schema), o bien documentar para qué se conservan. Hoy
mantienen ~40 líneas de contrato que nada valida.

### D9 — Trampa en `manualChunks`: el build pasa y la app muere al cargar

**No es un bug activo**, sino una disarmadiza para quien retoque `vite.config.ts`.

Separar `@rc-component` de `antd` en chunks distintos **compila limpio** y rompe la
aplicación en runtime con `ReferenceError: Cannot access 'bi' before initialization`: los
componentes de rc se referencian entre sí y con el contexto de antd de forma cíclica, y al
repartirlos Rollup pierde el orden de inicialización.

**Por qué importa**: `npm run build` da 0 errores en el caso que rompe la app. Solo se
detecta navigating en un navegador. Si alguien "optimiza" el chunk de antd para bajar de
600 kB, va a tener un build verde y una app en blanco.

**Mitigación aplicada**: el motivo está escrito en `vite.config.ts` junto al
`chunkSizeWarningLimit`. Si alguien lo sube o lo cambia, que lea ese comentario antes.

### D5 — `InMemoryBroker` no cruza procesos: los avatares huérfanos nunca se limpian

**Síntoma**: al borrar un usuario, la API publica `orphan-cleanup`; el worker se suscribe a
ese evento. Pero la limpieza no ocurre.

**Causa**: `InMemoryBroker` guarda la cola en la memoria del proceso que la usa. La API
(publica) y el worker (suscribe) son **procesos distintos**, cada uno con su propia
instancia y su propio mapa en memoria. El evento se publica en el mapa de la API, donde
nadie lo escucha. Confirmado en runtime: el log `[InMemoryBroker] Subscribed to
orphan-cleanup` aparece en el worker, y el API tiene su propia instancia sin suscriptores.

**Consecuencia**: cada usuario eliminado deja su avatar huérfano en el bucket
`riskio-avatars`. No grows sin límite, porque el mismo bug deja huérfano cualquier otro
objeto pendiente de limpieza, pero no se notó en desarrollo porque el síntoma es
silencioso.

**Por qué NO se arregla con Redis**: activar `BROKER_DRIVER=redis` sin escribir el adapter
`redis.broker.ts` no arregla nada, solo cambia el modo de fallo. Con `redis` aceptado por el
esquema de validación y sin implementarlo, se pierde el evento igual. Además, Redis para un
único evento de baja latencia y baja frecuencia es sobreingeniería.

**Opciones**:

1. **Llamada directa al `STORAGE_SERVICE` desde `UsersService`** (recomendada). Elimina la
   indirección, el canal y el contrato del evento para un único caso de uso. Un avatar
   huérfano es barato de aceptar de forma puntual; lo que no conviene es un canal de
   eventos roto y silencioso.
2. Implementar `redis.broker.ts` de verdad, si en el futuro hay trabajo asíncrono real
   (notificaciones, exports, ingesta) que justifique un broker durable.

→ **Paso 1.4** (rediseñado)


---

## Fase 1 — Compose: mejoras de mantenibilidad (sin cambiar comportamiento)

### Paso 1.1 — YAML anchors para variables S3 compartidas

Extraer el bloque STORAGE_* repetido en `backend-api` y `backend-worker` a un anchor `x-common-storage: &common-storage` y aplicarlo con `<<: *common-storage`. Sin cambios de comportamiento: mismo resultado, menos duplicidad.

**Explicación**: YAML anchors + merge keys (`<<`) permiten definir un bloque una vez y reutilizarlo. Compose los soporta (extensión de YAML), y evitan que un valor cambie en un servicio y no en el otro (drift).

### Paso 1.2 — Mover credenciales S3 a `.env` (con defaults `any`)

Quitar `STORAGE_ACCESS_KEY: any` / `STORAGE_SECRET_KEY: any` hardcodeados y leerlos de `.env` con fallback `any` solo en dev. Actualizar `.env.example`.

**Explicación**: "any" es específico de SeaweedFS. Hardcodearlo en el compose lo viajaría a otros entornos. Con defaults en `.env` el compose queda agnóstico al proveedor de storage (facilita migrar a AWS/LocalStack después).

### Paso 1.3 — Redes dedicadas `core` / `edge` — **HECHO**

Dos redes en lugar de una: `core` (db, storage, redis, backend-api, backend-worker) y
`edge` (frontend, backend-api, storage). El frontend queda sin ruta a la base de datos ni a
Redis. `storage` está en ambas porque el navegador necesita alcanzar los avatares por
puerto publicado; `backend-api` en ambas porque es el único que habla con el browser.

`postgres` y `redis` pasan a publicarse solo en `127.0.0.1`.

**Explicación**: una red dedicada documenta y restringe qué servicios se ven entre sí. Pero
agrega complejidad; en dev local no es urgente.

**Trampa encontrada al implementarlo**: SeaweedFS hace bind de **una sola interfaz** (la que
detecta último), no de `0.0.0.0`. Con dos redes, el worker —solo en `core`— recibía
`ECONNREFUSED` contra storage, mientras el API, en ambas redes, respondía bien: el síntoma
parecía intermitente y quedaba enmascarado. Se resolvió con `-ip.bind=0.0.0.0` en el
`command` de `storage`, dejando `-ip` en autodetección porque es la dirección que SeaweedFS
se anuncia a sus propios master/volume/filer.

> Lección: al partir un servicio en varias redes, verificar que escucha en `0.0.0.0` y no
> solo en "una IP concreta". Comprobar la conectividad desde **el** servicio con menos
> redes, no desde el que tiene todas.

### Paso 1.4 — Limpieza de avatares huérfanos: **rediseñado, no hecho**

El paso original (persistir la cola con `BROKER_DRIVER=redis`) parte de una premisa
incorrecta y está **descartado como está escrito**. Ver **D5**: el problema no es que la cola
se pierda ante un reinicio, es que el evento **nunca llega** a su consumidor.

La ingesta de NHC no pasa por el broker (usa `@Cron` cada 10 min), así que la única función
del broker hoy es la limpieza de avatares huérfanos. El broker puede quedarse en memoria y
desacoplarse de Redis por completo.

---

## Fase 2 — Frontend: Adoptar React 19 (prioridad por impacto)

**Estado: completada** (2026-09-26). Commits `edb2702`, `910ff56`, `3f4184d`, `f43a8ed`, `3f60f2a`.

### Paso 2.1 — ✅ Ejecutado — Error Boundaries por ruta/feature

Envolver rutas protegidas con un error boundary (`react-error-boundary` o uno propio pequeño) con fallback accesible ("Algo salió mal", botón reintentar). Complementa el loading ya existente.

**Explicación**: `Suspense` maneja el estado *cargando*; un error durante render solo lo captura un *Error Boundary*. Sin él, un fallo en un componente tumba toda la app (pantalla en blanco). Es la pieza que faltaba para robustez de UX.

**Resultado**: `RouteErrorBoundary` propio (sin dependencia nueva), montado en `AppLayout` y `AuthLayout` para que un fallo de una ruta no vacíe el shell. Verificado inyectando un fallo real en render.

### Paso 2.2 — ✅ Ejecutado — Adoptar TanStack Query para server state

Reemplazar el manejo manual de `loading/error/data` y el TTL cache de `data/promises.ts` por `useQuery`/`useMutation` con `queryKeys` por entidad. Beneficios: invalidación automática tras mutaciones (deuda actual), revalidación, dedupe, optimistic updates.

**Explicación**: "server state" (datos del servidor) tiene ciclo de vida distinto al "client state" (UI local). React no tiene solver de server state; `useEffect` + `useState` es reinventar TanStack Query a medias. La invalidación post-mutación (p. ej. tras subir avatar, invalidar `['users','me']`) es lo que el TTL actual no puede hacer.

**Resultado**: `@tanstack/react-query` 5.104. Fuera el TTL manual de `data/promises.ts` y `data/preload-result.ts`. Las mutaciones de perfil escriben el usuario actualizado en caché en vez de invalidar y refetch. De paso se corrigió un bug preexistente: `ProfileCard` se inicializaba con el stub del JWT, así que guardar el perfil no funcionaba.

### Paso 2.3 — ✅ Ejecutado — Zod en la frontera API (`api/client.ts`)

Validar responses con Zod: contrato en runtime. Errores de validación explícitos (no `undefined` silenciosos).

**Explicación**: TypeScript solo existe en build time; en runtime el JSON puede no cumplir el contrato (backend deployado con otro shape). Zod valida en la frontera y convierte "undefined silencioso" en "error visible". Es barato y previene bugs de runtime difíciles.

**Resultado**: cada schema está atado por una aserción de tipos exportada a la interfaz que refleja, así que un campo que se añade a un lado y no al otro rompe el build. Ese guard encontró un bug vivo: `ForgotPasswordResult` declaraba `email` y `temporaryPassword`, pero la API solo devuelve un mensaje neutro (a propósito, para no permitir enumerar cuentas) y la pantalla de éxito renderizaba literalmente "undefined".

### Paso 2.4 — ✅ Ejecutado — Colocation + barrel exports por feature

Mover componentes feature-only a `features/weather/storms/components/`. Crear `features/weather/storms/index.ts` que exporte la API pública de la feature (componentes, hooks, tipos). Reservar `components/layout/` para shells globales.

**Explicación**: "colocation" = agrupar lo que cambia junto. Si un componente solo lo usa una feature, debe vivir en esa feature (no en `layout/protected/`, que sugiere layout global). El barrel export define la *API pública* de la feature y permite mover internals sin romper imports externos.

**Resultado**: 30 renombres, 0 cambios de lógica. `StormCard`, `StormList` y `StormMap` estaban en `global_components/` sin ser globales (un consumidor cada uno); ahora viven en `features/weather/*` tras un `index.ts`.

### Paso 2.5 — Cancelado — React 19: `use()` + Suspense en páginas de detalle

**No se ejecuta, y no es deuda pendiente.** El Paso 2.2 migró las lecturas a `useQuery`, que ya expone `isPending`/`isError` y gestiona el ciclo de vida de la petición: `use()` ya no aporta nada aquí y reintroducirlo sería volver al estado manual que 2.2 eliminó a propósito. Los skeletons se renderizan inline en el componente que hace la query, no como fallback de `Suspense`. React 19 ya estaba adoptado antes de esta fase (`react`/`react-dom` `^19.1.0`).

Lo que sí se conservó de la idea original: cada chunk lazy tiene su frontera `Suspense` (la de `AppLayout` para rutas protegidas, la raíz en `main.tsx` para las públicas).

**Explicación**: `use()` (React 19) permite leer una promesa directamente en render y suspender el componente, sin `useEffect` + `useState` + bandera de loading. Menos código, y prepara para streaming. En formularios, `useFormStatus` da el estado de envío sin boilerplate.

### Paso 2.6 — ✅ Ejecutado — Code splitting por ruta

`React.lazy` + `Suspense` para rutas pesadas (Dashboard, Storms, cualquier vista de mapa). Reduce bundle inicial.

**Explicación**: code splitting descarga el código de rutas que el usuario quizá no visita. Con `Suspense` como frontera, cada chunk tiene su propio loading. Es la mejora de performance de carga más directa.

**Resultado**: las 9 rutas cargan bajo demanda. `StormDetailsPage` era eager y arrastraba `AdvisoryContent` → `StormMap` → `react-leaflet` → `leaflet` al chunk inicial: iniciar sesión costaba el mapa aunque nunca se abriera una tormenta. Medido sobre el build real, abrir un detalle descarga 171 kB de código de mapa que el login ya no pide. El barrel de `storms` dejó de re-exportar `StormMap` por el mismo motivo.

---

## Fase 3 — Auditorías (permite el usuario)

### Paso 3.1 — Auditoría de accesibilidad (a11y)

Revisar con axe-core (dev) y Lighthouse: roles/aria en elementos interactivos, navegación por teclado, foco visible, labels en formularios, contraste, landmarks, `alt` en imágenes, live regions para errores. Corregir hallazgos y documentar.

Herramientas: axe DevTools / `@axe-core/react`, Lighthouse, plugins de teclado.

**Explicación**: a11y no es "extra", es usabilidad para todos (teclado, lectores de pantalla, contraste). Se automatiza con axe/Lighthouse y se corrige con foco visible, roles correctos y teclado operable.

### Paso 3.2 — Auditoría de Web Vitals

Medir en la app real (build de producción, no dev server):
- **LCP** (Largest Contentful Paint): qué se ve primero. Objetivo < 2.5s.
- **INP** (Interaction to Next Paint): respuesta a interacción. Objetivo < 200ms.
- **CLS** (Cumulative Layout Shift): estabilidad visual. Objetivo < 0.1.
Herramientas: Lighthouse, `web-vitals` library, DevTools Performance.

Acciones típicas: preconnect, servir imágenes optimizadas, code splitting (Paso 2.6), evitar CLS con dimensiones de imágenes, `content-visibility` en listas largas.

**Explicación**: los Core Web Vitals miden lo que el usuario *siente*: qué tan rápido aparece (LCP), qué tan rápido responde (INP) y qué tan estable se ve (CLS). Medir sin optimizar es adivinar; los budgets orientan dónde invertir.

---

## Fase 4 — Deuda técnica detectada (después de los commits)

No se toca antes de commitear, para no mezclar un commit con un refactor grande.

### Paso 4.1 — Backend: unificar `history` / `storm-history` / `weather/storms`

Hoy conviven tres carpetas. `StormHistoryController` sigue montado en `/storm-history`.
Decidir: ¿`storm-history` es el nombre definitivo (se renombra a `weather/storm-history` o similar),
o se elimina y se sirve desde `weather/storms`? Luego borrar código muerto y sus rutas.

**Explicación**: código duplicado no es "código gratis". Cada copia se mantiene, se rompe y se
depurga por separado. El nombre debe reflejar el dominio (`weather/storm-history`), no el concepto
transversal ("history"), porque `history` no es un dominio de negocio aquí: lo es el historial de tormentas.

### Paso 4.2 — Frontend: eliminar duplicados

- `helpers/*` duplica `domain/*` → dejar solo `domain/*` (un nombre, un lugar) y actualizar imports.
- `global_components/StormCard|StormList` duplica `features/weather/components/dashboard/` → dejar la versión de la feature.
- `PageFallBack/` vs `PageFAllBack/` (typo) → dejar uno.
- `pages/protected/*` vs `features/weather/pages/*` → decidir si `pages/` es solo un re-export (barrel) o desaparece.

**Explicación**: "una responsabilidad, un lugar". Cuando el mismo componente existe en dos carpetas,
cualquiera puede quedar desactualizada y el bug aparece en una sola de ellas. El Imports de una
carpeta duplicada también confunde: no se sabe cuál es la fuente de verdad.

### Paso 4.3 — Propagar las mejoras de Fase 2 al código ya movido

Las mejoras de Fase 2 (Error Boundaries, TanStack Query, Zod, React 19) se aplican primero al código
"vivo" (el que los routers importan). Al resolver 4.2, verificar que las features nuevas heredan los patrones.

### Paso 4.4 — Reactivar los tests comentados del backend (🔴 D1, antes que 4.1)

Es lo primero de esta fase: mientras `npm test` falle, cualquier refactor posterior
(4.1–4.3) se hace sin red de seguridad.

1. `storms.service.spec.ts` — cerrar el `/*` de la línea 78, descomentar el `beforeEach`
   y el cuerpo de los 6 tests. Actualizar la aserción de `findOne` al `StormDto` actual
   (`latestAdvisoryIssuedAt` en lugar de `riskLevel`).
2. `dashboard.service.spec.ts` — reinstaurar `new DashboardService(stormsRepo, advisoriesService)`,
   quitar el `it.skip` y añadir `pacific: 0, atlantic: 0` a la aserción de `totals`.
3. Mover a nivel de `describe` el `it()` anidado en la línea 168.
4. `npm test` debe volver a **209/209** antes de seguir.

Meta: 209 tests verdes, cubriendo el refactor de DTOs de `ab31a18` y los totales por
cuenca de `4e425ae`.

---

## Resumen de entregables por fase

| Fase | Entregable | Riesgo |
|---|---|---|
| 0 | ✅ 20 commits atómicos, árbol limpio | Bajo |
| 1 | ✅ Compose con anchors + config por `.env` | Bajo |
| 2 | ✅ Frontend con Error Boundaries, TanStack Query, Zod, colocation, splitting | Medio (refactor de data layer) |
| 3 | Informe de a11y + Web Vitals con acciones priorizadas | Bajo (auditoría) |
| 4 | **D1 primero:** 209/209 tests verdes, duplicados eliminados (backend history, frontend helpers/pages) | Medio (toca imports) |

Fases 0, 1 y 2 ejecutadas (2026-09-26). La 2 dejó el bundle de entrada en 25 kB y el
comportamiento verificado contra el stack en ejecución.

## Orden de ejecución

1. ~~**Fase 4.4** (D1) — reactivar los tests.~~ **Aplazado por decisión del usuario**
   (2026-09-26). Sigue siendo bloqueante para cualquier otra cosa que toque el backend con
   tests: no se ha cerrado, se ha pospuesto.
2. ~~**Fase 1** — compose: anchors, credenciales a `.env`, red dedicada.~~ ✅
3. ~~**Fase 4.1–4.3** — unificar duplicados de backend y frontend.~~ Pendiente.
4. ~~**Fase 2** — React 19: Error Boundaries, TanStack Query, Zod, colocation, splitting.~~ ✅
5. **Fase 3** — auditorías de a11y y Web Vitals, con informe de prioridades.

**Entre lo pendiente, lo primero por impacto de usuario es D6** (recuperación de contraseña
que deja al usuario sin acceso) y **D7** (URL de la API que solo funciona en local). Ambos
son cortos y no dependen de D1.

Cada paso se ejecuta y se revisa antes de pasar al siguiente. Nada se commitea sin
revisar el diff.


---

## Estado al cierre — 2026-09-26, commit `0740471`

Fases 0, 1 y 2 ejecutadas. Árbol limpio. Sin push: los commits de la Fase 2 y la
documentación están solo en local. `contexto.txt` quedó en `.gitignore` y D1 aplazado por
decisión, ambos registrados en la sección de deuda.

### Stack

| Servicio | Estado |
|---|---|
| `frontend` | Up, sirve el build de la Fase 2 (chunks `vendor-antd`, `vendor-react`, `vendor-data`, `index`) |
| `backend-api` | healthy, `/health` → 200 |
| `backend-worker`, `db`, `redis`, `storage` | Up |

Web en `http://localhost` (**puerto 80**: `.env` tiene `WEB_PORT=80`, no 8080 como
`.env.example`). API en `:3000`.

**Ojo al desplegar**: `podman-compose up -d --build frontend` construye la imagen pero **no
recrea el contenedor** — se queda sirviendo el build anterior sin avisar. Hay que añadir
`--force-recreate`. Se detectó comparando el nombre del chunk que servía el contenedor con el
del build local.

### Verificación

Sin tests (D1 aplazado por decisión). La puerta real es el navegador: **`npm run build` da 0
errores en casos que rompen la app** (ver D9).

Scripts desechables en `/tmp/opencode` (fuera del repo, se pierden al reiniciar):
`spa.py` sirve `frontend/dist` en `:8080`; `walk2.mjs` recorre las 4 rutas contra un usuario
de prueba; `detail.mjs` abre un advisory con mapa; `weight.mjs` mide bytes por ruta. La
cuenta de prueba está en `probe-email.txt`.

**Sin esperas**: `domcontentloaded` + selector con timeout, nunca `networkidle` ni `sleep`.
El usuario se quejó dos veces de comprobaciones lentas.

### Si retomar

1. **D6** (mailer) — bloquea a usuarios, corto, no necesita D1.
2. **D7** (URL de la API) — corto, invisible al build.
3. **Fase 3** — auditorías a11y y Web Vitals, solo si el usuario las habilita.
4. **D1** — sigue siendo bloqueante para tocar el backend con tests.
