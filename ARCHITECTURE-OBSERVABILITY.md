# Arquitectura de observabilidad

Qué mide cada pieza, dónde viven los datos y qué **no** hay. Las cifras de aquí
son medidas, no estimadas: cada afirmación lleva el cómo comprobarla.

## 1. Las dos clases de métricas, y por qué se confunden

Es lo que más cuesta entender de este stack, y es la causa de casi toda
confusión sobre "no hay datos".

| | `audit_*` | `web_vitals_*` |
|---|---|---|
| Origen | Lighthouse y axe | navegador real |
| Tipo | **lab** | **campo (RUM)** |
| Responde a | "¿rompí algo?" | "¿se siente rápido para quien lo usa?" |
| Almacén | Pushgateway | collector → Prometheus |
| Se genera al | correr `audit-web.sh` | que alguien navega |

**Correr `audit-web.sh` no produce RUM, y no debería.** Lighthouse y axe miden
una visita sintética: no hay usuario, y sus números no dicen nada sobre cómo se
siente la app. Por eso, después de una auditoría completa, los paneles de
`web_vitals_*` están vacíos, y eso es lo correcto.

Lo que sí se ve tras la auditoría son los paneles `audit_*`, alimentados por
Pushgateway. Ese canal se corrigió aparte: antes iban por el collector como
cualquier métrica y expiraban a los cinco minutos.

## 2. Prueba reproducible de que el RUM funciona

```bash
node .audit/rum-check.mjs
```

Mira el contador real de LCP, hace **una visita real de navegador**, y lo vuelve
a mirar:

```
  LCP count antes:      0
  visita real a la portada...
  POST OTLP desde el navegador: http://localhost:4318/v1/metrics
  esperando al scrape de Prometheus...
  LCP count despues:     1
  delta:                 +1
```

Un delta mayor que cero prueba la cadena entera: el SDK del navegador registró
el vital, el POST OTLP llegó, el collector lo aceptó, el exporter lo publicó y
Prometheus lo scrapeó.

No pide credenciales a propósito. El LCP se reporta en la portada, así que la
prueba corre con cualquiera y no se pudre cuando cambia la cuenta de test.

## 3. El histograma no acumulaba, y el p75 no era un p75

El más serio de los problemas encontrados, y era invisible: **había datos y
parecían correctos**.

Cada carga de página construye un `MeterProvider` nuevo, porque el navegador no
sobrevive entre sesiones. Eso llega al collector como un stream sin memoria del
anterior, y el exporter de Prometheus **no los sumaba**: reemplazaba.

Medido, con visitas reales repetidas:

```
  web_vitals_LCP_milliseconds_count = 1     <- clavado en 1
  web_vitals_LCP_milliseconds_sum   = 568   <- 560, luego 516, luego 568...
```

`sum` seguía a la última sesión que habló, y el exporter exponía **una sola
serie**. Las consecuencias:

- `histogram_quantile(0.75, rate(..._bucket[1h]))` cuantizaba **una muestra**.
- El p75 del dashboard cambiaba en cada recarga. No era un p75.
- Cualquier tendencia en el tiempo era ficción.

El arreglo son las dos mitades, y hace falta **la pareja**:

1. El navegador exporta en `DELTA`, no en el `CUMULATIVE` por defecto
   (`frontend/src/observability/telemetry.ts`). Delta lleva solo lo registrado
   desde el último flush.
2. El collector suma esos deltas en el pipeline de métricas, con el processor
   `deltatocumulative` (`deploy/otel-collector-config.yaml`).

Con solo la primera mitad no cambió nada: se probó y el contador siguió clavado
en 1. El problema estaba en el traductor del exporter, no en el SDK del
navegador.

Verificado después del arreglo, con cinco visitas reales:

```
  web_vitals_LCP_milliseconds_count = 5
  web_vitals_LCP_milliseconds_sum   = 2988      (media 598 ms)
  bucket le=500  -> 0
  bucket le=750  -> 5                            (las cinco en el mismo)
```

El histograma ahora acumula de verdad. Con cinco observaciones casi idénticas el
p75 cae dentro de un único bucket, que es el límite honesto de un histograma con
pocos datos, no un defecto.

### Ratings, además del p75

El histograma dice "qué tan lento". El `rating` que `web-vitals` ya calcula dice
"si eso está bien":

```
  web_vitals_rating_total{metric="LCP", rating="good"} = 1
```

Para la proporción:

```promql
100 * sum by (rating) (rate(web_vitals_rating_total{metric="LCP"}[30m]))
    / sum(rate(web_vitals_rating_total{metric="LCP"}[30m]))
```

## 4. Pruebas sintéticas: nunca sobre una serie de producción

Durante la validación de este documento se inyectó un `web.vitals.LCP` inventado
por `curl` para comprobar conectividad. **Fue un error**, y sirve de ejemplo de
lo que no hay que hacer:

- El exporter del collector usa contadores **acumulativos**, así que un dato
  falso se suma para siempre. El `p75 = 437 ms` que salió en esa prueba era
  inventado, y quedó **descartado**.
- Se corrigió reiniciando el collector, que pone los contadores a cero, y se
  verificó que la serie volvía a 0.

El POST sintético sí sirven para una cosa: probar que el camino
`POST /v1/metrics` → collector → Prometheus responde. Como prueba de conectividad
es válida. Como medida del rendimiento de la app, es basura.

**Regla:** para una prueba de conectividad, un nombre aparte.

