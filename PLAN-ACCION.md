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
> con un refactor grande.
>
> D1–D5 se recogieron al agrupar el trabajo previo; D6–D12 aparecieron al ejecutar las Fases
1 y 2, buscando y no previstas en el plan. No todas las entradas son deuda: D9 es una
precaución, y de D6 a D10 la mayoría están resueltas. La tabla es el índice; debajo, el
detalle.

| # | Qué es | Impacto | Dónde se arregla | Estado |
|---|---|---|---|---|
| D4 | Observaciones sueltas | — | — | 2 de 3 resueltos |
| D9 | `manualChunks` compila verde y mata la app | — No hay bug activo | — | Precaución, no deuda |
| D16 | `/auth/tokens` sin consumidor: ni UI ni spec | 🟠 Feature sin terminar | — | Abierta, decisión de producto |
| D2 | Carpetas duplicadas en backend | 🟡 Mantenimiento doble | 4.1 | **Resuelta** (`336ea0e`) |
| D3 | Carpetas duplicadas en frontend | 🟡 Una de las dos queda vieja | 4.2 | **Resuelta** (`d4b5fce`) |
| D1 | Specs de backend comentados | 🔴 Sin red de seguridad | 4.4 | **Resuelta** (`2bcc948`) |
| D5 | `InMemoryBroker` no cruza procesos | 🟠 Avatares huérfanos | 4.5 | **Resuelta** (`557b6f1`) |
| D6 | `forgot-password` no entregaba la contraseña | 🔴 Usuario sin acceso a la cuenta | 4.7 | **Resuelta** (`cf4f2e5`, `e646477`, `608ce38`) |
| D7 | `VITE_API_URL` era un build arg muerto | 🟠 Solo funcionaba en local | — | **Resuelta** (`1ddefa5`) |
| D8 | `api.health()` / `api.tokens()` sin uso | 🟡 Contrato que nada validaba | 4.6 | **Resuelta** (`2a6739e`) |
| D10 | Migración aplicada que nunca existió en el repo | 🔴 Despliegue no reproducible | — | **Resuelta** (`0955a80`) |
| D11 | Specs de integración caídos | 🟠 Cobertura inexistente | — | **Resuelta** (`0955a80`, `2dd0b3e`) |
| D12 | `generateTemporaryPassword` sin uso | 🟡 Código muerto | — | **Resuelta** (`b74b0ad`) |
| D13 | `204` antes de los GET del dashboard | — No era un bug | — | **Resuelta** |
| D14 | Capa de mensajería sin uso | 🟡 ~350 líneas muertas | — | **Resuelta** (`77198c2`) |
| D15 | Ingesta NHC duplicada en dos procesos | 🟠 Doble tráfico a NOAA | — | **Resuelta** (`64e9445`) |

**Abierta: 1** (D16, decisión de producto). **Cerradas: 14.** D9 es una precaución, no deuda.

**Cobertura**: unitaria **191/191**, integración **31/31**. Cero fallos, cero skip.

**Abiertas: 3** (D2, D3, D16). **Cerradas: 12.** D9 es una precaución, no deuda.

**Cobertura**: unitaria **197/197**, integración **37/37**. Cero fallos, cero skip.

**Abiertas: 4** (D1 aplazada, D2, D3, D16). **Cerradas: 11.** D9 es una precaución, no deuda.

**Abiertas: 4** (D1 aplazada, D2, D3, D8). **Cerradas: 10.** D9 es una precaución, no deuda.

### ~~D1 — Specs de backend con tests comentados~~ **Resuelta** (`2bcc948`)

> **Resuelta.** Ninguno de los dos archivos fallaba por código equivocado: estaban neutered por
> un `/*` mal cerrado y una línea de constructor comentada.
>
> - `storms.service.spec.ts`: el `/*` de `service = new StormsService(repository)` se tragaba el
>   archivo entero hasta el `*/` final. Vitest decía "No test found" y **6 tests eran
>   inalcanzables**.
> - `dashboard.service.spec.ts`: al comentar el constructor hubo que comentar cada línea que
>   tocaba `service`, lo que dejó **14 tests que declaraban `result` y no lo usaban**, un `it()`
>   anidado dentro de otro, un `it.skip` y ocho bloques `/* */` alrededor de las aserciones.
>
> Los dos servicios habían crecido una y dos dependencias de constructor que los specs nunca
> supieron, y eso lo cazó el type-checker en cuanto se quitaron los comentarios: `StormsService`
> necesita `CacheService`; `DashboardService`, `AdvisoriesService` y `CacheService`. Los stubs de
> caché dejan pasar la llamada, así que los tests ejercitan el cálculo real.
>
> **Cinco tests solo tenían forma de test**: declaraban `result`, no lo usaban y pasaban. Los
> delató el aviso de `no-unused-vars` del linter, no yo. Sus aserciones están de vuelta y los
> números que comprueban (totales, ACE, umbral de huracán) vuelven a contar.
>
> **Sobre la meta de 209**: son 197, y la diferencia no son tests sin restaurar. El 209 se registró
> antes del refactor de DTOs, y parte de esos tests ya no describen el contrato actual. No inventé
> 12 tests para llegar a una cifra.
### D1 — Specs de backend con tests comentados (⏸ aplazado por decisión)

> **Decisión del usuario (2026-09-26): aplazar.** No es deuda que se vaya a resolver sola ni
> un olvido: queda registrada como aplazada a propósito. Sigue siendo la puerta que bloquea
> cualquier cambio de backend que toque código cubierto por estos specs. Mientras tanto,
> `npm test` no se ejecuta como criterio de aceptación — la verificación es `npm run build` +
> navegador.

**Estado actual**: `npm test` → **3 failed | 171 passed | 1 skipped (175)**. Sin cambios:
lo que se reparó en esta sesión fue la suite de **integración**, que es distinta. Antes de la
Fase 0 la suite unitaria estaba en **209/209**.

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

### ~~D2 — Carpetas duplicadas en backend~~ **Resuelta** (`336ea0e`)

> **La premisa era falsa.** `domain/history/` se renombró a `domain/storm-history/` en Fase 0
> (`e56e0fa`) y ya no existe, y **ningún símbolo está definido dos veces** entre `storm-history` y
> `weather/storms/`.
>
> Lo que sí estaba duplicado era la **capacidad**: el frontend tiene pestañas Active/Past en
> `/storms` y las lee por `GET /storms?tab=active|past`, mientras `GET /storm-history` devolvía una
> lista paginada de esas mismas tormentas inactivas. Dos endpoints para una feature, y `9116fb2`
> movió el cliente al otro al plegar el historial dentro de `/storms`. El segundo no lo consumía
> nadie: 490 líneas con sus dos specs.
>
> Verificado, no asumido: tras el cambio `/storm-history` da 404 y `/storms?tab=past` sigue
> devolviendo las 2 tormentas inactivas. Unit 197 → 191 e integración 37 → 31, predicho y exacto.

### ~~D3 — Carpetas duplicadas en frontend~~ **Resuelta** (`d4b5fce`)

> **La premisa también era falsa:** no hay duplicación. Ningún símbolo se define dos veces entre
> `helpers/` y `domain/`; `basinLabel` **importa** `BASIN` de `domain/storm` en vez de copiarlo.
> Eran capas, y el nombre `helpers/`sugería lo contrario.
>
> Con tu criterio de "una responsabilidad, un lugar" cada helper se movió junto a su dominio:
> `helpers/storms/*` → `domain/storm/` (el `.tsx` renombrado a `presentation.tsx`, porque es lógica
> de presentación), `helpers/geo/*` → `domain/geo/`, `helpers/format-time/datetime.ts` →
> `domain/datetime/format.ts`.
>
> **Una función no encajaba**: `toWhen(isActive, storm)` recibe un `StormAggregate`, así que se fue a
> `domain/storm` con el resto en vez de quedarse en un módulo de fechas genérico que tendría que
> importar el dominio de tormentas solo para compilar.
>
> Sin suite en el front, la verificación es el build y el navegador: las 6 rutas renderizan con
> longitudes **idénticas** a antes del movimiento (825/707/476/451/825/102), que es la única señal
> con sentido para un refactor que es todo formato de fechas y tormentas.


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

### ~~D5 — `InMemoryBroker` no cruza procesos~~ **Resuelta** (`557b6f1`)

> **Sin paso asignado.** Registrado con la recomendación (llamar a `STORAGE_SERVICE`
> directamente desde `UsersService`) pero nunca convertido en fase. → **Paso 4.5** (propuesto,
> requiere tu visto bueno)

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

**Cómo se cerró**: `UsersService` llama a `STORAGE_SERVICE` directamente y el consumer
`OrphanCleanupConsumer` se eliminó, porque se suscribía a un topic que nadie publica y su log
"Subscribed" hacía creer que la limpieza funcionaba. El avatar se borra **después** del commit
de la transacción, no dentro: dentro, un rollback borraría el archivo de una cuenta que sigue
existiendo. Verificado contra el stack: avatar subido, cuenta borrada, y el objeto pasó de 4
a 3 en el bucket mientras el usuario pasó a 0 filas. Seis tests lo fijan.

> **Lo que dejó esto abierto (D14)**: la capa de mensajería completa —interfaz, token, módulo
> y tres adapters (memory, SQS, Kafka)— ya no la consumía nadie. Se retiró en `77198c2` con tu
> visto bueno, llevándose `kafkajs` y `@aws-sdk/client-sqs`, que no tenían otro uso.
>
> Con ella salió `BROKER_DRIVER` del esquema de entorno, y eso importa: validaba
> `memory|redis`, y `redis` se aceptaba **sin adapter detrás**, así que un `.env` con esa
> variable arrancaba y luego perdía eventos en silencio. Era la misma trampa de D5 una capa más
> arriba. Ahora esa configuración falla de forma ruidosa en vez de aparentar que funciona.

**Opciones**:

