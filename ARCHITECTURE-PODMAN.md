# Podman y podman-compose (Riskio)

Cómo se levanta, how se levanta y qué nombres existen de verdad. Todo lo que hace
falta para no hydraulizar el stack por un nombre de servicio equivocado.

## 1. Los comandos que se usan

| Objetivo | Comando |
|---|---|
| Construir sin caché | `podman-compose build --no-cache` |
| Reconstruir y levantar | `podman-compose up -d --build --no-cache <servicios>` |
| Recrear con la imagen ya construida | `podman-compose up -d --force-recreate <servicios>` |
| Ver los servicios | `podman-compose config --services` |
| Ver el estado | `podman ps --format '{{.Names}}  {{.Status}}'` |

`--force-recreate` es lo que hace que un cambio de código llegue al contenedor.
Un `up -d --build` que solo reconstruya la imagen puede dejar el contenedor
antiguo corriendo, y entonces se prueban el código viejo con la imagen nueva, que
es la forma más cara de perder media hora.

## 2. Los nombres de servicio, que no son los que uno espera

```
backend-api      backend-auth     backend-weather   backend-dashboard
backend-feeds    backend-storage  backend-cache
db               redis            storage
frontend         grafana          jaeger             loki
otel-collector   prometheus       pushgateway
```

Dos trampas concretas:

- **No existe `backend-worker`.** La ingesta vive en `backend-feeds` y se dispara
  por `POST /admin/ingest/run`. Pedirlo da
  `WARNING:podman_compose:missing services [backend-worker]` y no levanta nada.
  Los servicios del backend son siete; están en la tabla de
  [ARCHITECTURE-BACKEND.md](ARCHITECTURE-BACKEND.md).
- **Los contenedores llevan `_1` al final.** `riskio_backend-api_1`, no
  `riskio_backend-api`. Importa con `podman exec` y con `podman logs`.

Para no adivinar, `podman-compose config --services` siempre tiene razón.

## 3. Los siete procesos de backend comparten una imagen

Una sola etiqueta, `localhost/riskio_backend:latest`, y lo que los distingue es el
`command`:

| Servicio | `command` |
|---|---|
| `backend-api` | ninguno, usa el CMD de la imagen (`start:prod`) |
| `backend-auth` | `["npm", "run", "start:auth"]` |
| `backend-weather` | `["npm", "run", "start:weather"]` |
| `backend-dashboard` | `["npm", "run", "start:dashboard"]` |
| `backend-feeds` | `["npm", "run", "start:feeds"]` |
| `backend-storage` | `["npm", "run", "start:storage"]` |
| `backend-cache` | `["npm", "run", "start:cache"]` |

Cada servicio declara `image:` de forma explícita y los siete apuntan a la misma
etiqueta. **No era así**, y esta sección decía lo contrario:

Sin `image:`, Compose deriva una etiqueta por nombre de servicio. Habia siete
imagenes identicas de 651 MB — mas una octava, `backend-worker`, de un servicio
que ya no existe — y `podman-compose build backend-api` no tocaba
`backend-auth`. El sintoma era el peor posible: un cambio en codigo compartido
desplegaba en un proceso y no en el otro, y se veia como un arreglo que no
funciona. Pasó de verdad durante el trabajo de Swagger: `/docs` del gateway
devolvio el documento nuevo mientras el del servicio de auth seguia dando 404.

Dos consecuencias practicas:

1. **Un build, siete recreados.** La etiqueta es comun, asi que hay que recrear
   los siete despues de compilar el backend. Recrear de mas es barato; recrear
   el equivocado era el bug.
2. **`--force-recreate` no es de fiar con un solo servicio.** Pedir
   `podman-compose up -d --force-recreate backend-auth` informa haber recreado
   `backend-api` y `frontend`, y se salta el servicio que nombro. Hay que pasar
   los siete, o comprobar despues con
   `podman inspect -f '{{.ImageName}}' riskio_backend-auth_1`.


## 4. Redes

| Red | Quién | Por qué |
|---|---|---|
| `core` | la API, los servicios backend, `db`, `redis`, `storage` | el plano de datos, nada de navegador |
| `edge` | `frontend`, `db`, `redis`, `storage`, y lo de observabilidad | lo que puede tocar un navegador |

La separación es real: un servicio interno no necesita estar en `edge`.

## 5. Puertos publicados

