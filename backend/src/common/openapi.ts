import { SwaggerModule } from '@nestjs/swagger';
import { DocumentBuilder } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject, OperationObject } from '@nestjs/swagger';

/**
 * Tags whose routes are gateway proxies.
 *
 * Everything under these is forwarded with `@All()`, so Nest emits GET, POST,
 * PUT, DELETE and PATCH for each path. Thirty of the thirty-nine operations the
 * document used to contain were that artefact: the app only ever reads storms,
 * advisories and the dashboard, and a document claiming the API accepts
 * `DELETE /storms/{atcfId}` is worse than no document, because it is a contract
 * nobody intends to honour.
 *
 * Keyed by tag rather than by path so a new proxied route is covered the moment
 * it is tagged, instead of needing to be added to a list here.
 */
const PROXY_TAGS = new Set(['storms', 'advisories', 'dashboard']);

/** HTTP methods `@All()` expands to, minus the one that is actually the contract. */
const KEEP_FOR_PROXY = 'get';

/**
 * Build the OpenAPI document for a service.
 *
 * Shared by the API and the auth service because the auth endpoints are the
 * ones the browser actually authenticates against, and they live behind
 * `AuthProxyMiddleware` in a process whose controllers Nest never introspects —
 * so the gateway document alone could never describe them, and its own bearer
 * scheme helpfully pointed at a `POST /auth/login` that was not in the document.
 */
export interface OpenApiOptions {
  title: string;
  description: string;
  /** Tags this service actually serves. Anything else is left out entirely. */
  tags: { name: string; description: string }[];
  /**
   * Path prefixes to leave out of the document.
   *
   * For the service-to-service endpoints: reachable only over the compose
   * network, but a document that lists `/internal/auth/check` is an invitation,
   * and it is the one endpoint in the set where a caller passing the wrong thing
   * gets a decision about somebody else's session.
   *
   * Applied after the document is built. `DocumentBuilder` in v12 has no
   * `excludeController` and `SwaggerDocumentOptions` has no `ignore`, so there
   * is no supported way to ask Nest to skip a controller; deleting the paths
   * here is the part of the pipeline already responsible for shaping the
   * document.
   */
  excludePaths?: string[];
}

export function buildOpenApi(
  app: INestApplication,
  options: OpenApiOptions,
): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle(options.title)
    .setDescription(options.description)
    .setVersion('1.0.0')
    .addServer('/', 'This service');

  /**
   * Tags are declared per service. One shared list left every document with
   * orphans: the auth service advertised `storms` and `dashboard` under headings
   * with nothing in them, which reads as "this service serves storms" and is the
   * sort of thing somebody trusts at 2am. `addTag` returns the builder, so this
   * could be a `.map()`, but a loop says the intent better than chaining here.
   */
  for (const tag of options.tags) {
    builder.addTag(tag.name, tag.description);
  }

  /**
   * Without this the Authorize button does not exist, and every operation
   * annotated `@ApiBearerAuth()` was pointing at a scheme that was never
   * registered.
   */
  builder.addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'Access token from the login endpoint. Valid for any account; the ' +
        'admin role is only required by the /admin endpoints.',
    },
    'bearer',
  );

  const document = SwaggerModule.createDocument(app, builder.build());
  for (const prefix of options.excludePaths ?? []) {
    removePathsWithPrefix(document, prefix);
  }
  stripProxyMethods(document);
  return document;
}

/**
 * Drop every method but GET from proxy-tagged operations.
 *
 * The routes still accept anything at runtime, which is the point of a
 * pass-through; this only stops the document from claiming they do.
 */
function stripProxyMethods(document: OpenAPIObject): void {
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (method === 'parameters') continue;
      const op = operation as OperationObject;
      const tags = op.tags ?? [];
      if (!tags.some((tag) => PROXY_TAGS.has(tag))) continue;
      if (method === KEEP_FOR_PROXY) continue;
      delete (pathItem as Record<string, unknown>)[method];
    }
  }
}

/** Remove every path starting with `prefix`, e.g. `/internal/`. */
function removePathsWithPrefix(document: OpenAPIObject, prefix: string): void {
  const paths = document.paths;
  if (!paths) return;
  for (const path of Object.keys(paths)) {
    if (path === prefix || path.startsWith(prefix)) {
      delete paths[path];
    }
  }
}