1. **Llamada directa al `STORAGE_SERVICE` desde `UsersService`** (recomendada). Elimina la
   indirección, el canal y el contrato del evento para un único caso de uso. Un avatar
   huérfano es barato de aceptar de forma puntual; lo que no conviene es un canal de
   eventos roto y silencioso.
2. Implementar `redis.broker.ts` de verdad, si en el futuro hay trabajo asíncrono real
   (notificaciones, exports, ingesta) que justifique un broker durable.

→ **Paso 1.4** (rediseñado)


---

### D6 — ~~`forgot-password` resetea la contraseña y nunca entrega la nueva~~ **Resuelta**

> **Resuelta en tres commits.** El endpoint ya no destruye la cuenta: pide un link, no toca la
> contraseña, y el usuario elige la nueva. Verificado end-to-end contra el stack — pedir el
> link deja la contraseña actual funcionando, canjearlo cambia la contraseña, el link se
> gasta y un token inventado se rechaza. El `MailerService` ahora tiene transporte real
> (nodemailer) con `MAIL_TRANSPORT=smtp`.
>
> **Detalle de seguridad que quedó en el camino**: un envío fallido se captura y se loguea,
> nunca se propaga. Si una rotura de SMTP devolviera un estado distinto, contestaría
> diferente a direcciones registradas y a desconocidas, que es justo la enumeración que el
> mensaje neutro existe para evitar. Cubierto por un test.
>
> **Modo `log`**: en dev sigue escribiendo el link en el log, y ahora **avisa al arrancar**
> que no se está enviando nada. Es cómodo localmente y es un riesgo en cualquier otro
> entorno, así que lo dice en voz alta en vez de fingir que el correo salió. Para enviar de
> verdad: `MAIL_TRANSPORT=smtp` más `SMTP_*` en `.env`; la API se niega a arrancar con `smtp`
> incompleto.

<details><summary>Causa original (histórico)</summary>


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

**Arreglo original (superado por el link con token)**: implementar un mailer real. La
implementación elegida fue un link de un solo uso en lugar de mandar la contraseña por
correo, que es mala práctica.

</details>

### D7 — ~~`VITE_API_URL` es un build arg muerto~~ **Resuelta** (`1ddefa5`)

> El Dockerfile declaraba `ARG`/`ENV` para que Vite lo leyera. El aviso de build args no
> consumidos desapareció y la URL sale del build arg, no del fallback. Verificado en ambos
> sentidos: con la variable se compila en el bundle, sin ella el fallback sigue aplicando.

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

### ~~D8 — `api.health()` y `api.tokens()` son código muerto~~ **Resuelta** (`2a6739e`)

> **Sin paso asignado.** Es un borrado de ~40 líneas, sin dependents. → **Paso 4.6** (propuesto)

**Causa**: al añadir los schemas Zod (Paso 2.3) se contractuaron también `healthSchema` y
`apiTokenListSchema`, pero no hay ningún consumidor: `rg 'api\.(tokens|health)\(' src` no
devuelve nada. Son restos de un health check que se retiró.

**Resuelta** (`2a6739e`): fuera los dos métodos del cliente, `healthSchema`,
`apiTokenListSchema`, el `apiTokenSchema` del que se derivaba y el alias `TokensResponse`. Una
aserción de schema menos, de 10 a 9.

Lo que **no** se borró es el backend: `GET /health` lo usa el healthcheck del compose, y
`/auth/tokens` es una feature de máquina. Eso es D16, no D8.

### D10 — ~~Una migración aplicada en la BD nunca existió en el repo~~ **Resuelta** (`0955a80`)

> **Era la más grave del registro** y no estaba prevista. La tabla `migrations` de la base de
> desarrollo registra `AddSessionTracking1700000000000`, pero ese archivo no existe: ni en el
> árbol, ni en ningún commit (`git log --all -S` vacío). Las 4 columnas que creaba
> (`lastLoginAt`, `lastLoginBrowser`, `lastLoginOs`, `currentSessionId`) están en la entidad
> `User` y `synchronize: false`, así que nada más pudo crearlas.
>
> **Consecuencia**: una base construida desde las migraciones del repo saldría sin esas
> columnas y **todo login fallaría**. El esquema actual funciona solo porque esta base de
> datos concreta las tiene.
>
> Reconstruida desde la definición real con `IF NOT EXISTS`, y con nombre propio
> (`AddSessionTrackingColumns1893500000000`) porque el timestamp de la original
> (`1700000000000`) ordena **antes** de `InitialSchema` y fallaría donde no exista `users`.

### ~~D11 — 6 specs de integración fallaban~~ **Resuelta** (`2dd0b3e`)

**Causa raíz: no es una sola. Son cuatro problemas distintos**, diagnosticados el
2026-09-27 con los endpoints reales de la API:

| Specs | Síntoma | Causa real |
|---|---|---|
| `storms`, `dashboard`, `ingestion` (13 tests) | 401 | Los specs son **anteriores** al `JwtAuthGuard` global (Fase 0, `4875dd9`) y piden endpoints protegidos sin token. **El guard funciona bien; los tests quedaron atrás.** |
| `storm-history` (6 tests) | 404 | Piden `/history`, el controller es `@Controller('storm-history')`. El rename de Fase 0 (`e56e0fa`) no actualizó los specs. |
| `advisories` (5 tests) | 404 | Piden `storms/:id/advisories` (lista), que **no existe**: el controller solo expone `storms/:atcfId/advisories/:n` y `advisories/:id`. O falta el endpoint o el spec pergunta por una API que nunca hubo. |
| `warnings` (3 tests) | 404 | El spec prueba un endpoint dedicated `/advisories/:id/warnings` que **nunca existió** como tal: no hay `warnings.controller.ts`. **Los warnings sí se exponen**, embebidos en el detalle del advisory (`GET /storms/:id/advisories/:n`). El spec está rancio, no falta la feature. |

**Por qué importa**: la cobertura de integración es efectivamente cero, y con D1 aplazado
tampoco hay unitaria para `findOne` de storms y `getSummary` de dashboard.

**Corrección (2026-09-27)**: llegué a concluir que los warnings se persistían pero no se
podían leer por API, y lo presenté como un hueco de producto. **Era falso**: los warnings viajan
dentro del detalle del advisory y la card "Coastal warnings" los pintaba. Ese spec prueba una
ruta dedicada que no existió nunca; el feature funciona por otra vía. Lo que me faltaba era
mirar el consumidor antes de acusar al productor.

Lo que sí era cierto, y salió de mirar el frontend: el schema declaraba los warnings sin su
`geometry`, así que Zod la eliminaba en el borde y **los segmentos nunca se dibujaban en el
mapa**. Arreglado en `b3e0d6d` — de 10 a 12 paths en el overlay, verificado en el
desplegado. Ese sí era un bug de producto, y estaba escondido detrás de una feature que
parecía completa.

**Estado final**: `npm run test:integration` → **8/8 archivos, 37 tests, todos en verde.**
Partía de 8/8 fallando sin ejecutar una sola aserción.

**Cómo se cerró**: los 13 tests del guard registran una cuenta y mandan bearer por las rutas
reales de registro/login (no se desactivó el guard en el harness: se dejaría de probar la
postura de seguridad real); los 6 de storm-history usan `/storm-history`; los 2 de totales del
dashboard que fallaban **no eran un bug del backend, sino un spec que rechazaba una respuesta
correcta** tras los cambios por cuenca de `4e425ae`; y los 8 de advisories/warnings se
reescribieron contra la API que existe, sin inventar endpoints que nadie consume.

El spec de warnings ahora afirma que la **geometría** de los segmentos vuelve intacta. Antes
solo comprobaba la cantidad, y por eso no detectó que el schema del front la eliminaba.

**Causa**: ya no es DI ni esquema (eso se arregló). Ahora fallan con
`expected 200, got 401`, `expected 404, got 401`, `expected 400, got 404`. Son endpoints que
responden distinto de lo que el spec asume — posiblemente rutas inexistentes o specs escritos
contra otra versión de la API.

**Por qué importa**: la cobertura de integración es efectivamente cero. Con D1 además
aplazado, `findOne` de storms y `getSummary` de dashboard se quedan sin red de seguridad.

### ~~D12 — `generateTemporaryPassword` quedó sin uso~~ **Resuelta** (`b74b0ad`)

**Causa**: el flujo de token no genera contraseñas temporales. La función sigue en
`auth.utils.ts` y solo la consume su propio spec.

**Por qué no la borré**: borrarla exige borrar también sus tests, y con D1 aplazado reducir el
conteo de tests verdes (objetivo: 209/209) hace la meta más difícil de seguir. Es una decisión
tuya: borrarla, o dejarla como utilidad disponible.

### D16 — `/auth/tokens` existe en el API y no lo consume nadie

**Síntoma**: el backend expone `POST /auth/tokens`, `GET /auth/tokens` y `DELETE /auth/tokens/:id`
(`backend/src/domain/auth/auth.controller.ts`), con su `ApiToken` entity, su hash SHA-256 y su
servicio completo. No hay ningún consumidor: el frontend no tenía UI para ellos, y ningún spec los
menciona.

**Por qué NO lo borré al limpiar D8**: sin UI ni tests, la tentación es borrarlo como código
muerto. Pero un token de API es una feature *de máquina*: existe para clientes que no son el
navegador, y borrarla es una decisión de producto, no limpieza. Lo que sí era código muerto era
el lado del cliente, y eso sí se fue en `2a6739e`.

**Qué haría falta para cerrarla**: o una pantalla de gestión en Settings (crear, listar, revocar),
o tests de integración del recurso, o admitir que la feature no se quiere y retirarla del
backend. Las tres son decisiones tuyas.

### ~~D13 — Un `204` precede al `200` en los GET del dashboard~~ **Resuelta**: no era un bug
### ~~D13 — Un `204` precede al `200` en los GET del dashboard~~ **Resuelta**: no era un bug

**Observado** el 2026-09-27 al trazar la navegación con el panel de red de Chrome, no por
lectura de código. Cada petición de datos del dashboard aparece **dos veces**:

```
204 /users/me
200 /users/me
204 /dashboard/summary
200 /dashboard/summary
```

