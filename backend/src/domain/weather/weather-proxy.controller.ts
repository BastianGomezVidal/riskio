import { All, Controller, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

/**
 * Forwards the weather routes to the weather service.
 *
 * This is the "gateway" role and nothing else: no query is written here, no
 * entity is mapped, and there is no database connection. The browser calls
 * `/storms` on the API because that is the only origin it is configured with,
 * and this is the hop that gets it to the service that owns the data.
 *
 * It is deliberately not a dependency of the other API modules. Auth, users and
 * the dashboard never route through weather, so a weather outage fails these
 * routes and the ingestion trigger's service, and nothing else — which is the
 * isolation the extraction was for. What this proxy does cost is one extra hop
 * on the browser path for storms, and it is worth naming that rather than
 * pretending the browser no longer touches the API.
 *
 * Streams the response body through untouched instead of re-serialising it, so
 * there is no second place where the shape of a storm is defined.
 */
@Controller()
export class WeatherProxyController {
  private readonly logger = new Logger(WeatherProxyController.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('WEATHER_SERVICE_URL', 'http://backend-weather:3007')
      .replace(/\/+$/, '');
    this.timeoutMs = Number(config.get('WEATHER_SERVICE_TIMEOUT_MS', 5_000));
  }

  @All('/storms')
  storms(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.forward(req, res, `${this.baseUrl}/storms`);
  }

  @All('/storms/:atcfId')
  storm(@Param('atcfId') atcfId: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    return this.forward(req, res, `${this.baseUrl}/storms/${encodeURIComponent(atcfId)}`);
  }

  @All('/storms/:atcfId/advisories/:n')
  stormAdvisory(
    @Param('atcfId') atcfId: string,
    @Param('n') n: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    return this.forward(
      req,
      res,
      `${this.baseUrl}/storms/${encodeURIComponent(atcfId)}/advisories/${encodeURIComponent(n)}`,
    );
  }

  @All('/advisories/:id')
  advisory(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    return this.forward(req, res, `${this.baseUrl}/advisories/${encodeURIComponent(id)}`);
  }

  private async forward(
    req: Request,
    res: Response,
    target: string,
  ): Promise<void> {
    const query = req.originalUrl.includes('?')
      ? req.originalUrl.slice(req.originalUrl.indexOf('?'))
      : '';
    const url = `${target}${query}`;

    try {
      // The bearer token is forwarded as-is: the weather service does not
      // authenticate, and dropping the header would only hide that.
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
        .setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json')
        .send(body);
    } catch (error) {
      /**
       * 502 rather than a thrown error, and it names the service. A weather
       * outage surfacing as a generic 500 was the ambiguity this whole
       * extraction is meant to remove.
       */
      this.logger.error(
        `weather proxy failed for ${req.method} ${url}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      res
        .status(502)
        .json({
          statusCode: 502,
          error: 'Bad Gateway',
          message: 'the weather service is unavailable',
        });
    }
  }
}
