import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { trace, type Span } from '@opentelemetry/api';
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
