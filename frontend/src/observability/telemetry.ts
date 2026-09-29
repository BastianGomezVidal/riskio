import { trace, type Span, type Tracer, type SpanOptions, type Meter } from '@opentelemetry/api';
import type { MeterProvider } from '@opentelemetry/sdk-metrics';

/**
 * Browser-side tracing and metrics, loaded late on purpose.
 *
 * The instrumentation is the thing this app is least able to afford on the
 * critical path. zone.js plus the tracing SDK is around 45 kB gzip, and the
 * entry bundle is what gets measured for LCP — spending a seventh of it on
 * telemetry, to measure the telemetry, is circular. So none of the SDK is
 * imported statically: `initTracing()` pulls it in with a dynamic import once
 * the first render is done, and everything below is a facade that behaves
 * sensibly until then.
 *
 * What the tracing buys that nothing else does:
 *
 * - End to end correlation. Without it a trace starts at the request entering
 *   the API, and there is no way to get from "the user saw this" to "the
 *   backend did that". With it the trace starts at the click and continues into
 *   the server, because the W3C trace context travels in the request headers
 *   that `request()` already sends.
 * - Core Web Vitals from real users, which is what a Web Vitals audit needs; a
 *   lab number is not RUM.
 *
 * Deliberately scoped. The HTTP span lives in `request()` in api/client.ts, the
 * single choke point, so all twenty api methods are covered without being
 * touched. auto-instrumentations-web is not used wholesale: for an SPA it
 * instruments XHR and fetch that the choke point already covers, and adds noise.
 *
 * The cost of loading late, stated plainly: a span started in the window between
 * the first render and the SDK arriving is a no-op, and is lost rather than
 * buffered. That window is one dynamic import at app start, and the requests it
 * would swallow are the ones on the first paint of the first page — the ones
 * that are least interesting to trace, since the page has not been interacted
 * with yet.
 */
const endpoint: string | undefined =
  import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT;

/**
 * Telemetry stays off unless the collector URL was compiled in, and it must
 * never take the app down: a telemetry backend is not worth breaking the
 * product over. When it is off, `NOOP_SPAN` keeps callers branch-free.
 */
export const telemetryReady = Boolean(endpoint);

if (!telemetryReady && import.meta.env.DEV) {
  console.info(
    '[telemetry] VITE_OTEL_EXPORTER_OTLP_ENDPOINT is not set, tracing is off',
  );
}

/** Stand-in span used while the SDK is loading, or when telemetry is off. */
export const NOOP_SPAN = {
  setAttribute: () => NOOP_SPAN,
  setAttributes: () => NOOP_SPAN,
  addEvent: () => NOOP_SPAN,
  addLink: () => NOOP_SPAN,
  addLinks: () => NOOP_SPAN,
  setStatus: () => NOOP_SPAN,
  updateName: () => NOOP_SPAN,
  recordException: () => undefined,
  end: () => undefined,
  isRecording: () => false,
  spanContext: () => ({
    traceId: '0'.repeat(32),
    spanId: '0'.repeat(16),
    traceFlags: 0,
  }),
} as unknown as Span;

let realTracer: Tracer | null = null;

/**
 * The tracer every caller uses. Same shape as an OTel Tracer, but it does
 * nothing until `initTracing()` has finished. Call sites stay branch-free,
 * which is the point: `withSpan` in api/client.ts and `reportWebVitals` both
 * write `tracer.startActiveSpan` and never learn whether telemetry is on, still
 * loading, or off for good.
 */
export const tracer = {
  startActiveSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
  ): Promise<T> {
    if (!realTracer) return fn(NOOP_SPAN);
    return realTracer.startActiveSpan(name, fn);
  },
  startSpan(name: string, options?: SpanOptions): Span {
    return realTracer ? realTracer.startSpan(name, options) : NOOP_SPAN;
  },
};

/**
 * Loads the tracing SDK and registers it. Called after the first render, and
 * never awaited by anything: a rejection here is a missing trace, not a broken
 * page, so it is logged and dropped.
 */
/**
 * The resource both signals share, so a trace and its vitals describe the same
 * deployment. Loaded in its own import so neither path has to wait for the
 * other to start.
 */
async function buildResource() {
  const [
    { resourceFromAttributes },
    {
      ATTR_SERVICE_NAME,
      ATTR_SERVICE_VERSION,
      ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
    },
  ] = await Promise.all([
    import('@opentelemetry/resources'),
    import('@opentelemetry/semantic-conventions'),
  ]);

  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'riskio-web',
    [ATTR_SERVICE_VERSION]: import.meta.env.VITE_APP_VERSION ?? '0.0.0',
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: import.meta.env.MODE ?? 'development',
  });
}

export async function initTracing(): Promise<void> {
  if (!telemetryReady || realTracer) return;
  try {
    await loadTracing();
  } catch (error) {
    // A missing trace is a much smaller problem than a blank page, so this is
    // reported and swallowed. It was not before: a rejected import in a
    // fire-and-forget call is an unhandled rejection with no way to tell it from
    // a bug in the app.
    console.warn(
      '[telemetry] tracing did not load, continuing without it',
      error,
    );
  }
}