**Por qué está anotada y no resuelta**: un `204 No Content` en un `GET` con cuerpo esperado es
anómalo, y hay varias causas posibles con consecuencias muy distintas:

- Si es un **preflight CORS** mal contabilizado por el panel de red, es inocuo.
- Si es TanStack Query **deduplicando o reintentando**, el primer 204 podría estar enmascarando
  un fallo real que luego "se arregla" solo.
- Si el servidor responde 204 a propósito en alguna ruta, hay una discrepancia entre el
  contrato y lo que el cliente espera.

**Cómo se resolvió**: repetí la traza registrando el **método** de cada petición, que es lo que
faltaba, y el resultado fue:

```
OPTIONS 204 /auth/login          ← preflight CORS
POST    200 /auth/login          ← la petición real
GET     200 /dashboard/summary
OPTIONS 204 /dashboard/summary   ← preflight CORS
```

**Era el preflight, no un GET con 204.** Nunca hubo una respuesta 204 a un GET. Mi lectura
anterior contó las dos filas de una misma petición como si fueran dos respuestas.

**Por qué salta**: el cliente manda `Authorization: Bearer` (`frontend/src/api/client.ts:102`),
un header que no es "simple". Peticiones cruzadas de origen (el SPA en `:80`, la API en
`:3000`) con un header no simple exigen preflight, y el 204 sin cuerpo es la respuesta correcta
de `enableCors`. Con JWT es inevitable; no hay nada que arreglar.

**Lección**: al leer el panel de red hay que mirar el método de cada fila. El status por sí solo
no dice nada, y un 204 tiene dos lecturas muy distintas según quién lo devolvió.

### ~~D15 — La ingesta NHC corría duplicada~~ **Resuelta** (`64e9445`)

**Síntoma**: cadaCuenca se consultaba **dos veces** por intervalo de 10 minutos.

**Causa**: `main.ts` y `main.worker.ts` arrancan el mismo `AppModule`, que incluye
`IngestionModule` con su `@Cron('0 */10 * * * *')`. El scheduler no tenía guarda de rol, así
que el proceso con HTTP y el worker lo ejecutaban ambos. `IS_WORKER` ya no existía en el
código: solo lo usaba el consumer de D5, que se eliminó.