```
app_latency_seconds          <- producción
test_app_latency_seconds     <- prueba
```

## 5. Jaeger está configurado con muestreo, así que parece vacío

El pipeline de trazas tiene `tail_sampling` antes de exportar:

| Política | Qué guarda |
|---|---|
| `status_code: ERROR` | siempre |
| latencia `> 250 ms` | siempre |
| resto, `probabilistic` | **20 %** |

Una visita correcta y rápida tiene un 20 % de probabilidad de llegar a Jaeger. Es
una decisión consciente, para no pagar en disco lo que casi siempre no va a
mirarse. Pero significa que un volumen pequeño deja la interfaz **aparentemente
vacía sin que nada esté roto**.

No se rellenó Jaeger con trazas artificiales para disimularlo. Comprobar que
funciona se hace con una traza real (el `trace_id` sale del navegador) o con la
traza de control `prueba-controlada`.

Las trazas que sí se ven siempre: las de `riskio-web` en cada carga, con los
detalles de React y las llamadas HTTP que la explican.

## 6. Loki tiene logs del backend, no del frontend

El pipeline existe y funciona:

```yaml
logs:
  receivers: [otlp]
  processors: [memory_limiter, attributes/sanitize, batch]
  exporters: [otlphttp/loki]
```

**Sí hay logs dentro**, y no son pocos: el backend los emite por
auto-instrumentación OTel de NestJS. Medido:

```
loki_distributor_lines_received_total{tenant="fake"}  9103
loki_ingester_memory_streams{tenant="fake"}              7
```

Streams por servicio, en las últimas 48 h:

| Servicio | Streams |
|---|---|
| `riskio-api` | 1 |
| `riskio-cache` | 1 |
| `riskio-auth` | 1 |
| `riskio-web` | **0** |

Los labels que trae cada línea son los de la auto-instrumentación:
`http_method`, `http_url`, `http_response_statusCode`, `process_command`,
`detected_level`. Sirven bien para depurar el backend.

Lo que **no** existe:

- **Logs del frontend.** `riskio-web` no emite nada por OTLP. El SDK del
  navegador manda métricas y trazas, y no logs.
- **Eventos de Core Web Vitals en Loki.** El RUM va a Prometheus como métrica y
  a Jaeger como traza. Mandar además cada medición a Loki sería una tercera copia
  de lo mismo, así que no se hace. Cualquier análisis de "LCP pobre en /checkout"
  sobre Loki es hoy **hipotético**.

> **Trampa al comprobar Loki desde el host:** `http://localhost:3100` no responde,
> porque el puerto no está publicado. Se parece mucho a "Loki está vacío" y es
> falso. Desde la red del compose:
>
> ```bash
> podman run --rm --network riskio_core docker.io/library/redis:7-alpine \
>   sh -c 'wget -qO- "http://loki:3100/loki/api/v1/labels"'
> ```
>
> Igual de confuso: `/ready` devuelve **503** mientras las consultas funcionan.
> No uses `/ready` como prueba de que Loki tiene datos.

## 7. La autotelemetría del collector está apagada

`otelcol_*` da **cero** en los puertos 8888 y 8889. No es una rotura: el
`service.telemetry` solo configura `logs.level`, y esta versión no expone
métricas propias por defecto.

Ningún panel del dashboard depende de `otelcol_*`, así que nada se ve afectado.
Se anota porque es el primer sitio donde mirar cuando un panel de salud del
collector salga vacío, y la respuesta es que nunca estuvo.

## 8. Dónde vive cada cosa

Todo en volúmenes Docker locales. **Nada de esto va a SeaweedFS.**

| Servicio | Volumen | Contenido |
|---|---|---|
| Prometheus | `prometheus_data` | TSDB, 15 días |
| Jaeger | `jaeger_data` | Badger: `data/ keys/ values/`, TTL 15 días |
| Loki | `loki_data` | `chunks/`, con logs del backend |
| Grafana | `grafana_data` | dashboards y estado |
| Pushgateway | `pushgateway_data` | último resultado de auditoría |
| SeaweedFS | `storage_data` | almacenamiento de objetos de la app, nada que ver |

**Por qué no Prometheus scrapea SeaweedFS:** Prometheus scrapea *endpoints
HTTP*. No lee buckets S3 ni almacenes de objetos: solo consume un `/metrics`. Las
métricas necesitan una base de series temporales; un bucket de objetos no lo es.

**Por qué no InfluxDB:** Prometheus ya cubre el caso. Añadir un segundo TSDB
duplica los datos y duplica las consultas sin ganar nada que este stack use.

## 9. El orden para diagnosticar "no hay datos"

1. ¿Es un panel de `web_vitals_*`? Corre `node .audit/rum-check.mjs`. Si el
   delta es 0, el problema es del RUM. Si es > 0, el RUM funciona y el problema
   es del panel o del rango de tiempo.
2. ¿Es un panel de `audit_*`? El origen es Pushgateway. Si está vacío, no se ha
   corrido la auditoría, o Pushgateway no está levantado.
3. ¿Es Jaeger? Antes de suspectar de Jaeger, mira el muestreo: el 80 % de las
   trazas correctas se descartan a propósito.
4. ¿Es Loki? Recuerda que no está publicado en el host, así que hay que
   consultarlo desde dentro de la red del compose. Y ten en cuenta que solo hay
   logs del backend: si buscas algo del frontend, no lo hay.
