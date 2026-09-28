import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiKeyVerifier, AuthChecker, AuthPrincipal } from './authz.ports.js';

/**
 * Asks the auth service whether a credential is good.
 *
 * The API's half of the arrangement: no JWT_SECRET, no users table, no
 * password hashes. What it has instead is a network call on the path of every
 * authenticated request, which is a real cost and the accepted one — auth being
 * the gate is the correct behaviour, not a fault to design around.
 *
 * Two details that matter more than they look:
 *
 * - **The reason is forwarded, not flattened.** A 401 saying "your session was
 *   closed because you signed in elsewhere" is actionable; a 401 saying
 *   "unauthorized" is not. The auth service's message is passed through as-is.
 * - **Nothing is cached.** Caching principals for a few seconds would remove
 *   most of the latency, at the cost of letting a superseded session keep
 *   working for the length of the TTL. Single-active-session is a deliberate
 *   feature, so that trade is not made silently. If it ever is, the TTL
 *   belongs in the config, not in a constant here.
 */
@Injectable()
export class HttpAuthChecker implements AuthChecker, ApiKeyVerifier {
  private readonly logger = new Logger(HttpAuthChecker.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('AUTH_SERVICE_URL', 'http://backend-auth:3008')
      .replace(/\/+$/, '');
    this.timeoutMs = Number(config.get('AUTH_SERVICE_TIMEOUT_MS', 5_000));
  }

  check(bearerToken: string): Promise<AuthPrincipal> {
    return this.post<AuthPrincipal>('/internal/auth/check', { token: bearerToken });
  }

  verify(apiKey: string): Promise<AuthPrincipal> {
    return this.post<AuthPrincipal>('/internal/auth/check-api-key', { apiKey });
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      /**
       * 503, not 401. A 401 tells the browser "log in again", which is wrong:
       * the token may be perfectly valid and what is down is the service that
       * would say so. Making a logged-in user re-authenticate because a
       * dependency is unavailable is its own kind of bug, and it hides the
       * outage behind a support ticket about broken logins.
       */
      this.logger.error(
        `auth service unreachable on ${path}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException('Authentication service unavailable');
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let message = 'Unauthorized';
      try {
        const parsed = JSON.parse(text) as { message?: string | string[] };
        if (Array.isArray(parsed.message)) message = parsed.message.join(', ');
        else if (parsed.message) message = parsed.message;
      } catch {
        // The upstream did not answer JSON; keep the generic message rather than
        // leaking a stack trace to the client.
      }
      throw new UnauthorizedException(message);
    }

    return (await response.json()) as T;
  }
}
