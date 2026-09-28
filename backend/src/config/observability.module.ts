import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import pino from 'pino';
import { context, trace } from '@opentelemetry/api';
import { createOtelLogStream } from './otel-log-stream.js';

const serviceName = process.env.OTEL_SERVICE_NAME ?? 'riskio-api';

/**
 * Structured JSON logging.
 *
 * Replaces Nest's default Logger, which prints
 * `[Nest] 30 - 09/27/2026, 5:20:15 p.m. LOG [MailerService] ...`: a local date
 * with no zone, inside a single text field, with nothing saying which service
 * emitted the line. That format cannot be indexed reliably by time, and a log
 * backend needs a real timestamp field to sort on.
 *
 * Every line becomes one JSON object with a UTC ISO-8601 timestamp, the level,
 * the service, and — when a span is active — the `trace_id` and `span_id`.
 * Those two are the point of the whole exercise: they turn a log line into a
 * jump to its trace.
 */
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        /**
         * Two destinations for the same line: stdout, for `docker logs`, and
         * the OTel logs signal, for Loki. Not a pino transport, because a
         * transport runs in a worker thread with no OTel context and the trace
         * correlation would be lost. See otel-log-stream.ts.
         */
        stream: pino.multistream(
          [
            { stream: pino.destination({ dest: 1 }) },
            { stream: createOtelLogStream(serviceName) },
          ],
          { dedupe: false },
        ),
        // ISO-8601 in UTC: sortable, unambiguous, and what every backend
        // downstream expects.
        timestamp: () => `,"time":"${new Date().toISOString()}"`,
        base: {
          service: serviceName,
          env: process.env.DEPLOYMENT_ENVIRONMENT ?? 'local',
        },
        formatters: {
          level(label) {
            return { level: label };
          },
        },
        /**
         * Attach the active trace to every line. pino's mixin runs for each
         * log record regardless of who emitted it, which is what makes this
         * work for the `new Logger(X)` instances scattered through the app
         * too. Empty when there is no span, the case during startup.
         */
        mixin() {
          const span = trace.getSpan(context.active());
          const spanContext = span?.spanContext();
          if (!spanContext) {
            return {};
          }
          return {
            trace_id: spanContext.traceId,
            span_id: spanContext.spanId,
          };
        },
      },
    }),
  ],
})
export class ObservabilityModule {}
