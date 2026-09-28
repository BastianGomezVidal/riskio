import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeedsClientService } from './feeds-client.service.js';

/**
 * The difference from the cache client, on purpose: these calls are not
 * swallowed. A manual trigger that reports success while nothing was ingested is
 * precisely the failure the fixture tool was built to make visible, so an error
 * has to reach the caller instead of turning into an empty report.
 */
describe('FeedsClientService', () => {
  const config = {
    get: (key: string, fallback?: unknown) =>
      ({
        FEEDS_SERVICE_URL: 'http://feeds:3006/',
        FEEDS_SERVICE_TIMEOUT_MS: '120000',
      })[key] ?? fallback,
  } as never;

  let service: FeedsClientService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    service = new FeedsClientService(config);
  });

  afterEach(() => vi.unstubAllGlobals());

  const ok = (body: unknown) => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  it('asks for all basins and returns the reports', async () => {
    const reports = [{ basin: 'ep', stormsSeen: 1, advisoriesInserted: 1 }];
    fetchMock.mockResolvedValue(ok(reports));

    await expect(service.ingestAllBasins()).resolves.toEqual(reports);
    expect(fetchMock.mock.calls[0][0]).toBe('http://feeds:3006/ingest/run');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('encodes the basin in the path', async () => {
    fetchMock.mockResolvedValue(ok({ basin: 'ep' }));

    await service.ingestBasin('ep');

    expect(fetchMock.mock.calls[0][0]).toBe('http://feeds:3006/ingest/run/ep');
  });

  it('propagates a failure instead of returning an empty report', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    // Swallowing this would report an empty ingestion as a successful one.
    await expect(service.ingestAllBasins()).rejects.toThrow('ECONNREFUSED');
  });

  it('names the status and the body on a failed response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => 'basin=ep NHC returned 503',
    });

    await expect(service.ingestAllBasins()).rejects.toThrow(
      /500 on POST \/ingest\/run.*NHC returned 503/s,
    );
  });

  it('coerces the timeout to a number', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    fetchMock.mockResolvedValue(ok([]));

    await service.ingestAllBasins();

    expect(spy).toHaveBeenCalledWith(120000);
    expect(typeof spy.mock.calls[0][0]).toBe('number');
    spy.mockRestore();
  });
});
