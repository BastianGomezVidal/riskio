# Arquitectura del backend (Riskio)

Siete procesos NestJS desde un solo `backend/src`, un Postgres con PostGIS, Redis y
SeaweedFS. Este documento explica cómo se reparten, cómo se hablan, y las tres
trampas que ya han costado un incidente cada una.

## 1. Los siete procesos

| Proceso | Puerto | Qué es dueño de | Cómo se arranca |
|---|---|---|---|
| `backend-api` | 3000 | el gateway, `/storms`, `/advisories`, `/dashboard`, `/admin/ingest` | `start:prod` |
| `backend-auth` | 3008 | `JWT_SECRET` y la tabla de usuarios | `start:auth` |
| `backend-weather` | 3007 | el proxy a NOAA NHC | `start:weather` |
| `backend-dashboard` | 3009 | agregados del dashboard | `start:dashboard` |
| `backend-feeds` | 3006 | ingesta de feeds, `/admin/ingest/run` | `start:feeds` |
| `backend-storage` | 3004 | objects en SeaweedFS | `start:storage` |
| `backend-cache` | 3005 | Redis, detrás de HTTP | `start:cache` |

**No existe un `backend-worker`.** El `AGENTS.md` lo menciona y no está en el
compose; la ingesta vive dentro de `backend-feeds` y se dispara por
`/admin/ingest/run`. Si un comando falla con
`WARNING:podman_compose:missing services [backend-worker]`, el nombre correcto
está en la tabla.

Todos arrancan igual:

```
node --import ./dist/instrumentation.js dist/<servicio>/main.js
```

El `--import` es obligatorio y va antes que la app. `instrumentation.ts` parchea
`http`, `pg` y `redis` **en el momento en que se cargan**; si se importara desde
`main.ts` los parches llegarían tarde, y el fallo es silencioso: no se rompe nada
y los dashboards se quedan vacíos. Por eso tiene su propio paso en el plan.

## 2. La API es el único backend publicado

Solo `backend-api` escucha en `0.0.0.0:3000`. Los otros seis se publican en
`127.0.0.1`, y eso es intencionado: son contratos internos y no tienen por qué
ser alcanzables desde fuera de la máquina.

Una excepción que hay que tener presente: **SeaweedFS se publica en
`8333:8333` sin restringir a loopback**, porque el navegador descarga los avatares
directamente de ahí sin credenciales. Funciona, y por lo mismo cualquiera que
conozca la URL de un avatar puede leerlo. En producción esto quiere un dominio
propio delante, no el bucket abierto.

## 3. Dos patrones de proxy, y no son intercambiables

### 3.1 Middleware, para `/auth/*` y `/users/*`

`AuthProxyMiddleware` responde esas rutas antes de que Nest las enrute, porque un
proxy tiene que casar un prefijo con todo lo que venga detrás y el routing de
Nest necesita un comodín declarado ruta por ruta.

Hace dos cosas que un reverse proxy normal no haría:

- **Resuelve el principal antes de reenviar** y lo pasa como header
  `x-forwarded-principal`. El servicio de auth lo vuelve a comprobar contra su
  propio estado, que es local y barato, así que la decisión nunca se toma por la
  palabra de un proxy.
- **Conserva el motivo de un rechazo.** "Tu sesión se cerró porque iniciaste
  sesión en otro sitio" sobrevive al salto en vez de convertirse en un 401 plano.

### 3.2 Controladores proxy, para el resto

`/storms`, `/advisories` y `/dashboard` son controladores de `backend-api` que
reenvían por HTTP a `backend-weather` y `backend-dashboard`. Aquí sí pasan por
los pipes y los guards de la API.

El pulso al servicio de auth va por la red `core` y **no** publica puerto.

## 4. La validación de bodies: qué servicio la tiene y por qué

| Servicio | `ValidationPipe` global | Motivo |
|---|---|---|
| `backend-api` | sí | sus cuerpos son DTOs |
| `backend-auth` | sí | sus cuerpos son DTOs |
| `backend-storage` | no | cuerpos son interfaces planas; `whitelist: true` los vaciaría |
| `backend-cache` | no | ídem |

`backend-storage` y `backend-cache` lo omiten **a propósito** y validan a mano en
el controlador, para poder dar un mensaje concreto en vez de un 400 genérico.

La trampa: **`AuthProxyMiddleware` se ejecuta antes que los pipes de la API**, así
que los pipes de la API nunca ven una petición `/auth`. El servicio de auth es
el único que puede validar esos DTOs, y durante un tiempo no lo hizo
(`e4c31bd`). El efecto no era cosmético:

```
POST /auth/register  {"email":"no-es-email",...}  ->  201 con token de sesión
POST /auth/login     {"email":"no-es-email",...}  ->  200 con access token
POST /auth/register  {}                            ->  500 (colisión NOT NULL en vez de 400)
```

Es decir, sin autenticar se podían crear cuentas y hacer login en direcciones que
nunca podrían recibir un reset de contraseña.

## 5. Cuerpos que no son JSON

`express.json()` rellena `req.body` solo para `application/json`. Para cualquier
otro content-type deja el stream intacto, así que `req.body` es `undefined`
mientras los bytes siguen ahí.

Por eso el middleware reenvía:

- **JSON**: `JSON.stringify(req.body)`, que es lo que ya estaba.
- **Cualquier otra cosa**: se lee del stream y se reenvía como bytes, dejando que
  `fetch` calcule el `content-length` a partir de ellos.

