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

---

## Resumen de entregables por fase

| Fase | Entregable | Riesgo |
|---|---|---|
| 0 | Cambios agrupados en commits atómicos | Bajo |
| 1 | Compose con anchors + config por `.env` | Bajo |
| 2 | Frontend con Error Boundaries, TanStack Query, Zod, colocation, React 19, splitting | Medio (refactor de data layer) |
| 3 | Informe de a11y + Web Vitals con acciones priorizadas | Bajo (auditoría) |
| 4 | Código duplicado eliminado (backend history, frontend helpers/pages) | Medio (toca imports) |

## Cómo lo ejecutamos

1. Empezamos por **Fase 0** (commits). Revisamos el diff del grupo antes de commitear.
2. Cada commit lleva su explicación (qué/porqué), para que quede documentado.
3. Avanzamos a **Fase 1** solo cuando Fase 0 esté limpia.
4. **Fase 2** es la más grande: la hacemos feature por feature, no de golpe.
5. **Fase 3** al final, con informe de hallazgos y prioridades.