async function loadTracing(): Promise<void> {
  // zone.js patches the global async primitives, so it has to be in place
  // before anything that wants to capture a context across an await. It is
  // loaded first and on its own: batched into the Promise.all below, the
  // ordering between it and context-zone would be a race, and the failure mode
  // is a ZoneContextManager that silently never propagates anything.
  await import('zone.js');

  const [
    { WebTracerProvider },
    { BatchSpanProcessor },
    { OTLPTraceExporter },
    { ZoneContextManager },
    { registerInstrumentations },
    { getWebAutoInstrumentations },
  ] = await Promise.all([
    import('@opentelemetry/sdk-trace-web'),
    import('@opentelemetry/sdk-trace-base'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/context-zone'),
    import('@opentelemetry/instrumentation'),
    import('@opentelemetry/auto-instrumentations-web'),
  ]);

  const provider = new WebTracerProvider({
    resource: await buildResource(),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
      ),
    ],
  });
  provider.register({ contextManager: new ZoneContextManager() });

  registerInstrumentations({
    instrumentations: [
      getWebAutoInstrumentations({
        // Left on: react-router and history instrumentation give the route
        // transitions that a SPA's trace is mostly made of.
        '@opentelemetry/instrumentation-xml-http-request': {},
        '@opentelemetry/instrumentation-fetch': {
          // request() already opens a span around every call; letting fetch be
          // instrumented too would double-count every one of them.
          enabled: false,
        },
      }),
    ],
  });

  realTracer = trace.getTracer('riskio-web');
}

/**
 * Metrics. A Web Vitals *span* is the wrong shape for a trend line: spans go to
 * Jaeger, where the question is "show me this one slow load" — a viewer, not a
 * database you can ask for the 75th percentile of. The number Google publishes
 * as your Core Web Vitals is a p75 over real sessions, and getting one out of
 * spans means exporting them somewhere and doing the aggregation by hand. So the
 * vitals also go as histograms, and histograms land in Prometheus, where
 * `histogram_quantile(0.75, ...)` is a one-liner and Grafana draws the line.
 *
 * The export is forced rather than left to a periodic reader. A web vital is
 * recorded a handful of times in the life of a page and then the page is gone,
 * so anything that waits on a timer loses exactly the data it exists to keep: a
 * 30 second interval never fires on a tab that is closed at 20, and browsers
 * throttle those timers hard once the tab is in the background. Flushing right
 * after the measurement means the number is already on its way while the user
 * is still looking at the page.
 */
let meterPromise: Promise<Meter> | null = null;
let meterProvider: MeterProvider | null = null;

/** Pushes whatever has been recorded so far, now rather than on the next tick. */
export function flushMetrics(): Promise<void> {
  return meterProvider ? meterProvider.forceFlush() : Promise.resolve();
}

export function getMeter(): Promise<Meter> {
  if (!telemetryReady) return Promise.reject(new Error('telemetry is off'));

  meterPromise ??= (async () => {
    // Plain MeterProvider, not WebMeterProvider: the web-specific one was
    // removed in OTel JS 2.x and the base provider is what serves the browser
    // now.
    const [
      { MeterProvider, PeriodicExportingMetricReader, AggregationTemporality },
      { OTLPMetricExporter },
    ] = await Promise.all([
      import('@opentelemetry/sdk-metrics'),
      import('@opentelemetry/exporter-metrics-otlp-http'),
    ]);

    meterProvider = new MeterProvider({
      resource: await buildResource(),
      readers: [
        // The interval is a safety net, not the mechanism: flushMetrics() pushes
        // each measurement as soon as it is taken. A slow one here would only
        // ever re-send data already sent, or data recorded after the last flush
        // by code that has not been updated to flush.
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            url: `${endpoint}/v1/metrics`,
            // DELTA, not the default CUMULATIVE, and this is load-bearing.
            //
            // Every page load builds a brand new MeterProvider, so a cumulative
            // stream arrives from a producer that has no memory of the previous
            // one. The collector's Prometheus exporter takes that as a new
            // series and restarts its accumulator, so the histogram is
            // overwritten on every visit instead of growing.
            //
            // Measured, not assumed: with CUMULATIVE, count stayed pinned at 1
            // across repeated visits while sum tracked whichever session
            // reported last (560, then 516), and
            // histogram_quantile(0.75, rate(..._bucket[1h])) was therefore
            // quantising a single sample. The dashboard showed a p75 that
            // changed on every reload, which is not a p75.
            //
            // A delta carries only what was recorded since the last flush, so
            // the collector adds it and the series accumulates the way a
            // long-lived service's would.
            temporalityPreference: AggregationTemporality.DELTA,
          }),
          exportIntervalMillis: 30_000,
        }),
      ],
    });

    return meterProvider.getMeter('riskio-web');
  })();

  return meterPromise;
}