| Servicio | Publicado | Nota |
|---|---|---|
| `frontend` | `80:80` | el único punto de entrada de la app |
| `backend-api` | `3000:3000` | en todas las interfaces |
| `storage` (SeaweedFS) | `8333:8333` | **en todas las interfaces**, ver más abajo |
| `db` | `127.0.0.1:5432` | |
| `redis` | `127.0.0.1:6379` | |
| backend-auth/cache/dashboard/feeds/storage/weather | `127.0.0.1:300X` | |
| `grafana` | `127.0.0.1:3001` | |
| `prometheus` | `127.0.0.1:9090` | |
| `pushgateway` | `127.0.0.1:9091` | |
| `jaeger` | `127.0.0.1:16686` | |
| `otel-collector` | `127.0.0.1:4318` | |
| `loki` | **nada** | hay que consultarlo desde dentro de la red |

`storage` es la excepción que conviene recordar: el navegador descarga los avatares
directamente de SeaweedFS, sin credenciales, así que el bucket está abierto a
quien conozca la URL. En producción necesita un dominio propio delante.

**Loki no publica puerto y está solo en la red `core`.** Desde el host no hay nada,
y tampoco desde el contenedor del frontend, que está en `edge`. `/ready` devuelve
503 aunque las consultas funcionen, así que un 503 ahí no significa que Loki esté
caído. La red pasa por `backend-api`, que está en `core` y en `edge`:

```bash
NOW=$(date +%s); START=$((NOW-3600))
podman exec riskio_backend-api_1 node -e "
const u='http://loki:3100/loki/api/v1/query_range?query='
  + encodeURIComponent('{service_name=~\".+\"}')
  + '&start=${START}000000000&end=${NOW}000000000&limit=3';
fetch(u).then(r=>r.json()).then(j=>{
  for (const s of j.data?.result ?? [])
    console.log(s.stream.service_name, s.values.length);
});"
```

Devuelve los streams del backend: `riskio-api`, `riskio-auth`, `riskio-weather`,
`riskio-cache`, `riskio-storage`. No aparece `riskio-web`, porque el navegador no
manda logs, solo trazas y métricas.

## 6. Volúmenes

| Volumen | Qué conserva |
|---|---|
| `pgdata` | la base de datos |
| `storage_data` | los avatares en SeaweedFS |
| `redis_data` | Redis |
| `loki_data` | logs |
| `grafana_data` | dashboards y datos de Grafana |
| `prometheus_data` | series de Prometheus |
| `pushgateway_data` | **el último** resultado del audit, no histórico |
| `jaeger_data` | trazas (Badger) |

Todos sobreviven a `--force-recreate`, y por eso el Pushgateway sigue teniendo el
resultado del audit después de recrear todo. Ojo: `pushgateway_data` guarda **un**
valor, el último. Si se quieren auditorías separadas hay que mirar
`audit-web.sh`, que es quien guarda el informe.

## 7. Recetas

Solo el frontend:

```bash
podman-compose up -d --build --no-cache frontend
```

Backend. Los siete procesos comparten etiqueta, asi que un build se despliega
recreando los siete (ver §3):

```bash
podman-compose build --no-cache backend-api
podman-compose up -d --force-recreate --no-deps \
  backend-api backend-auth backend-weather backend-dashboard \
  backend-feeds backend-storage backend-cache
```

Comprobar que los siete tienen la imagen nueva, porque `--force-recreate` con
un solo servicio no es de fiar:

```bash
for s in api auth weather dashboard feeds storage cache; do
  podman inspect -f "{{.ImageName}} {{.State.Health.Status}}" "riskio_backend-$s"_1
done
```

Cuando algo va mal y hay que empezar de cero en los contenedores, sin tocar los
volúmenes:

```bash
podman-compose up -d --force-recreate
```

Un `podman system prune` o un `down -v` se llevan los volúmenes y con ellos la
base de datos, los avatares y los logs. Para diagnosticar no hace falta, y para
empezar de cero a veces sí.

## 8. Comprobar que todo está en pie

```bash
podman ps --format '{{.Names}}  {{.Status}}'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost/
curl -s -o /dev/null -w '%{http_code}\n' http://localhost/api/health
```

Un contenedor en estado `Created` está **sin arrancar**, no unhealthy. Pasa si un
comando anterior se interrumpió a mitad; `podman-compose up -d frontend` lo
resuelve, y hasta entonces el puerto da `000` en vez de un error claro.
