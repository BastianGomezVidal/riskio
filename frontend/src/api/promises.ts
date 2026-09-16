import { api, type Paginated, type Storm } from "./client";

/**
 * Module-level promise cache so components can read resources with React's
 * `use(promise)` hook and let a <Suspense> boundary handle the pending state.
 */
let stormsPromise: Promise<Paginated<Storm>> | null = null;
export function preloadStorms(): Promise<Paginated<Storm>> {
  stormsPromise ??= api.storms();
  return stormsPromise;
}
export function resetStorms(): void {
  stormsPromise = null;
}

let healthPromise: Promise<{ status: string }> | null = null;
export function preloadHealth(): Promise<{ status: string }> {
  healthPromise ??= api.health();
  return healthPromise;
}
export function resetHealth(): void {
  healthPromise = null;
}