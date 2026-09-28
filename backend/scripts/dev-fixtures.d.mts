/**
 * Types for the dev fixture server, which is plain JavaScript on purpose: it is
 * a developer utility run with bare `node`, and giving it a build step would mean
 * a dist copy that has to be rebuilt before it can be used.
 */
export interface AdvisoryLookup {
  max: number | null;
}
export declare function maxAdvisoryInDatabase(
  stormAtcfId: string,
  options?: {
    url?: string;
    query?: (stormAtcfId: string) => Promise<Array<{ n: string | number | null }>>;
  },
): Promise<AdvisoryLookup | { unavailable: string }>;
export declare function nextAdvisory(options?: {
  explicit?: string | number;
  outDir?: string;
  stormAtcfId?: string;
  query?: (stormAtcfId: string) => Promise<Array<{ n: string | number | null }>>;
}): Promise<number>;
