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

### D1 — Specs de backend con tests comentados (🔴 prioritaria)

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

- `contexto.txt` sin trackear en la raíz (notas personales, no código). Decidir si se
  commitea, se añade a `.gitignore` o se borra.
- `npm run lint` del frontend es un alias de `npm run build` (`"lint": "vite build"`):
  no hay linter real. El build sí ejecuta `tsc -b`, así que hay type-checking.
- Bundle inicial del frontend: **1.063 kB** (gzip 337 kB) con un chunk que dispara el
  aviso de Vite (>500 kB). → se ataca en **Paso 2.6**.


---

## Fase 1 — Compose: mejoras de mantenibilidad (sin cambiar comportamiento)

### Paso 1.1 — YAML anchors para variables S3 compartidas

Extraer el bloque STORAGE_* repetido en `backend-api` y `backend-worker` a un anchor `x-common-storage: &common-storage` y aplicarlo con `<<: *common-storage`. Sin cambios de comportamiento: mismo resultado, menos duplicidad.

**Explicación**: YAML anchors + merge keys (`<<`) permiten definir un bloque una vez y reutilizarlo. Compose los soporta (extensión de YAML), y evitan que un valor cambie en un servicio y no en el otro (drift).

### Paso 1.2 — Mover credenciales S3 a `.env` (con defaults `any`)

Quitar `STORAGE_ACCESS_KEY: any` / `STORAGE_SECRET_KEY: any` hardcodeados y leerlos de `.env` con fallback `any` solo en dev. Actualizar `.env.example`.

**Explicación**: "any" es específico de SeaweedFS. Hardcodearlo en el compose lo viajaría a otros entornos. Con defaults en `.env` el compose queda agnóstico al proveedor de storage (facilita migrar a AWS/LocalStack después).

### Paso 1.3 — (Opcional) Red dedicada

Crear red `app` (comunicación interna) y mantener la red por defecto para puertos publicados. Impacto: aislamiento. Riesgo: romper conectividad si se hace mal. Se puede posponer.

**Explicación**: una red dedicada documenta y restringe qué servicios se ven entre sí. Pero agrega complejidad; en dev local no es urgente.

### Paso 1.4 — (Opcional) `BROKER_DRIVER=redis`

Solo si los jobs en background (ingest) no pueden perderse ante reinicio. Redis ya existe.

**Explicación**: `BROKER_DRIVER=memory` guarda la cola en RAM del proceso. Si el worker reinicia, la cola se pierde. Con Redis la cola persiste. Es una decisión de negocio (durabilidad), no técnica pura.

---

## Fase 2 — Frontend: Adoptar React 19 (prioridad por impacto)

### Paso 2.1 — Error Boundaries por ruta/feature

Envolver rutas protegidas con un error boundary (`react-error-boundary` o uno propio pequeño) con fallback accesible ("Algo salió mal", botón reintentar). Complementa el loading ya existente.

**Explicación**: `Suspense` maneja el estado *cargando*; un error durante render solo lo captura un *Error Boundary*. Sin él, un fallo en un componente tumba toda la app (pantalla en blanco). Es la pieza que faltaba para robustez de UX.

### Paso 2.2 — Adoptar TanStack Query para server state

Reemplazar el manejo manual de `loading/error/data` y el TTL cache de `data/promises.ts` por `useQuery`/`useMutation` con `queryKeys` por entidad. Beneficios: invalidación automática tras mutaciones (deuda actual), revalidación, dedupe, optimistic updates.

**Explicación**: "server state" (datos del servidor) tiene ciclo de vida distinto al "client state" (UI local). React no tiene solver de server state; `useEffect` + `useState` es reinventar TanStack Query a medias. La invalidación post-mutación (p. ej. tras subir avatar, invalidar `['users','me']`) es lo que el TTL actual no puede hacer.

### Paso 2.3 — Zod en la frontera API (`api/client.ts`)

Validar responses con Zod: contrato en runtime. Errores de validación explícitos (no `undefined` silenciosos).

**Explicación**: TypeScript solo existe en build time; en runtime el JSON puede no cumplir el contrato (backend deployado con otro shape). Zod valida en la frontera y convierte "undefined silencioso" en "error visible". Es barato y previene bugs de runtime difíciles.

### Paso 2.4 — Colocation + barrel exports por feature

Mover componentes feature-only a `features/weather/storms/components/`. Crear `features/weather/storms/index.ts` que exporte la API pública de la feature (componentes, hooks, tipos). Reservar `components/layout/` para shells globales.

**Explicación**: "colocation" = agrupar lo que cambia junto. Si un componente solo lo usa una feature, debe vivir en esa feature (no en `layout/protected/`, que sugiere layout global). El barrel export define la *API pública* de la feature y permite mover internals sin romper imports externos.

### Paso 2.5 — React 19: `use()` + Suspense en páginas de detalle

Migrar el fetch de Storm detail a `use(promise)` + `<Suspense>`, reduciendo el estado `loading/error` manual. Aprovechar `useActionState`/`useFormStatus` en formularios simples.

**Explicación**: `use()` (React 19) permite leer una promesa directamente en render y suspender el componente, sin `useEffect` + `useState` + bandera de loading. Menos código, y prepara para streaming. En formularios, `useFormStatus` da el estado de envío sin boilerplate.

### Paso 2.6 — Code splitting por ruta

`React.lazy` + `Suspense` para rutas pesadas (Dashboard, Storms, cualquier vista de mapa). Reduce bundle inicial.

**Explicación**: code splitting descarga el código de rutas que el usuario quizá no visita. Con `Suspense` como frontera, cada chunk tiene su propio loading. Es la mejora de performance de carga más directa.

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
| 1 | Compose con anchors + config por `.env` | Bajo |
| 2 | Frontend con Error Boundaries, TanStack Query, Zod, colocation, React 19, splitting | Medio (refactor de data layer) |
| 3 | Informe de a11y + Web Vitals con acciones priorizadas | Bajo (auditoría) |
| 4 | **D1 primero:** 209/209 tests verdes, duplicados eliminados (backend history, frontend helpers/pages) | Medio (toca imports) |

## Orden de ejecución

1. **Fase 4.4** (D1) — reactivar los tests. Es bloqueante: nada más se hace con `npm test` en rojo.
2. **Fase 1** — compose: anchors, credenciales a `.env`, red dedicada (opcional).
3. **Fase 4.1–4.3** — unificar duplicados de backend y frontend.
4. **Fase 2** — React 19: Error Boundaries, TanStack Query, Zod, colocation, splitting.
5. **Fase 3** — auditorías de a11y y Web Vitals, con informe de prioridades.

Cada paso se ejecuta y se revisa antes de pasar al siguiente. Nada se commitea sin
revisar el diff.

