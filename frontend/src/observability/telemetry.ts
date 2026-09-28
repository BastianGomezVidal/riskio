import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { trace, type Span, type Meter } from '@opentelemetry/api';
import type { MeterProvider } from '@opentelemetry/sdk-metrics';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions';

/**
 * Browser-side tracing.
 *
 * Two things this buys that nothing else does:
 *
 * - End to end correlation. Without it a trace starts at the request entering
 *   the API, and there is no way to get from "the user saw this" to "the
 *   backend did that". With it the trace starts at the click and continues into
 *   the server, because the W3C trace context travels in the request headers
 *   that `request()` already sends.
 * - Core Web Vitals from real users, which is what a Web Vitals audit needs; a
 *   lab number is not RUM.
 *
 * Deliberately scoped. The HTTP span lives in `request()` in api/client.ts,
 * the single choke point, so all twenty api methods are covered without being
 * touched. auto-instrumentations-web is not used wholesale: for an SPA it
 * instruments XHR and fetch that the choke point already covers, and adds noise.
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

function buildProvider(): WebTracerProvider {
  return new WebTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'riskio-web',
      [ATTR_SERVICE_VERSION]: import.meta.env.VITE_APP_VERSION ?? '0.0.0',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
        import.meta.env.MODE ?? 'development',
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
      ),
    ],
  });
}

if (telemetryReady) {
  const provider = buildProvider();
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
}

export const tracer = trace.getTracer('riskio-web');

/**
 * Metrics, and the reason they are not built here alongside the tracer.
 *
 * A Web Vitals *span* is the wrong shape for a trend line. Spans go to Jaeger,
 * where the question is "show me this one slow load" — a viewer, not a
 * database you can ask for the 75th percentile of. The number Google publishes
 * as your Core Web Vitals is a p75 over real sessions, and getting one out of
 * spans means exporting them somewhere and doing the aggregation by hand.
 *
 * So the vitals also go as histograms, and histograms land in Prometheus, where
 * `histogram_quantile(0.75, ...)` is a one-liner and Grafana draws the line.
 *
 * The export is forced rather than left to a periodic reader. A web vital is
 * recorded a handful of times in the life of a page and then the page is gone,
 * so anything that waits on a timer loses exactly the data it exists to keep:
 * a 30 second interval never fires on a tab that is closed at 20, and browsers
 * throttle those timers hard once the tab is in the background. Flushing right
 * after the measurement means the number is already on its way while the user
 * is still looking at the page.
 *
 * The SDK is imported dynamically rather than at the top of this module. The
 * metrics exporter and the meter are ~15 kB gzip, and the entry bundle is the
 * thing being measured for LCP — spending that on telemetry to measure the
 * telemetry would be circular. reportWebVitals() is called after the first
 * paint, so by the time anything is imported the critical path is already done,
 * and the SDK lands in its own chunk.
 */
let meterPromise: Promise<Meter> | null = null;
let provider: MeterProvider | null = null;

/** Pushes whatever has been recorded so far, now rather than on the next tick. */
export function flushMetrics(): Promise<void> {
  return provider ? provider.forceFlush() : Promise.resolve();
}

export function getMeter(): Promise<Meter> {
  if (!telemetryReady) return Promise.reject(new Error('telemetry is off'));

  meterPromise ??= (async () => {
    // Plain MeterProvider, not WebMeterProvider: the web-specific one was
    // removed in OTel JS 2.x and the base provider is what serves the browser
    // now.
    const [{ MeterProvider, PeriodicExportingMetricReader }, { OTLPMetricExporter }] =
      await Promise.all([
        import('@opentelemetry/sdk-metrics'),
        import('@opentelemetry/exporter-metrics-otlp-http'),
      ]);

    provider = new MeterProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'riskio-web',
        [ATTR_SERVICE_VERSION]: import.meta.env.VITE_APP_VERSION ?? '0.0.0',
        [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: import.meta.env.MODE ?? 'development',
      }),
      readers: [
        // The interval is a safety net, not the mechanism: flushMetrics() pushes
        // each measurement as soon as it is taken. A slow one here would only
        // ever re-send data already sent, or data recorded after the last flush
        // by code that has not been updated to flush.
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
          exportIntervalMillis: 30_000,
        }),
      ],
    });

    return provider.getMeter('riskio-web');
  })();

  return meterPromise;
}

/** Stand-in span used when telemetry is off, so callers need no branch. */
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
