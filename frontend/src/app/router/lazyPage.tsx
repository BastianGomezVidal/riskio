import { lazy } from "react";
import type { ComponentType } from "react";

type ModuleExports = Record<string, unknown>;

/**
 * Loads a page on demand and picks its named export.
 *
 * Every page exports a named function, so this keeps the route table to one
 * line per route and makes it obvious at a glance which routes are split out
 * of the initial chunk.
 */
export function lazyPage<M extends ModuleExports>(
  load: () => Promise<M>,
  name: keyof M & string,
): ComponentType {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}