**Por qué importa más de lo que parece**: los escrituras son idempotentes, así que no había
corrupción. Pero el propósito declarado del worker (`main.worker.ts`: "para que el polling
siga vivo aunque el contenedor del API se reinicie") quedaba anulado, porque el API hacía el
polling equally. No era solo tráfico duplicado: era el worker justificado en falso.

**Cómo se cerró**: guarda `IS_WORKER !== 'true'` en el handler, con tres tests de rol.

> **Aprendizaje sobre el proceso**: al añadir el spec del scheduler lo escribí encima del
> archivo que ya existía, sin leerlo, y perdí 11 tests. Lo detectó el conteo (184 esperados
> contra 173 obtained), no el build ni los tipos. Los tests se restauraron y el `beforeEach`
> compartido ahora fija `IS_WORKER='true'`, para que las aserciones del handler no puedan pasar
> contra una ejecución saltada por la guarda.

### D9 — Precaución, no deuda: `manualChunks` compila verde y mata la app al cargar

> **Clasificación: no es deuda.** No hay ningún bug activo. Se registra aparte porque,
> junto a la que fue D10 (una migración aplicada en la BD pero ausente del repo), es de la
> clase de cosas que el build no detecta y que conviene no perder al reordenar este
> documento.

Es una disarmadiza para quien retoque `vite.config.ts`.

Separar `@rc-component` de `antd` en chunks distintos **compila limpio** y rompe la
aplicación en runtime con `ReferenceError: Cannot access 'bi' before initialization`: los
componentes de rc se referencian entre sí y con el contexto de antd de forma cíclica, y al
repartirlos Rollup pierde el orden de inicialización.

**Por qué importa**: `npm run build` da 0 errores en el caso que rompe la app. Solo se
detecta navigating en un navegador. Si alguien "optimiza" el chunk de antd para bajar de
600 kB, va a tener un build verde y una app en blanco.

**Mitigación aplicada**: el motivo está escrito en `vite.config.ts` junto al
`chunkSizeWarningLimit`. Si alguien lo sube o lo cambia, que lea ese comentario antes.

## Fase 1 — Compose: mejoras de mantenibilidad (sin cambiar comportamiento)

### Paso 1.1 — ✅ Ejecutado — YAML anchors para variables S3 compartidas

Extraer el bloque STORAGE_* repetido en `backend-api` y `backend-worker` a un anchor `x-common-storage: &common-storage` y aplicarlo con `<<: *common-storage`. Sin cambios de comportamiento: mismo resultado, menos duplicidad.

**Explicación**: YAML anchors + merge keys (`<<`) permiten definir un bloque una vez y reutilizarlo. Compose los soporta (extensión de YAML), y evitan que un valor cambie en un servicio y no en el otro (drift).

### Paso 1.2 — ✅ Ejecutado — Mover credenciales S3 a `.env` (con defaults `any`)

Quitar `STORAGE_ACCESS_KEY: any` / `STORAGE_SECRET_KEY: any` hardcodeados y leerlos de `.env` con fallback `any` solo en dev. Actualizar `.env.example`.

**Explicación**: "any" es específico de SeaweedFS. Hardcodearlo en el compose lo viajaría a otros entornos. Con defaults en `.env` el compose queda agnóstico al proveedor de storage (facilita migrar a AWS/LocalStack después).

### Paso 1.3 — ✅ Ejecutado — Redes dedicadas `core` / `edge`

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

### Paso 3.1 — ⬜ Pendiente — Auditoría de accesibilidad (a11y)

Revisar con axe-core (dev) y Lighthouse: roles/aria en elementos interactivos, navegación por teclado, foco visible, labels en formularios, contraste, landmarks, `alt` en imágenes, live regions para errores. Corregir hallazgos y documentar.

Herramientas: axe DevTools / `@axe-core/react`, Lighthouse, plugins de teclado.

**Explicación**: a11y no es "extra", es usabilidad para todos (teclado, lectores de pantalla, contraste). Se automatiza con axe/Lighthouse y se corrige con foco visible, roles correctos y teclado operable.

### Paso 3.2 — ⬜ Pendiente — Auditoría de Web Vitals

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

### Paso 4.1 — ⬜ Pendiente — Backend: unificar `history` / `storm-history` / `weather/storms`

Hoy conviven tres carpetas. `StormHistoryController` sigue montado en `/storm-history`.
Decidir: ¿`storm-history` es el nombre definitivo (se renombra a `weather/storm-history` o similar),
o se elimina y se sirve desde `weather/storms`? Luego borrar código muerto y sus rutas.

**Explicación**: código duplicado no es "código gratis". Cada copia se mantiene, se rompe y se
depurga por separado. El nombre debe reflejar el dominio (`weather/storm-history`), no el concepto
transversal ("history"), porque `history` no es un dominio de negocio aquí: lo es el historial de tormentas.

### Paso 4.2 — ⬜ Pendiente (parcial) — Frontend: eliminar duplicados

- `helpers/*` duplica `domain/*` → dejar solo `domain/*` (un nombre, un lugar) y actualizar imports.
  **Pendiente**: `helpers/{format-time,geo,storms}` sigue existiendo junto a `domain/`.
- ~~`global_components/StormCard|StormList` duplica `features/weather/components/dashboard/`.~~
  **Resuelto en el Paso 2.4**: ambos se movieron a `features/weather/storms/components/`.
  Ojo: la ruta real era `features/weather/dashboard/`, no `components/dashboard/`.
- ~~`PageFallBack/` vs `PageFAllBack/` (typo).~~ **Resuelto antes de la Fase 0**: hoy solo
  existe `src/global_components/PageFallBack/`. Se había anotado una variante que ya no está.
- ~~`pages/protected/*` vs `features/weather/pages/*`.~~ **No existía esa segunda carpeta**:
  `features/weather/` tiene `advisory/`, `dashboard/` y `storms/`, sin `pages/`. La
  duplicación era real pero en el sentido inverso al anotado: lo que hay son páginas en
  `pages/protected/` que importan de las features, no dos carpetas de páginas. **Pendiente**:
  decidir si `pages/` es solo un barrel o si las páginas se mudan a `features/`.

**Explicación**: "una responsabilidad, un lugar". Cuando el mismo componente existe en dos carpetas,
cualquiera puede quedar desactualizada y el bug aparece en una sola de ellas. El Imports de una
carpeta duplicada también confunde: no se sabe cuál es la fuente de verdad.

### Paso 4.3 — ⬜ Pendiente — Propagar las mejoras de Fase 2 al código ya movido

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

> 4.4 está **aplazada por decisión del usuario** (2026-09-26). No se ejecuta hasta que se
> diga lo contrario.

### Pasos 4.5–4.8 — Propuestos, sin tu visto bueno

No forman parte del plan original. Surgieron al ejecutar las Fases 1 y 2 y están en el
registro de deuda sin un paso que los cubra, así que se proponen aquí para que la relación
deuda → arreglo exista. **Ninguno está aprobado.**

| Paso | Cierra | Qué implica | Nota |
|---|---|---|---|
| ~~4.5~~ | ~~D5~~ | **Cerrada**: `UsersService` → `STORAGE_SERVICE` directo, consumer eliminado | Ya no queda nada |
| 4.6 | D8 | Borrar `api.health()` y `api.tokens()` con sus schemas | Solo borrado, sin riesgo |
| ~~4.7~~ | ~~D6~~ | **Cerrada**: link de un solo uso + `MAIL_TRANSPORT=smtp` con nodemailer | Ya no queda nada por decidir aquí |

**4.8 (D7) queda cerrado** y por eso ya no figura como propuesto: se resolvió en `1ddefa5`
con un `ARG`/`ENV` en el `Dockerfile`.

---

## Fase 5 — Administración operable y costuras de despliegue

> Creada el 2026-09-27 a partir de dos preguntas: *"¿qué puede hacer un admin con lo que ya
> existe?"* y *"¿qué servicios se pueden separar sin problemas?"*. Son **dos vías
> independientes**: nada de la vía A bloquea a la B, y viceversa. La razón es que el trabajo de
> arquitectura no debe impedir el trabajo que da valor.

### La vía A — lo que un admin puede hacer hoy

**Lo que ya existe y es alcanzable**: `POST /admin/ingest/run` dispara la ingesta de todas las
cuencas o de una, y devuelve un reporte (tormentas vistas e insertadas, advisories nuevos y
omitidos, puntos escritos, geometrías y segmentos de aviso, errores no fatales). Eso es
**información de operaciones real**, y es la única que hay.

**El bucle roto**: `/admin/ingest` está protegido por `ApiKeyGuard` + `@Roles('admin')`, así que
sin un API token devuelve 401. El token se crea con `POST /auth/tokens` usando un JWT… que la
app no tiene forma de emitir. Para usar el endpoint admin del propio proyecto hay que llamar a
la API a mano.

**Y dos cosas que no existen**, listadas aquí para que la decisión sea explícita, no un olvido:

| Falta | Qué daría |
|---|---|
| **Historial de ingesta** | Hoy el scheduler solo loguea. No hay forma de saber qué se procesó ni cuándo, salvo leer el log del contenedor. |
| **Gestión de usuarios** | Solo existe `GET /users/me`. No hay listar usuarios, promover a admin ni desactivar. `ADMIN_EMAILS` es una variable de entorno. |

### La vía B — qué se puede separar, y qué no

Grafo de dependencias **en runtime** (imports de valor, sin tests), medido sobre el código:

```
auth       → users
users      → auth, storage
dashboard  → cache, weather
weather    → cache
feeds      → auth, cache, weather
storage    → (nadie)
cache      → (nadie)
```

**Es un DAG, no un ciclo.** El `weather → feeds` que parecía existir es un `import type`
(`ForecastPointDto`), que desaparece al compilar, y un import dentro de un
`integration-spec.ts`. En producción **no existe**. Eso abre la costura de la ingesta.

#### Las costuras (ahora en la Fase 6)

El detalle, el orden y el razonamiento están en la **Fase 6**, que telemetría y corte van juntos a
propósito. En resumen:

| Se puede separar | Por qué |
|---|---|
| `storage` (190 líneas) | Hoja del grafo: **no importa a nadie**. Habla S3 y ya |
| `cache` (93 líneas) | Hoja del grafo, sin dependencias. Ojo: hoy es `@Global` |
| `feeds` (1.896 líneas) | Perfil distinto y ya corre en proceso propio desde D15. Requiere quitarle sus dependencias de salida |

#### NO se separan

- **`auth` + `users` como servicio de identidad (estilo Kerberos).** Hay ciclo real
  `auth ↔ users`, y cada request validaría el JWT contra ese servicio: una llamada de red por
  request, o clave compartida — que para entonces ya no es un servicio de auth, es un emisor de
  tokens. Con 7.323 líneas de backend no se justifica.
- **`dashboard` en solitario.** Solo lee `weather` y `cache`; sin ingesta no tiene nada propio.

**Por qué no partir más**: microservicios sobre base de datos compartida no son microservicios,
son un monolito distribuido — despliegue distribuido **más** acoplamiento por tablas, y una
transacción distribuida que hoy no hace falta.

### Los pasos, en orden de ejecución

| # | Paso | Vía | Riesgo | Verificación |
|---|---|---|---|---|
| **A1** | Swagger utilizable: `addBearerAuth()` + `addApiKey()`, y corregir el decorador de `forgot-password` que describe el flujo borrado | A | Bajo | `Authorize` funciona para ambos esquemas; `/docs-json` ya no menciona "temporary password" |
| **A2** | UI de API tokens **solo para admins** en Settings: listar, crear (valor mostrado una vez), revocar | A | Bajo | El card no aparece para `client`; crear un token lo hace usable en `/admin/ingest` |
| **A3** | Decidir el historial de ingesta | A | — | Decisión de producto, no código |
| **A4** | Decidir la gestión de usuarios | A | — | Decisión de producto, con riesgo de seguridad si se hace mal |
| **B1** | Extraer `storage` | B | Bajo | Es hoja: no toca ningún import ajeno. Regresión en avatares |
| **B2** | Extraer `cache` | B | Bajo | Ídem. Cuidado: hoy es `@Global`, hay que preservar ese comportamiento |
| **B3** | `feeds` sin dependencias de salida | B | **Medio** | El grafo queda en `feeds → {}`. Ingesta y lectura siguen dando los mismos datos |

**Por qué este orden.** A1 va primero porque es lo más barato y arregla algo que hoy **miente**:
el Swagger publica que la respuesta incluye la contraseña temporal, y eso ya no existe. A2 cierra
el bucle de la credencial y es la opción que elegiste. B1 y B2 son hojas del grafo, así que son
mecánicos y no bloquean nada. B3 va al final porque es el único con riesgo real y porque su
beneficio (aislar fallos de ingesta y escalar por separado) no urge mientras NOAA sea la única
fuente.

**Fuera de alcance de la Fase 5**: partir `auth`/`users` en servicios de red, partir
`dashboard`, y cualquier esquema de base de datos compartida. Ver *"NO se separan"* arriba.

**Cierra además**: **D16** (lo resuelve A2). **D4** queda con su punto de linter abierto, que no
requiere decisión.

---

## Fase 6 — Telemetría primero, y luego el corte de servicios

> **Por qué este orden y no el contrario**: partir un monolito sin poder observarlo es hacerlo a
> ciegas. Si `storage` pasa a ser un servicio y algo se degrada, sin trazas ni métricas no hay
> manera de saber si fue el corte o la Extract-the-code. Así que primero se mide, y **cada corte
> se verifica con la telemetría que acaba de existir**.

### Arquitectura objetivo

Cuatro servicios, con el collector midiendo todos:

```
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │   storage    │  │    cache     │  │    feeds     │  │    other     │
  │  avatares    │  │  redis/ttl   │  │  ingesta NOAA│  │  auth,users, │
  │  (S3)        │  │              │  │              │  │  dashboard,  │
  │              │  │              │  │              │  │  weather     │
  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
         └────────────────┴─────────────────┴──────────────────┘
                                    │  todos hablan OTLP
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
         navegador                backend          collector
          (6.2)              (y sus servicios)      ┌────▼─────┐
              traces ───────────────┼────────────── métricas
                    ▼               │              ▼
                 Jaeger      Loki (6.5)      Prometheus ──▶ Grafana
```

**El matiz que decide el coste**: "separar en servicios" admite dos lecturas, y no son lo mismo.

| | Qué es | Coste | Reversible |
|---|---|---|---|
| **Deployables separados** | 4 procesos/contenedores, **base de datos compartida**, cada uno dueño de sus tablas | Bajo. Es lo que se propone aquí | Sí, son 4 `CMD` y 4 `depends_on` |
| **Servicios de red con DB propia** | Cada uno con su esquema, y **`feeds` hablando con `other` por API o eventos** | Alto. Requiere rediseñar `feeds → weather` y sacar transacciones fuera | No |

Se va por la primera. La telemetría da lo mismo en los dos casos — un `service.name` por servicio
— así que **nada se pierde por empezar aquí**, y la parte cara queda como evolución posterior,
no como requisito previo.

### 6.1 — Telemetría: la base de todo lo demás

| # | Paso | Riesgo |
|---|---|---|
| **6.1.1** | Deps OTel en el backend: `sdk-node`, `auto-instrumentations-node`, exportadores OTLP, `sdk-metrics`, y `nestjs-pino` | Bajo |
| **6.1.2** | `src/instrumentation.ts` cargado con `node --import` **antes** de la app. Si se carga después no instrumenta nada, **y no hay error que lo indique** | Bajo |
| **6.1.3** | `start:prod` **y** `start:worker`. El worker es quien golpea NOAA: ahí está la traza interesante | Bajo |
| **6.1.4** | `service.name` por proceso. **Preparado ya para los 4 servicios futuros**, no se cambia después | Bajo |
| **6.1.5** | Logs JSON con `nestjs-pino` vía `app.useLogger()`: `timestamp` en UTC, `level`, `service`, `context`, `msg`, `trace_id`, `span_id`. Sube aquí y no a 6.4, porque **al cortar servicios es la forma de saber quién hizo qué** | Bajo |
| **6.1.6** | `otel-collector` en `docker-compose.yml`, red `core` (**nunca `edge`**) | Bajo |
| **6.1.7** | Receivers: **`otlp`** (app) + **`host_metrics`** (infra: CPU, memoria, disco, red del host) + **`docker_stats`** (infra: por contenedor) | Medio |
| **6.1.8** | Exporters: `otlp` → Jaeger, y `prometheus` exponiendo `/metrics` (Prometheus es pull-based, no acepta push) | Bajo |
| **6.1.9** | `jaeger`, `prometheus`, `grafana` con datasources precargados | Bajo |

**Sobre `docker_stats`**: el socket de podman está activo y es Docker-compatible
(`/run/user/1000/podman/podman.sock`, API 5.8.7), así que el receiver puede leer CPU y memoria
**por contenedor** — que es lo que permite comprobar que un corte no movió el perfil de recursos.
**Advertencia**: montar ese socket en un contenedor le da control del host, equivalente a root.
Aceptable en dev; en un entorno compartido, no.

**Sampling**: se hace **tail sampling**, no head. El SDK envía el 100 % y decide el collector
cuando ya sabe si la petición acabó en error: así los errores se conservan **siempre** y el
corte se aplica solo a los éxitos.

Medido con 50 trazas sintéticas (`service.name: synthetic-sampling`): **10/10 de error (100 %)
y 7/40 de éxito (17 %)** con `sampling_percentage: 20`.

Dos detalles que costaron una vuelta de tuerca:

- Los valores válidos del `status_code` policy son `OK`, `ERROR` y `UNSET`. Poner
  `STATUS_CODE_UNSET` (que es como lo llama el SDK) **tumba el collector entero** al arrancar:
  un processor mal configurado es un pipeline que no arranca, no una política que se ignora.
- El head sampling del SDK se queda en 1 a propósito. Si se baja ahí, el error ya se perdió
  antes de que el collector llegue a opinar.

**Errores**: un `TraceErrorInterceptor` global marca el span de Nest como `ERROR` y registra la
excepción. Sin él, un 500 de TypeORM sale con status `UNSET` y el muestreo lo tira. Aporta además
`http.route` y `http.request.method`, que es lo que hace que un error sea **buscable** en
Jaeger sin abrir cada traza.

**Cardinalidad**: los labels de métrica **no** llevan `userId`, `atcfId` ni `email`. Es la causa
número uno de que Prometheus se coma la memoria; eso va en **trazas** y **logs**, que no tienen
ese límite.

### 6.2 — Telemetría del frontend (navegador)

**Sí, y vale la pena por dos razones que no se obtienen de ninguna otra forma:**

1. **Correlación de punta a punta.** Sin esto, una traza empieza en el request que entra al API.
   No hay forma de ir de "el usuario vio esto" a "el backend hizo aquello". Con el SDK web, la
   traza nace en el click y continúa en el servidor.
2. **Core Web Vitals reales (RUM).** LCP, INP y CLS **de usuarios de verdad**. La Fase 3 pide
   Web Vitals, y un dato de laboratorio no es un dato de RUM: se mide en condiciones que no se
   pueden replicar en local.

**Lo que sale casi gratis**, porque el frontend ya tiene el punto de enganche:

- `request()` en `src/api/client.ts:48` es el **único** punto de salida de HTTP. Un span ahí
  cubre todas las llamadas, sin tocar los 20 métodos de `api`.
- Ya existen `ErrorBoundary` y `RouteErrorBoundary`: engancharlos da los errores no controlados
  con la ruta y el usuario como contexto.

**Lo que NO se hace**: `auto-instrumentations-web` al completo. Para una SPA añade instrumentación
de XHR/fetch que el punto único ya cubre, y mucho ruido. El scope correcto es explícito:
spans en navegación de ruta y en la llamada HTTP, captura de errores, y web-vitals como spans.

**El precio, y es real**: el navegador tiene que alcanzar al collector, y **6.1.6 dice que la
telemetría nunca va en la red `edge`**. Eso es correcto para el backend y falso para el
navegador. Hay que romper la regla a propósito, de una de estas dos:

| Opción | Cómo | Alcance |
|---|---|---|
| **Puerto en loopback** (recomendada en dev) | El collector publica `4318` en `127.0.0.1` y el front manda a `http://localhost:4318` | Solo para navegadores en la misma máquina. Es el caso de desarrollo |
| **Collector en `edge`** | El collector se une a `edge` | Funciona para usuarios remotos, pero expone un endpoint de ingestion a internet: necesita CORS restringido a los orígenes del front y rate limiting |

Se elige una, **explícitamente**, porque la regla de aislamiento de 6.1.6 se relaja a
conciencia. El endpoint del collector es de escritura de telemetría, no de negocio, así que no
expone datos, pero sí acepta carga de cualquiera que lo alcance.

La URL del collector se compila con el mismo mecanismo que `VITE_API_URL` (que 1ddefa5 dejó de
ser un build arg muerto): una variable `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` en el build del front.

**Cuándo**: después de 6.1, porque sin collector no hay a dónde enviar. Puede ir antes o
después de los cortes de servicios sin afectar a los demás, ya que no toca el backend.

### 6.3 — Cortar `storage` (190 líneas) — **hecho**

Primer corte porque **no importa a nadie**: separarlo no toca un solo import ajeno. Y así fue,
`users.service.ts` no cambió de imports en absoluto.

**El contrato bajó de 4 métodos a 3.** `getUrl` salió porque nadie fuera de la propia
implementación lo usaba, y `extractKey` pasó a ser asíncrono: es una llamada de red ahora, y
mantenerlo síncrono obligaría a los llamantes a duplicar localmente el formato de la URL pública,
que es justo lo que se quería evitar al mover el servicio.

**Lo que se consiguió de verdad**, medido sobre los contenedores en marcha, no sobre el YAML:
`riskio_backend-api` tiene **0** variables `STORAGE_ACCESS_KEY`/`SECRET_KEY` y
`riskio_backend-storage` tiene las 2. La API ya no puede leer ni escribir el bucket ni aunque la
comprometan; su peor caso es hablar con tres endpoints HTTP en la red interna. El bucket, la
política y el formato de la URL viven en un contenedor que no tiene datos de usuarios.

Decisiones que quedaron tomadas y conviene no re-litigar:

- **Bytes en base64 dentro de JSON**, no multipart. Los avatares son pequeños y un segundo
  content type con su parser de streaming cuesta más que el 33 % de sobrecarga. Si algún día
  esto lleva ficheros grandes, la respuesta es multipart.
- **Sin CORS, sin Swagger, sin `ValidationPipe`.** Nada en un navegador habla con este servicio.
  `ValidationPipe` con `whitelist: true` sobre un `interface` en vez de un DTO borraría todos los
  campos y rechazaría todas las subidas, así que el controller valida a mano.
- **El health check habla con el bucket.** Un probe que solo mira el proceso daría por bueno un
  servicio que acepta subidas que luego no puede guardar. Por eso se sustituyó el `ping()` que
  se tragaba los errores.
- **Una sola instancia de S3**: la clase se registra y se aliasea al token con `useExisting`.
  Registrarla dos veces habría creado dos clientes S3.
- **Una imagen, tres entrypoints** vía `command`, como ya hacía el worker.

**Verificado de extremo a extremo**: alta de avatar 201, URL pública sirviendo el fichero
(`200`, `image/png`, 69 bytes), borrado de la cuenta 204 y el objeto dando 404 después. El
servicio nuevo registra las tres llamadas con sus códigos. Y en Jaeger, una sola traza contiene
`riskio-api` **y** `riskio-storage` con el handler `POST /files` al otro lado: el salto es
transparente para la telemetría porque la auto-instrumentación de `fetch` inyecta el
`traceparent` solo.

**Trampa a tener presente**: la API tiene `env_file: .env` y hoy `.env` no trae nada de
`STORAGE_*`, así que la separación se sostiene. Si alguien las añade ahí, entran también en la
API y la extracción se deshace **sin que nada falle ni avise**. La separación real está en el
compose, con dos anchors distintos a propósito.

### 6.4 — Cortar `cache` (93 líneas) — **hecho**

Segundo, también hoja. `AppCacheModule` sigue siendo `@Global()` y sigue registrado en
`AppModule`, como avisa el plan: quitar el decorador parecería funcionar hasta que el primer
módulo que no lo importara dejara de resolver. Los tres consumidores (dashboard, storms,
ingestion) siguen llamando a `getOrSet` e `invalidate` sin cambios de comportamiento.

**El contrato se parte en dos** porque hay dos lados con necesidades distintas. `CacheStore` es
el contrato de cable: `get`/`set`/`del`/`invalidate`, sin read-through. El contrato anterior
tenía `getOrSet(key, ttl, fn)`, y un loader es **código**: solo puede ejecutarse en el proceso
de quien llama. Una caché detrás de un salto de red es dueña del almacenamiento, no de la
política. `CacheService` es lo que ve el resto de la aplicación: las cuatro operaciones más
`getOrSet`, que sigue siendo local.

Separarlas es lo que mantiene testeable a los llamantes: dependen de una interfaz, así que un
test puede pasar un objeto plano, cosa imposible con una clase con campos privados. Ese error
lo cometí primero y lo corregí.

**Todo falla abierto, y eso es la decisión de diseño de la extracción.** Antes, un fallo de
Redis hacía que `get` rechazara, `getOrSet` no llegara a su loader, y la petición fallara por
datos que estaban en la base de datos todo el rato. Ahora cada llamada captura, avisa **una vez**
y devuelve "no hay nada cacheado".

**Y falla abierto de verdad, no solo en el papel.** Medido con el servicio parado: la primera
petición pagaba el timeout y las siguientes también, 4 s cada una, porque un acierto son dos
llamadas secuenciales (get y set) y cada una esperaba su timeout. Es decir, la degradación era
**8× más lenta que la ruta sin caché**, que es justo lo contrario de lo que se quería. Se
añadió un enfriamiento: tras un fallo se saltan las llamadas durante 10 s y el llamante va
directo a su loader. Medido después: 1,57 s la primera y ~0,5 s las siguientes, que es el coste
real de la consulta sin caché.

**Redis también quedó aislado**: solo `backend-cache` tiene `REDIS_URL`, comprobado sobre los
contenedores en marcha.

#### Un bug de fondo que salió por el camino

La invalidación por patrón **nunca funcionó**. No al extraerla: ya estaba roto, y en silencio.

`CacheService.invalidate` llamaba a `store.iterator(pattern)` sobre el adaptador de
cache-manager, que **acepta el patrón y no devuelve nada**. Cero claves, cero borrados, ningún
error, ningún log. `ingestion.service.ts` llama a `invalidate('dashboard:*')` e
`invalidate('storms:*')` después de cada ejecución, y no estaba limpiando nada: las claves
vencidas se quedaban hasta su TTL.

Las dos formas "naturales" de escribir este método fallan, en direcciones opuestas y las dos en
silencio:

| Cómo | Resultado |
|---|---|
| `store.iterator(patrón)` (el código viejo) | No borra nada y parece funcionar |
| `kv.iterator(patrón)` en la instancia | **Borra todas las claves** de la caché |

La segunda la escribí yo al principio, creyendo que el parámetro filtraba. Lo detecté porque
`invalidate('storms:*')` devolvió `deleted: 4` cuando solo 2 claves cumplían el patrón. El
filtro de `Keyv.iterator` es decorativo.

Por eso el glob se casa **aquí**, a mano, y el fake del spec está modelado para comportarse como
el Keyv real — que es ignorar el patrón. Un fake que filtrara habría dado el test en verde
mientras la invalidación real vaciaba la caché entera en cada ejecución de ingesta.

Dos errores más de la misma familia, ambos por escribir una interfaz a memoria en vez de leer
el objeto real: `del` no existe en Keyv (es `delete`) y el iterador no está donde se busca.
Compilan sin quejarse y fallan en runtime. El spec los cubre con un fake que no tiene `del`.

### 6.5 — Logs → Loki

`loki` con retención definida y datasource en Grafana. El collector admite las dos formas de
llevar los logs, así que este paso no bloquea a los anteriores:

| Opción | A favor / en contra |
|---|---|
| **OTLP nativo** (app → collector → `/otlp` de Loki) | Sin agente y correlación limpia. El puente pino→OTLP es la pieza menos estandarizada |
| **`filelog` en el collector** | Traditional, pero necesita acceso al store de podman |

Elegida **OTLP nativo**, y con un matiz importante: un stream en el mismo proceso, no un
`transport` de pino. Un transport corre en un worker thread sin contexto OTel, así que la
correlación con la traza —que es justo lo que se vino a buscar— se pierde. El stream
reconstruye el contexto a partir del `trace_id` que el `mixin` ya escribe en la línea.

Estado: funcionando. 2 streams, 4 labels indexados (`service_name`, `level`, `severity_text`,
`deployment_environment_name`) y el resto structured metadata, con
`{service_name="riskio-api"} | trace_id="..."`localizando la línea exacta.

**Cuidado al medir esto.** `query_range` devuelve la structured metadata *fundida dentro* del
campo `stream` de la respuesta, igual que si fueran labels. Contando etiquetas ahí parece que
hay 27 labels y un stream por línea de log, y no es ninguna de las dos cosas: son 2 streams.
Las etiquetas indexadas de verdad se ven en `/loki/api/v1/series` y `/loki/api/v1/labels`. No
hace falta tocar `otlp_config`: los defaults de Loki ya hacen lo correcto, y probarlo cuesta
un ciclo de reinicio por cada versión.

**Lo que sí había, y era un agujero de verdad**: la instrumentación automática de pino
adjuntaba la request entera a cada línea, cabeceras incluida, así que el
`Authorization: Bearer <jwt>` llegaba a Loki. Se cierra en tres capas, y las tres importan:
la app solo envía una lista blanca de campos, el collector borra `authorization` y `cookie`
en un processor `attributes/sanitize`, y Loki no los indexa. La del collector es la que
aguanta si alguien cambia las otras dos sin saber qué había en juego.

**Matiz al navegar**: los logs se guardan siempre, pero el tail sampling descarta ~80 % de las
trazas de éxito. Saltar de una línea a su traza fallará en la mayoría de los éxitos y
funcionará siempre en los errores. Es el patrón que recomienda OpenTelemetry: correlación y
muestreo son cosas separadas, `trace_id` es el vínculo, y no se pretende que Loki y Jaeger
tengan la misma cobertura.

**El umbral de latencia depende de `cache`, y 6.4 lo invalida.** La política de `slow` (250 ms)
no mide peticiones lentas, mide **fallos de caché**: `/dashboard/summary` tarda ~470 ms en
frío y 2-4 ms con acierto, porque `dashboard.service.ts` la envuelve en `getOrSet` con 30 s de
TTL. Hoy eso es justo lo útil — una traza con caché no enseña la consulta y no dice nada del
trabajo real. Al cortar la caché en 6.4, todas las peticiones harán la consulta de verdad, todas
pasarán 250 ms, y esa ruta dejará de muestrearse en silencio. Hay que revisar el umbral en el
mismo cambio que quita la caché, con un percentil real y no con este número.

### 6.6 — `feeds` como servicio propio

El único con trabajo real. Requiere, en este orden:

1. Mover `ForecastPointDto` al lado de quien lo usa (hoy `weather` lo importa de `feeds`, y es
   **solo un tipo**). — **hecho**
2. Que la ingesta **escriba sus propias filas** en vez de llamar a `StormsService` y
   `AdvisoriesService`. — **hecho**
3. Que deje de importar `auth`. — **hecho**: el `auth` se queda en la API, con el controller del
   disparo manual, y el servicio de feeds no lo importa.

### 6.6 — `feeds` como servicio propio — **hecho**

`riskio-feeds`, cuarto servicio propio. Es el único proceso que lee NOAA y escribe tormentas,
advisories, forecast points y warnings. El cron vive aquí, y con él desaparece `backend-worker`:
`IS_WORKER` solo lo usaba el scheduler, así que aquel contenedor existía únicamente para que el
cron sobreviviera a un reinicio de la API. Ahora el scheduler está junto a la ingesta que
dispara, y la compuerta habría sido solo una forma de parar la ingesta por accidente.

**El disparo manual se queda en la API.** `auth`, los guards de api-key y de rol, y las
anotaciones de Swagger viven allí; mover el controller habría significado mover o duplicar todo
eso. La API llama a `feeds-service` por HTTP, igual que hace con storage y cache. Por eso `feeds`
ya no importa `auth`: era el último requisito del plan.

La **base de datos sigue siendo compartida**, tal y como dice el plan: la API lee esas mismas
tablas porque responde preguntas sobre tormentas, y un esquema por servicio está explícitamente
fuera de alcance. Lo que cambia es quién **escribe**, y ahora es un solo proceso.

El `FeedsClientService` **no falla abierto**, al contrario que el cliente de caché. Un disparo
manual que reportase éxito sin haber insertado nada es exactamente el fallo que la herramienta de
fixtures existe para hacer visible, así que el error sube al llamante.

**Lo que costó de verdad**, y que no era código: el override `compose.dev-ingest.yml` apuntaba
`NHC_BASE_URL` solo a `backend-api`. Tras mover la ingesta, la API deja de tocar ningún feed, así
que las primeras ejecuciones **`tenían éxito contra el NOAA de verdad y no probaban nada** — sin
error, sin aviso. El aviso fue ver `advisoriesInserted: 0` con 11 puntos escritos, o sea datos
reales. El override ahora cubre también a `backend-feeds`, y a propósito también a la API, para
que si los fixtures desaparecen el disparo falle en voz alta en vez de salirse con NOAA.

Verificado: dos rondas seguidas con la herramienta de fixtures, `advisoriesInserted: 1` en las
dos, a través del salto API → HTTP → feeds. Cuatro trazas en Jaeger contienen `riskio-api` **y**
`riskio-feeds`. 246/246 unitarias, 31/31 integración, `tsc` limpio.

#### Herramienta de ingesta de desarrollo (`npm run dev:fixtures`)

El plan daba por hecho que un disparo manual servía para probar. **No sirve**, y por eso está
built antes de la extracción y no después: si el feed no ha cambiado, la ingesta reporta
`advisoriesInserted: 0`, no invalida nada porque no se ha escrito nada, y la ejecución *parece*
haber funcionado sin haber ejercitado nada del camino de escritura.

La herramienta renderiza los fixtures con el **número de advisory variable**, porque un advisory
es único por `(tormenta, advisoryNumber)` y un número nuevo es una fila realmente nueva. Se
pueden encadenar las ejecuciones sin tocar la base entre medias.

Dos decisiones, y las dos salieron de leer el código en vez de suponer:

- **Solo se plantilla lo que la ingesta lee.** El número sale del **título del item TCM**
  (`extractAdvisoryNumber` = `/Number\s+(\d+)/i`) y nada más. Los catorce "Number 2" que hay
  entre enlaces y cabeceras WMO son decoración: templatearlos todos habría sido más minucioso y
  más frágil, sin cambiar una sola fila escrita.
- **Los tiempos de la trayectoria se quedan como están.** Moverlos exigiría manejar cinco formatos
  de fecha distintos por sustitución de texto, que es la clase de sustitución que funciona a
  medias sin avisar. El advisory queda fechado "ahora" con una trayectoria de su día original,
  que se lee raro y no daña nada: nada valida la coherencia entre ambos.

Dos fallos que aparecieron al probarla de verdad, no al escribirla:

- El contador vivía en un fichero y arrancaba en 3. Los advisories 4 y 5 **ya existían** de
  datos reales, así que la segunda y tercera ejecución reportaban cero inserciones. El caso es
  peor que un fallo: no es que_insertara de más, es que se saltaba en silencio. Ahora **consulta
  la base** y arranca por encima del máximo existente, con `pg`, que ya era dependencia.
- `.dev-fixtures` se horneó **dentro de la imagen** porque `.dockerignore` no lo excluía, y el
  contador se congelaba en el valor del último build. Excluido, y con volumen para que sobreviva
  a los reinicios.

Y los casos edge que casi se caen: base vacía (normal en la primera ejecución, no un problema),
base inaccesible (avisa, porque un contador ciego puede chocar), y **`state.json` a medias**, que
hacía `JSON.parse` y tumbaba el script entero. 12 tests en `scripts/dev-fixtures.spec.ts`.

`deploy/compose.dev-ingest.yml` es un override aparte a propósito. `NHC_BASE_URL` es una variable
de entorno cualquiera: un despliegue que la apuntara a unos fixtures seguiría reportando ingestas
exitosas sin leer nada de NOAA. Que llegar a los fixtures exija nombrar ese fichero, y que
`docker-compose.yml` no los mencione, es lo que lo cierra.

Verificado: tres rondas seguidas, `advisoriesInserted: 1` en las tres.

**El worker no se retira todavía.** `IS_WORKER` solo lo usa el scheduler, así que quitar el worker
antes de que `feeds-service` traiga el cron dejaría la ingesta sin nadie que la dispare. Se
retira en el mismo commit que mueve el scheduler.

**Pasos 1 y 2 hechos** (`wip`). Tres tipos cruzaban el límite y los tres se mudaron a
`common/contracts`: `ForecastPointDto`, `WarningSegmentDto` y `FeedStormSummary`. No se mudaron
"al lado de quien lo usa" porque eso solo habría invertido la flecha —moverlos a `weather`
haría que `feeds` dependiera de `weather`— y duplicarlos dejaría dos definiciones que divergen
en silencio. Un tipo que ambos lados necesitan y que ninguno posee no pertenece a ninguno.

Los seis métodos de escritura se mudaron a `StormWriter` y `AdvisoryWriter`, y **los usaba solo
la ingesta**: ninguno más en todo el código, así que no hubo que duplicar nada. Los lectores
`StormsService` y `AdvisoriesService` se quedan sin escrituras. Cada writer declara sus
repositorios con `forFeature` en vez de tomarlos de los lectores: un lector y un escritor
compartiendo el mismo handle de repositorio es exactamente la costura que se estaba despegando.

`upsertFromIngestion` pasó a llamarse `upsert` en los writers, porque el sufijo ya no aporta nada
cuando todos los métodos de la clase son de ingesta.

Verificado: 226/226 unitarias (20 archivos, +2 specs nuevos con 47 casos migrados) y 31/31
integración, `tsc` limpio. Los readers bajaron de 237+213 a 237+213… sin cambio de líneas pero
con ~180 líneas de escritura fuera.

Con eso el grafo queda en `feeds → {}` y es extraíble sin tocar `other`. Es el último porque es
el único que mueve comportamiento, y para entonces hay trazas de la ingesta que dicen si algo
se rompió.

### Lo que esta fase NO hace

- **No parte `auth`/`users` en servicios de red**, ni `dashboard` en solitario. Ver Fase 5.
- **No migra a base de datos por servicio.** Queda como evolution posterior.

### 6.1 y 6.2 — Ejecutadas (2026-09-27)

**6.1** (`f3dfcc5`): collector como hub, `hostmetrics` para la infra, Node runtime metrics por
servicio, y trazas de API y worker con `service.name` propio. Verificado: 17 spans en una traza
que cubre HTTP, middleware y queries de Postgres; 19 métricas del host y 223 de la app en
Prometheus con `service.name` como label; el `trace_id` de una línea de log resuelve a su traza.

**Métricas por contenedor: no funciona aquí.** SELinux impide que un contenedor acceda al socket
de podman **incluso como root**, y un receiver roto tumba el collector entero. Se dejó fuera y
queda anotado en el compose. El uso de recursos por servicio sigue disponible desde el lado de la
app, con las métricas de runtime de Node.

**6.2** (`ba312c0`): trazas del navegador con correlación de punta a punta. Una sola traza lleva
`riskio-web` y `riskio-api`: el span del navegador, el GET y las queries de Postgres debajo.

Dos bugs que **solo aparecieron al mirar las trazas**, no los dashboards:

- Al deshabilitar la instrumentación de `fetch` (para no contar cada llamada dos veces) se
  eliminó también el código que inyecta `traceparent`. Toda traza del navegador era una traza
  propia y la correlación no existía, en silencio. Ahora el contexto se inyecta en
  `buildHeaders`.
- El endpoint OTLP del collector necesita CORS para el navegador, y fallaba el preflight: el
  navegador enviaba y Jaeger no mostraba nada. Es la relajación consciente de la regla de `edge`,
  con orígenes explícitos y no reflejados.

**Loki queda para 6.5**: está arriba y sirviendo sus propias métricas, pero `/ready` sigue en 503
mientras el ingester se asienta. No se le ha enviado ningún log todavía.

### Beneficio que ya existe sin nada de esto

Los `Logger` de Nest emiten `[Nest] 30 - 09/27/2026, 5:20:15 p.m. LOG [MailerService] ...`:
**fecha local sin zona**, un único campo de texto, y no dice qué servicio la emitió. Eso no se
indexa por tiempo de forma fiable. El JSON con UTC de 6.1.5 lo arregla aunque Loki llegue en
6.5.

---

## Resumen de entregables por fase

| Fase | Entregable | Riesgo |
|---|---|---|
| 0 | ✅ 20 commits atómicos, árbol limpio | Bajo |
| 1 | ✅ **Completa**: 1.1, 1.2, 1.3 hechos. 1.4 redirigido a D5 (sin paso) | Bajo |
| 2 | ✅ Frontend con Error Boundaries, TanStack Query, Zod, colocation, splitting | Medio (refactor de data layer) |
| 3 | ⬜ **Sin empezar.** Informe de a11y + Web Vitals. Requiere tu permiso | Bajo (auditoría) |
| 5 | ⬜ **Sin empezar.** A1–A2 operación admin; B1–B3 costuras de despliegue | A1–A2 bajo · B3 medio |
| 6 | 🚧 **6.1 y 6.2 hechas.** 6.3 storage · 6.4 cache · 6.5 logs→Loki · 6.6 feeds | bajo hasta 6.5 · **6.6 medio** |
| 4 | ✅ **Cerrada.** 4.1–4.3: las premisas eran falsas; 4.4 = D1 reactivada | Bajo |

**Fase 6 tiene orden obligatorio**: 6.1 antes que cualquier corte. Separar `storage`, `cache` o
`feeds` sin trazas ni métricas es hacerlo a ciegas, y con `service.name` por servicio la
telemetría sirve igual antes y después del corte.

Fases 0, 1 y 2 ejecutadas (2026-09-26). La 2 dejó el bundle de entrada en 25 kB y el
comportamiento verificado contra el stack en ejecución.

## Orden de ejecución

1. ~~**Fase 4.4** (D1) — reactivar los tests.~~ **Aplazado por decisión del usuario**
   (2026-09-26). Sigue siendo bloqueante para cualquier otra cosa que toque el backend con
   tests: no se ha cerrado, se ha pospuesto. **Nota**: el paso 4.7 tocó backend sin red de
   seguridad, con el spec de auth updated y los de integración en el estado de D11.
2. ~~**Fase 1** — compose: anchors, credenciales a `.env`, red dedicada.~~ ✅
3. ~~**Fase 4.1–4.3** — unificar duplicados de backend y frontend.~~ Pendiente.
4. ~~**Fase 2** — React 19: Error Boundaries, TanStack Query, Zod, colocation, splitting.~~ ✅
5. **Fase 3** — auditorías de a11y y Web Vitals, con informe de prioridades.

**Lo único 🔴 que quedaba, D6, está resuelto.** Ya no hay ninguna entrada abierta con
impacto directo sobre un usuario: D1 está aplazada por decisión, y lo que queda es
mantenimiento.

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

1. **D16** — `/auth/tokens` sin consumidor. Decisión de producto: gestionarlo en Settings,
   cubrirlo con tests, o retirarlo del backend.
2. **Fase 3** — auditorías a11y y Web Vitals. No es código, es un informe. Requiere tu permiso.


**Nota de cobertura**: unitaria **191/191** e integración **31/31**, ambas en verde y sin skips.
`npm test` y `npm run test:integration` son comandos distintos y hay que pasar los dos.

Las 4.1–4.3 quedan cerradas: las premisas de D2 y D3 resultaron falsas (no había carpetas
duplicadas), y lo que había eran dos endpoints para la misma feature y un directorio mal
nombrado. Nada más que unificar.
distintas. Que la primera esté en verde no reactiva D1, que es solo sobre las 3 suites
unitarias comentadas.


### 5 — A1: Swagger utilizable (`addBearerAuth`, `addApiKey`, textos falsos)

Tres cosas, y la tercera era un bug de seguridad disfrazado de documentación.

**Faltaban los dos esquemas de seguridad.** Siete operaciones declaraban `@ApiBearerAuth()` y
ningún esquema estaba registrado, así que el botón *Authorize* no existía y las referencias
apuntaban a la nada. Para probar cualquier endpoint protegido desde `/docs` había que copiar la
peticion a mano. Ahora hay dos esquemas porque hacen falta dos cosas distintas: `bearer` para
cualquier JWT, y `api-key` para `x-api-key`, que exigen `admin/ingest/*` además del token.

**Dos textos mentían.** `POST /auth/forgot-password` estaba documentado como *"Reset an account
password to a temporary one"*, y su respuesta como *"includes the temporary password"*. Desde D12
manda un enlace de un solo uso. No era un texto que se hubiera quedado viejo: describía un
comportamiento que ya no existía, y un cliente construido desde ese documento habría esperado una
contraseña que nunca llega. Corregido, y la descripción nueva dice además que la respuesta es
siempre 200 para no permitir enumerar cuentas.

**El rol solo se promovía, nunca se degradaba.** Este sí es un fallo: `ADMIN_EMAILS` se
resolvía al registrarse y al entrar, pero el login solo escribía el rol cuando era `admin`. Quitar
un email de la lista dejaba a esa cuenta como admin **para siempre**, y la configuración dejaba de
reflejar la realidad sin decir nada. Ahora el rol se re-resuelve en ambos sentidos en cada login,
y hay tres tests que lo fijan.

### La cuenta admin única

`ADMIN_EMAILS=admin@admin.com` en `.env`, y **ninguna contraseña genérica en el repositorio**: la
cuenta se registra por el endpoint normal y su rol sale de la lista, no de un seed. Cualquier otro
correo es siempre `client`, por construcción: `Role` es `'admin' | 'client'` y el rol solo se
asigna desde `resolveRole(email)`.

El botón *Authorize* **no necesita admin**, necesita cualquier JWT; el rol solo importa para
`admin/*`. Por eso la cuenta genérica es comodidad, no un requisito para probar la documentación.

Verificado: `admin@admin.com` es admin, otro correo cualquiera es client, `GET /users/me` con
bearer da 200, y `POST /admin/ingest/run` da **401 con solo el bearer y 200 con bearer +
`x-api-key`**. Los dos esquemas hacen falta y los dos están registrados.

---

## Radio de impacto: un fallo de un servicio, solo ese servicio

Este es el objetivo que gobierna el resto del trabajo, y conviene escribirlo en voz alta porque
es el criterio con el que se juzga cada extracción.

**Regla**: si un servicio falla, solo fallan sus endpoints. El resto de la API sigue respondiendo.
Hoy eso se cumple para `feeds` y `cache`, y **no** para nada de lo demás: 21 endpoints de 7
grupos distintos conviven en un solo proceso, así que un fallo en `weather` se lleva por delante
`/dashboard` y también `/auth`.

Verificado, no supuesto: con `backend-feeds` parado, `/health`, `/storms`, `/dashboard/summary` y
`/users/me` responden 200, y solo `POST /admin/ingest/run` falla — que es exactamente su
propiedad.

| Grupo | Endpoints | ¿Aislado hoy? |
|---|---|---|
| `storage` | avatares (vía `users`) | Sí, servicio propio |
| `cache` | interno | Sí, y además falla abierto |
| `feeds` | `POST /admin/ingest/*` | Sí, servicio propio |
| `weather` | `/storms*`, `/advisories/*` | **Sí** — servicio propio |
| `auth` + `users` | `/auth/*`, `/users/*` | **Sí** — servicio propio |
| **`dashboard`** | `/dashboard/summary` | **No** — y depende de `weather` |
| `health` | `/health` | No, y está bien: debe morir con la API |

### Paso 1 — `weather-service`: **hecho**

`riskio-weather` es dueño de la lectura de tormentas, advisories y warnings. `feeds-service`
escribe esas tablas y este las lee: es el único par escritor/lector del sistema.

El dominio **no se movió de carpeta**. `feeds-service` importa estas entidades para sus writers y
la API todavía necesita los DTOs, así que reubicar veinte ficheros daría tidiness y costaría
churn. La frontera que importa es la de red, y esa está.

**`/dashboard` ahora lee por HTTP**, a través de un `WeatherClientService`. Eso no fue un
detalle: el dashboard era el último consumidor que mantenía el dominio `weather` dentro de la API.
Al moverse el dominio, el dashboard ya no puede tener un `Repository<Storm>`.

**Dos cosas que el salto de redcoxigió pagar**, y que no se ven mirando el código:

- **Las fechas dejan de ser `Date`.** El DTO promete `Date` y el JSON entrega strings. La primera
  versión hacía `...storm` y compilaba: cada fecha del response pasaba a ser string y solo el
  esquema OpenAPI seguía afirmando lo contrario. Ahora se convierten explícitamente con `asDate`.
- **`LatestAdvisoryDto.forecastPoints` era la entidad `ForecastPoint` de TypeORM**, o sea una fila
  de base de datos dentro de un cuerpo de respuesta. Era inofensivo en proceso y dejó de serlo al
  cruzar la red: la entidad lleva una relación `advisory` que no significa nada serializada. Es
  ahora un DTO propio. Los nombres de campo no cambian, así que nada aguas abajo se mueve.

**El proxy del gateway.** El navegador llama a `/storms` en la API porque es el único origen que
tiene configurado, y eso dejó de servir al moverse el dominio. La API reenvía esas rutas con un
controller de ~20 líneas: sin queries, sin mapeo de entidades y sin conexión a la base de datos. Es
literalmente el rol de gateway. Cuesta un salto extra en el camino del navegador para tormentas, y
conviene nombrarlo en vez de fingir que el navegador ya no toca la API. Un fallo de weather sale
como **502 diciendo qué servicio es**, no como un 500 genérico.

**Verificado, con el servicio parado de verdad**:

| Con `weather` caído | |
|---|---|
| `GET /storms` | **502** |
| `GET /users/me` | 200 |
| `GET /auth/tokens` | 200 |
| `GET /health` | 200 |
| `POST /admin/ingest` | 401 (falta la API key, no es por weather) |

Y al restaurarlo, todo vuelve a 200 con 9 tormentas servidas.

Un detalle que casi dio una medición falsa: la primera vez que paré weather, `/dashboard` devolvió
**200** con el servicio caído. Era la caché (30 s) enmascarando el fallo. Sin esperar a que
expirara, la conclusión habría sido "el dashboard sobrevive a weather", que es exactamente lo
contrario de lo cierto. Volviendo a medir con el TTL expirado: **500 en 2 s**, y 200 al
restaurarlo. Un 500, además, debería ser un 503 con nombre de servicio; queda apuntado.

### Objetivo (resto)

- **`auth-service`**
- **`auth-service`** — `/auth/*` y `/users/*` en un solo servicio, porque `users` depende de
  `auth` por el login, el registro y el token; separarlos no aportaría nada.
- **`dashboard-service`** — `/dashboard/summary`, llamando a `weather` por HTTP. Va el último
  porque es el único que necesita hablar con otro servicio de datos, no solo con Postgres. Con
  esto `/dashboard` deja de salir por la API, que es lo que hoy hace.
- **`riskio-api` queda como gateway**: enruta y no tiene lógica de negocio ni conexión a la base
  de datos. La redirección de la API web no cambia: el `compose` publica un puerto y el resto
  vive en la red `core`.

### La decisión que hay que tomar antes de auth, y no es la obvia

Si `auth` pasa a ser un servicio de red, **la API tiene que seguir verificando el JWT en local**,
con el secreto compartido. Si verificara llamando a `auth-service`, habría un salto HTTP **en cada
petición**, para comprobar algo que hoy es parsear un token.

La consecuencia hay que aceptarla con los ojos abiertos: `auth-service` sigue sin ser dueño
exclusivo de `JWT_SECRET`, porque la API lo necesita para validar. Lo que sí se consigue es lo que
importa — un fallo de `auth` impide registrarse, entrar y gestionar tokens, **pero no impide leer
tormentas con un token ya emitido**. Eso es "solo falla ese servicio", y es alcanzable sin poner un
salto en el camino de cada request.

Lo que `auth-service` sí deja de tener es lo demás: `bcrypt` y los hashes de contraseña quedan
behind con él, y la API solo lee usuarios cuando hace falta.

### Orden

1. ~~`weather-service`~~ — **hecho**.
2. `auth-service`, con la verificación local del JWT desde el primer commit. El riesgo real aquí
   no es técnico, es que toca el camino de cada petición.
3. `dashboard-service`, cuando `weather` ya sea un servicio y haya a quién llamar.
4. Convertir la API en gateway, que solo tiene sentido cuando no le quede nada de negocio.

Cada paso se verifica con lo mismo que se ha usado hasta ahora: parar el servicio recién
extraído y comprobar que el resto de endpoints siguen en 200. Un test que arranque la API entera
con `feeds`, `cache` y `storage` caídos **no** dice nada, y es el que ha dado falsa confianza
hasta ahora.


### Paso 2 — `auth-service`: **hecho**, y la premisa del plan era falsa

`riskio-auth` es dueño de `JWT_SECRET`, de la tabla de usuarios, de `bcrypt` y de la emisión de
tokens. La API no tiene ninguno de los tres.

**Había escrito aquí que la API verificaría el JWT en local** para evitar un salto por petición.
**Era falso, y comprobarlo cambió el diseño entero.** `JwtAuthGuard` no solo verifica la firma:
exige *single-active-session*, comparando el `sessionId` del token con la sesión registrada en la
fila del usuario. Eso es estado, y el estado está con los usuarios. Por tanto la API no podía
dejar de leer esa tabla sin inventar otro almacén para las sesiones.

La corrección fue convertir el guard en un **puerto**: `AuthChecker` para el token y
`ApiKeyVerifier` para las API keys. El guard no sabe nada de dónde viene la respuesta, así que
corre igual contra la base de datos (en el servicio de auth) o contra HTTP (en la API). Eso ya no
es un refactor, es lo que hace posible la extracción.

**El salto cae solo donde toca.** `if (isPublic) return true` está antes de cualquier consulta, así
que login, registro y health nunca lo pagan. Las 13 rutas autenticadas sí.

**Lo que seTlose**: `JWT_SECRET` seguía llegando a la API por `env_file: .env`, que no admite
excepciones. Aunque el código no lo usara, el proceso lo tenía. La API ya no carga `.env` entero:
recibe `DATABASE_URL` (para correr migraciones) y las URLs de los seis servicios. Comprobado sobre
el contenedor: la API tiene **0** secretos y el servicio de auth tiene los 3.

**Lo que la fuerza de las pruebas звёт**: cuatro DI, seis rounds, y un estudio entero de horas
perdido. La causa fue iterar un error de resolución a la vez, con la suite de integración de 4
minutos en medio. Debí cablear módulo, `AppModule`, proxy y helper de test **de una pasada** y
verificar después. Los errores que costaron más:

- `AuthzGuardsModule` reexportaba tokens que no poseía. Nest no lo permite, y **no avisa**: falla al
  arrancar.
- Un módulo **dinámico** hizo falta: el token tiene que estar en el mismo módulo que el guard,
  porque Nest resuelve las dependencias de un provider en su propio contexto.
- **`RolesGuard` global rompía el trigger de ingesta.** Corre antes que `ApiKeyGuard` de la ruta,
  leía el rol del JWT de un `client` y rechazaba a un admin que llegaba con API key. El código
  original solo registraba `JwtAuthGuard` global, y ahora se entiende por qué.
- El proxy se saltaba toda petición sin cuerpo, o sea **todos los GET**, y `/users/me` acababa en
  el 404 de Nest. Parecía un endpoint inexistente.
- El health del servicio de auth quedó bajo su propio guard y contestaba 401 sin bearer token, así
  que el contenedor nunca se marcaba sano.

**Verificado, con los servicios parados de verdad**:

| | |
|---|---|
| `auth` caído | `/users/me` y `/auth/tokens` 401, `/storms` y `/dashboard` 503, `/health` **200** |
| `weather` caído | `/users/me`, `/auth/tokens` y `/dashboard` **200** |

Que `auth` caído tumbe todo lo autenticado **es lo correcto**, no un defecto: si no se puede
autenticar, no hay nada que servir. Lo que faltaba era que `/health` siguiera vivo — y lo hace,
porque es público. 250/250 unitarias, 31/31 integración, `tsc` limpio.

**Pendiente**: `weather`, `feeds` y `storage` siguen con `env_file: .env` y heredan los 3
secretos que no usan. El aislamiento por credenciales está hecho para `auth`; para los otros tres
es cuestión de quitarles `env_file` como se hizo con la API.
