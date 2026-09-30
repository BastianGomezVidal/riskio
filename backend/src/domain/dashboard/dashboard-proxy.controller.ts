import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation } from '@nestjs/swagger';

/**
 * Forwards `/dashboard` to the dashboard service.
 *
 * Same gateway role, and for the same reason, as the weather and auth routes:
 * the browser is configured with one origin, the dashboard lives in its own
 * service, and this is the hop that gets it there. What the browser stops
 * doing is depend on this process for the payload itself.
 *
 * The token is forwarded as-is and the response is streamed through untouched
 * rather than re-serialised, so there is never a second place where the shape
 * of a summary is defined. Only the route table here is new.
 */
@Controller()
export class DashboardProxyController {
  private readonly logger = new Logger(DashboardProxyController.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('DASHBOARD_SERVICE_URL', 'http://backend-dashboard:3009')
      .replace(/\/+$/, '');
    this.timeoutMs = Number(config.get('DASHBOARD_SERVICE_TIMEOUT_MS', 5_000));
  }

  /**
   * The bare path, plus everything under it.
   *
   * A single `@All('/dashboard')` matches only that exact path, and the first
   * version did exactly that: `/dashboard/summary` fell through to Nest's 404
   * and the route looked like it had never been registered. The weather proxy
   * avoids this by declaring one handler per sub-path, which means every future
   * sub-route is another line to remember. A splat and the original URL handle
   * the whole prefix instead, and cannot drift out of date.
   */
  @All('/dashboard')
  @ApiOperation({
    summary: 'Dashboard summary',
    description:
      'Aggregated counts and the active advisory list. The splat route below ' +
      'covers the rest of the prefix, so sub-routes appear here without a ' +
      'code change.',
    tags: ['dashboard'],
  })
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ description: 'Aggregated dashboard payload' })
  bare(@Req() req: Request, @Res() res: Response): void {
    void this.forward(req, res, `${this.baseUrl}${req.originalUrl}`);
  }

  @All('/dashboard/*splat')
  @ApiOperation({
    summary: 'Any other dashboard sub-resource',
    description:
      'Declared because the splat exists to keep sub-routes from 404ing. ' +
      'Known today: /dashboard/summary.',
    tags: ['dashboard'],
  })
  @ApiBearerAuth('bearer')
  @ApiOkResponse({ description: 'Dashboard sub-resource payload' })
  summary(@Req() req: Request, @Res() res: Response): void {
    // originalUrl already carries the path and the query string, so the
    // upstream URL is the base plus the request, unchanged.
    void this.forward(req, res, `${this.baseUrl}${req.originalUrl}`);
  }

  private async forward(
    req: Request,
    res: Response,
    url: string,
  ): Promise<void> {
    try {
      const upstream = await fetch(url, {
        method: req.method,
        headers: {
          accept: req.headers.accept ?? 'application/json',
          ...(req.headers.authorization
            ? { authorization: req.headers.authorization }
            : {}),
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const body = await upstream.text();
      res
        .status(upstream.status)
        .setHeader(
          'content-type',
          upstream.headers.get('content-type') ?? 'application/json',
        )
        .send(body);
    } catch (error) {
      /**
       * 502, and the message names the dashboard. A service outage surfacing as
       * a generic 500 is the ambiguity these extractions exist to remove.
       */
      this.logger.error(
        `dashboard proxy failed for ${req.method} ${url}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      res.status(502).json({
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'the dashboard service is unavailable',
      });
    }
  }
}
