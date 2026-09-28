import { Writable } from 'node:stream';
import { context, trace, TraceFlags } from '@opentelemetry/api';
import { logs, SeverityNumber, type LogAttributes } from '@opentelemetry/api-logs';

/**
 * Bridges nestjs-pino's JSON lines into the OpenTelemetry logs signal, so they
 * reach Loki through the same collector as traces and metrics.
 *
 * Why a stream and not a pino transport: transports run in a worker thread, and
 * a worker thread has no OTel context. The trace would still be in the line —
 * the mixin writes `trace_id` — but the SDK would not see it as the active
 * context, and the exporter would attach nothing. A same-process stream keeps
 * the correlation honest.
 *
 * Writing to stdout still happens, in parallel. This is additive on purpose:
 * `docker logs` keeps working, and Loki gets a copy.
 */

/** pino levels, mapped to the severity numbers Loki sorts and filters on. */
const SEVERITY: Record<string, SeverityNumber> = {
  trace: SeverityNumber.TRACE,
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
  fatal: SeverityNumber.FATAL,
};

/**
 * The only fields allowed out, and from the request or response object only
 * these three.
 *
 * This started as "send whatever pino logged" and that was wrong twice over.
 * Headers carry `Authorization`, so every log line shipped a live JWT into the
 * log store, where it was both persisted and indexed. And Loki's OTLP endpoint
 * turns attributes into index labels, so a `req_id` or a `req_url` in the set
 * means one stream per request — the same cardinality trap that applies to
 * metric labels, arriving by a different door.
 *
 * An allowlist is the only version of this that is safe to leave running.
 */
const ALLOWED = new Set([
  'trace_id',
  'span_id',
  'context',
  'err',
  'error',
  'stack',
  'worker',
  'job',
  'duration_ms',
  'responseTime',
]);

const ALLOWED_FROM_REQUEST = new Set(['method', 'url']);
const ALLOWED_FROM_RESPONSE = new Set(['statusCode']);

function primitive(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value === null || value === undefined) return undefined;
  // Nested payloads, such as pino's serialized error, are kept as JSON text:
  // dropping them would lose the reason the line was written.
  return JSON.stringify(value);
}

function toAttributes(record: Record<string, unknown>): LogAttributes {
  const attributes: LogAttributes = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === 'req' && value && typeof value === 'object') {
      const request = value as Record<string, unknown>;
      for (const field of ALLOWED_FROM_REQUEST) {
        const picked = primitive(request[field]);
        if (picked !== undefined) attributes[`http.${field}`] = picked;
      }
      continue;
    }

    if (key === 'res' && value && typeof value === 'object') {
      const response = value as Record<string, unknown>;
      for (const field of ALLOWED_FROM_RESPONSE) {
        const picked = primitive(response[field]);
        if (picked !== undefined) attributes[`http.response.${field}`] = picked;
      }
      continue;
    }

    if (!ALLOWED.has(key)) continue;
    const picked = primitive(value);
    if (picked !== undefined) attributes[key] = picked;
  }
  return attributes;
}

export function createOtelLogStream(serviceName: string): Writable {
  const logger = logs.getLogger('nestjs-pino');

  return new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      for (const line of chunk.toString().split('\n')) {
        if (!line.trim()) continue;
        try {
          const record = JSON.parse(line) as Record<string, unknown>;
          const level = String(record.level ?? 'info');
          const { msg, level: _level, time, ...rest } = record;

          /**
           * Rebuild the span context from the ids the mixin already wrote, so
           * the exported record carries the same trace as the stdout line.
           * Remote, because from the log's point of view the request came from
           * somewhere else.
           */
          const traceId = rest.trace_id;
          const spanId = rest.span_id;
          const recordContext =
            typeof traceId === 'string' &&
            typeof spanId === 'string' &&
            traceId.length === 32 &&
            spanId.length === 16
              ? trace.setSpanContext(context.active(), {
                  traceId,
                  spanId,
                  isRemote: true,
                  traceFlags: TraceFlags.SAMPLED,
                })
              : undefined;

          logger.emit({
            body: typeof msg === 'string' ? msg : (JSON.stringify(msg ?? '')),
            severityText: level,
            severityNumber: SEVERITY[level] ?? SeverityNumber.INFO,
            attributes: {
              'service.name': serviceName,
              ...toAttributes(rest),
            },
            observedTimestamp: typeof time === 'string' ? Date.parse(time) : undefined,
            context: recordContext,
          });
        } catch {
          // A line that is not JSON means something bypassed pino's formatter.
          // It is already on stdout; dropping it here is the right call.
        }
      }
      callback();
    },
  });
}
