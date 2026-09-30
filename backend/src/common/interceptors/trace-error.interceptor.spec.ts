import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import {
  NodeTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { TraceErrorInterceptor } from './trace-error.interceptor.js';

/**
 * The interceptor is what makes a failed request look different from a
 * successful one in Jaeger, and that is not cosmetic: the collector's tail
 * sampling keeps every trace containing an error span and only a share of the
 * rest. If this does not mark the span, failing requests are the first thing
 * sampling discards.
 */
describe('TraceErrorInterceptor', () => {
  const exporter = new InMemorySpanExporter();

  // A context shaped like the one Nest passes, because the interceptor reads
  // the method and route off it to make errors searchable.
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        route: { path: '/storms/:atcfId' },
      }),
    }),
  } as unknown as ExecutionContext;
  let tracer: ReturnType<typeof trace.getTracer>;

  // One provider for the whole file: register() swaps a global, so registering
  // per test would leave the second test's tracer pointing at the first
  // provider and see no spans at all.
  beforeAll(() => {
    new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    }).register();
    tracer = trace.getTracer('test');
  });

  beforeEach(() => {
    exporter.reset();
  });

  it('marks the span as error and records the exception', () => {
    const failure = new Error('database unavailable');

    const span = tracer.startSpan('GET /storms');
    let thrown: unknown;

    context.with(trace.setSpan(context.active(), span), () => {
      new TraceErrorInterceptor()
        .intercept(ctx, { handle: () => throwError(() => failure) } as never)
        .subscribe({ error: (e) => (thrown = e) });
    });
    span.end();

    expect(thrown).toBe(failure);

    const [exported] = exporter.getFinishedSpans();
    expect(exported.status.code).toBe(SpanStatusCode.ERROR);
    expect(exported.status.message).toBe('database unavailable');
    expect(exported.events.filter((e) => e.name === 'exception')).toHaveLength(
      1,
    );
    // Searchable in Jaeger without opening the trace.
    expect(exported.attributes['http.route']).toBe('/storms/:atcfId');
    expect(exported.attributes['http.request.method']).toBe('GET');
  });

  it('leaves a successful call untouched', () => {
    const span = tracer.startSpan('GET /storms');

    context.with(trace.setSpan(context.active(), span), () => {
      new TraceErrorInterceptor()
        .intercept(ctx, { handle: () => of('ok') } as never)
        .subscribe();
    });
    span.end();

    const [exported] = exporter.getFinishedSpans();
    // Unset, not OK: the auto-instrumentation decides the real status from the
    // HTTP response, and forcing OK here would hide a 500 raised after the
    // handler returned.
    expect(exported.status.code).toBe(SpanStatusCode.UNSET);
    expect(exported.events.filter((e) => e.name === 'exception')).toHaveLength(
      0,
    );
  });

  it('marks a non-Error rejection too', () => {
    const span = tracer.startSpan('GET /storms');

    context.with(trace.setSpan(context.active(), span), () => {
      new TraceErrorInterceptor()
        .intercept(ctx, {
          handle: () => throwError(() => 'plain string'),
        } as never)
        .subscribe({ error: () => undefined });
    });
    span.end();

    const [exported] = exporter.getFinishedSpans();
    expect(exported.status.code).toBe(SpanStatusCode.ERROR);
    expect(exported.status.message).toBe('plain string');
  });
});
