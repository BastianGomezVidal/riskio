/**
 * OpenTelemetry bootstrap.
 *
 * This module has to be loaded **before** the application. `start:prod` and
 * `start:worker` both use `node --import ./dist/instrumentation.js`, because
 * the auto-instrumentations patch modules such as http, pg and redis as they
 * load. If this file were imported from main.ts instead, the patches would land
 * too late: nothing gets instrumented, nothing throws, and the dashboards stay
 * empty. That failure is silent, which is why it has its own step in the plan.
 *
 * It must not import anything from the application. Anything the app imports
 * would already be loaded by the time this file runs.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions';

/** Where the collector listens. Defaults to the compose service name. */
const endpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318';

/**
 * One service name per process, decided now so the service extractions in
 * Fase 6 do not have to relabel traces and metrics that already exist.
 */
const serviceName = process.env.OTEL_SERVICE_NAME ?? 'riskio-api';

/**
 * Ratio of traces to keep. NOAA is polled every 10 minutes, which is not the
 * problem; instrumenting every HTTP call and every query is. ParentBased keeps
 * an upstream decision, so a trace sampled by the browser is not dropped here.
 */
const sampleRatio = Number(process.env.OTEL_TRACE_SAMPLE_RATIO ?? '1');
if (!Number.isFinite(sampleRatio) || sampleRatio < 0 || sampleRatio > 1) {
  throw new Error(
    `OTEL_TRACE_SAMPLE_RATIO must be between 0 and 1, got "${process.env.OTEL_TRACE_SAMPLE_RATIO}"`,
  );
}

const sdk = new NodeSDK({
  serviceName,
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0',
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
      process.env.DEPLOYMENT_ENVIRONMENT ?? 'local',
  }),
  traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
  metricReaders: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
      exportIntervalMillis: 15_000,
    }),
  ],
  // Head sampling only decides what the SDK is willing to send. The collector
  // then decides again, with tail_sampling, once it knows whether the request
  // ended in an error. Keeping this at 1 means nothing is lost before the
  // collector can make the better-informed decision; the collector is the one
  // that drops.
  /**
   * Logs go to Loki through the same collector, so a log line and the trace it
   * belongs to travel the same path and arrive with the same resource
   * attributes. Batched for the same reason traces are: one HTTP request per
   * batch, not one per line.
   */
  logRecordProcessors: [
    new BatchLogRecordProcessor({
      exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs` }),
    }),
  ],
  sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(sampleRatio) }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // The filesystem instrumentation is chatty and rarely useful here.
      '@opentelemetry/instrumentation-fs': { enabled: false },
      // This one attaches the whole request and response to every log line,
      // headers included, which means the `Authorization: Bearer <jwt>` value
      // lands in the log store as an index label. Correlation is already done
      // by the mixin in observability.module.ts, from the active span, and it
      // does not need the request to do it.
      '@opentelemetry/instrumentation-pino': { enabled: false },
    }),
  ],
});

sdk.start();

export {};
