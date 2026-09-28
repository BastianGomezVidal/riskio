import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * Marks the server span as failed and records the exception on it.
 *
 * Without this the auto-instrumentation only sees that a response came back,
 * so a 500 reaches Jaeger looking identical to a 200. That matters more than it
 * sounds: tail sampling keeps every span whose status is error, and this is
 * what decides whether a failing request is kept or dropped.
 */
@Injectable()
export class TraceErrorInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        const span = trace.getSpan(context.active());
        if (span) {
          // Jaeger's search filters on these, so an error is findable by route
          // and method without opening every trace.
          const request = _context.switchToHttp().getRequest();
          if (request?.method) {
            span.setAttribute('http.request.method', request.method);
          }
          if (request?.route?.path) {
            span.setAttribute('http.route', request.route.path);
          }
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          if (error instanceof Error) {
            span.recordException(error);
          }
        }
        return throwError(() => error);
      }),
    );
  }
}