Antes de `4d6e01e` el middleware reenviaba siempre `JSON.stringify(req.body)`. En
un multipart eso mandaba el `content-type` **con su boundary y ningún cuerpo**, el
servicio de auth pasaba el stream vacío por busboy y contestaba
`400 Multipart: Unexpected end of form` a **toda** subida de avatar. Es decir,
`POST /users/me/avatar` era inalcanzable. No era culpa de nginx: la misma
petición fallaba igual directamente contra la API.

El tope de 2 MB del middleware **pausa**, no destruye el socket. Destruirlo dejaba
al cliente con un `100 Continue` y una conexión muerta en vez del 413.

## 6. MIME y multipart en `users.controller.ts`

Dos cosas que solo importan porque ya funcionan:

- El filtro de MIME lanza `BadRequestException`, no un `Error` plano. Multer le
  pasa lo que sea a la capa de excepciones de Nest, y Nest solo mapea un
  `HttpException` a su código, así que un `Error`-salvo salía como **500** por
  un avatar con tipo incorrecto, que es un error del cliente.
- El `fileFilter` es inalcanzable si el body no llega. Durante el bug del punto 5
  toda subida moría antes, en el parser, así que este filtro nunca se ejecutó y
  su 500 llevaba tiempo escondido ahí.

## 7. Sesión única

`single-active-session`: cada login invalida la sesión anterior y la respuesta lo
dice con `previousSessionInvalidated`. Al probar rutas autenticadas hay que usar el
**token recién emitido**; usar uno de un login anterior da 401 y parece un fallo
de autenticación cuando es el comportamiento correcto.

## 8. OAuth: tres URL y una que tiene que coincidir al carácter

Google y Microsoft no fallan nunca aquí: el flujo funciona entero en código, pero sin
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (o los de Microsoft) el endpoint de
arranque responde **503 `<provider> login is not configured`**, y la UI enseña
botones que no pueden funcionar. No hay 501 en el backend; el 501 que aparecía
en notas antiguas no corresponde a ningún código.

Lo que hay que configurar, y por qué son tres variables y no una:

| Variable | Para qué | Ejemplo |
|---|---|---|
| `PUBLIC_BASE_URL` | origen público de la API | `http://riskio.test` |
| `API_PUBLIC_BASE_URL` | **el `redirect_uri`**, con el prefijo `/api` incluido | `http://riskio.test/api` |
| `FRONTEND_URL` | a dónde vuelve el navegador al terminar | `http://riskio.test` |

El prefijo `/api` no es opcional: `frontend/nginx.conf` sirve la API en
`location /api/` y su `proxy_pass` **quita** el `/api` antes de llegar a la
gateway. La gateway sirve sus rutas en la raíz, sin prefijo global. Es decir, la
URL pública es `/api/auth/oauth/<provider>/callback` y dentro del contenedor es
`/auth/oauth/<provider>/callback`. Construir el `redirect_uri` con el origen pelado
daba `http://<host>:<puerto gateway>/auth/oauth/...`, que no existe: ni es
alcanzable desde el navegador ni lleva el prefijo. Google y Microsoft responden
`redirect_uri_mismatch` — después de que la persona ya haya iniciado sesión y
aceptado el consentimiento, que es el peor momento para fallar.

Si `API_PUBLIC_BASE_URL` viene vacía se usa `PUBLIC_BASE_URL` + `/api`. El valor
tiene que ser **exactamente** el que se registró en el proveedor, y en la
consola del proveedor se registra con la misma `redirect_uri` que aparece en la
petición. Con eso, la vuelta al SPA la hace el navegador siguiendo el 302, no el
proxy: `auth-proxy.middleware.ts` pide `redirect: 'manual'` a propósito, porque
`FRONTEND_URL` puede existir solo en el `/etc/hosts` del host, y dentro de la red
de contenedores resolvería al loopback del propio contenedor.

Coherente con §7, un login por sesión: si al volver del callback el token ya no es
el vigente, la respuesta es 401 y el flujo termina en `/` con el aviso de "sesión
cerrada", no en un error de OAuth.

## 9. Dónde vive cada cosa

| Cosa | Dónde |
|---|---|
| `JWT_SECRET` | solo `backend-auth` |
| tabla `users` | solo `backend-auth` |
| los otros DTOs de auth | `backend/src/domain/auth/dto/` |
| el proxy de auth | `backend/src/domain/auth/auth-proxy.middleware.ts` |
| puertos de authz | `backend/src/common/authz/authz.ports.ts` (`AUTH_CHECKER`, `API_KEY_VERIFIER`) |
| telemetría | `backend/src/instrumentation.ts` |

## 10. Para añadir un servicio

1. `src/<nombre>-service/main.ts` con su `useGlobalPipes` **solo si sus cuerpos
   son DTOs**.
2. Un script `start:<nombre>` con el mismo `node --import ./dist/instrumentation.js`.
3. Un `command:` en el compose; sin él arranca con el CMD del image, que es
   `start:prod`, y te encuentras con dos APIs.
4. Publicarlo en `127.0.0.1`, nunca en `0.0.0.0`.
5. Si lo consume la API, un controlador proxy o un cliente HTTP con la URL por
   defecto `http://backend-<nombre>:<puerto>`.
