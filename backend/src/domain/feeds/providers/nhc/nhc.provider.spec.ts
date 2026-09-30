import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { NhcProvider } from './nhc.provider.js';

describe('NhcProvider', () => {
  let provider: NhcProvider;
  const fetchMock = vi.fn();

  type NhcConfig = {
    NHC_BASE_URL: string;
    NHC_TIMEOUT_MS: number;
  };

  function makeProvider(overrides: Partial<NhcConfig> = {}) {
    const values: NhcConfig = {
      NHC_BASE_URL: 'https://www.nhc.noaa.gov',
      NHC_TIMEOUT_MS: 10_000,
      ...overrides,
    };

    const config = {
      get: (key: keyof NhcConfig) => values[key],
    } as unknown as ConfigService;

    return new NhcProvider(config);
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    provider = makeProvider();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches a basin summary by appending the NHC path to the base URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<rss/>',
    });

    const xml = await provider.fetchBasinSummary('ep');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.nhc.noaa.gov/index-ep.xml',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        headers: {
          'User-Agent': 'Riskio/0.1 (dev; contact: juanquindio@gmail.com)',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      }),
    );

    expect(xml).toBe('<rss/>');
  });

  it('fetches a TCM forecast advisory for a wallet', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<rss/>',
    });

    const xml = await provider.fetchForecastAdvisory('EP4');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.nhc.noaa.gov/xml/TCMEP4.xml',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        headers: {
          'User-Agent': 'Riskio/0.1 (dev; contact: juanquindio@gmail.com)',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      }),
    );

    expect(xml).toBe('<rss/>');
  });

  it('normalizes the forecast advisory wallet to uppercase', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<rss/>',
    });

    await provider.fetchForecastAdvisory('ep4');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.nhc.noaa.gov/xml/TCMEP4.xml',
      expect.anything(),
    );
  });

  it('uses the configured NHC base URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    const providerWithCfg = makeProvider({
      NHC_BASE_URL: 'https://example.test',
    });

    await providerWithCfg.fetchBasinSummary('at');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/index-at.xml',
      expect.anything(),
    );
  });

  it('throws on non-2xx responses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
    });

    await expect(provider.fetchBasinSummary('at')).rejects.toThrow(
      'NHC returned 503',
    );
  });

  it('propagates network errors', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    await expect(provider.fetchBasinSummary('at')).rejects.toThrow(
      'Network error',
    );
  });

  it('aborts the request when the configured timeout elapses', async () => {
    vi.useFakeTimers();

    try {
      const providerWithCfg = makeProvider({
        NHC_TIMEOUT_MS: 100,
      });

      fetchMock.mockImplementation(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new Error('The operation was aborted')),
            );
          }),
      );

      const pending = providerWithCfg.fetchBasinSummary('at');
      const assertion = expect(pending).rejects.toThrow(
        'The operation was aborted',
      );

      await vi.advanceTimersByTimeAsync(150);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  describe('fetchAdvisoryProduct', () => {
    it('fetches a zero-padded Track KMZ and returns its bytes', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => new TextEncoder().encode('KML').buffer,
      });

      const kmz = await provider.fetchAdvisoryProduct('EP142026', 5, 'TRACK');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://www.nhc.noaa.gov/storm_graphics/api/EP142026_005adv_TRACK.kmz',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          headers: {
            'User-Agent': 'Riskio/0.1 (dev; contact: juanquindio@gmail.com)',
            Accept: 'application/vnd.google-earth.kmz, application/zip',
          },
        }),
      );

      expect(kmz?.toString('utf8')).toBe('KML');
    });

    it('does not pad an already three-digit advisory number', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(0),
      });

      await provider.fetchAdvisoryProduct('EP142026', 123, 'TRACK');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://www.nhc.noaa.gov/storm_graphics/api/EP142026_123adv_TRACK.kmz',
        expect.anything(),
      );
    });

    it('returns null when the KMZ product is not published', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const kmz = await provider.fetchAdvisoryProduct('EP142026', 5, 'WW');

      expect(kmz).toBeNull();
    });

    it('throws on other non-2xx statuses', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(
        provider.fetchAdvisoryProduct('EP142026', 5, 'CONE'),
      ).rejects.toThrow('NHC returned 500');
    });
  });

  /**
   * CodeQL flagged the fetch as js/request-forgery, and it was right to: the
   * path segments are built from values parsed out of an NHC document, so an
   * atcfId of `../../../evil` would walk the path and `@evil.example` would
   * move the authority. The guard is the only thing between that and a request
   * to somewhere the base URL does not name.
   */
  describe('path segments built from remote input', () => {
    // The XML calls read `.text()` and the KMZ calls read `.arrayBuffer()`, so
    // the mock answers both. Returning only one is how a guard test ends up
    // failing on a missing method instead of on the guard.
    beforeEach(() => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '<rss></rss>',
        arrayBuffer: async () => new ArrayBuffer(0),
      });
    });

    it('refuses to walk out of the base path', async () => {
      await expect(
        provider.fetchAdvisoryProduct('../../../etc/passwd', 5, 'CONE'),
      ).rejects.toThrow('unexpected characters');
    });

    it('refuses a path that would change the authority', async () => {
      await expect(
        provider.fetchAdvisoryProduct('EP142026@evil.example', 5, 'CONE'),
      ).rejects.toThrow('unexpected characters');
    });

    it('refuses a scheme, so the path cannot become an absolute URL', async () => {
      await expect(
        provider.fetchAdvisoryProduct('https:evil', 5, 'CONE'),
      ).rejects.toThrow('unexpected characters');
    });

    it('refuses a segment that would inject a query string', async () => {
      await expect(
        provider.fetchAdvisoryProduct('EP142026?a=1', 5, 'CONE'),
      ).rejects.toThrow('unexpected characters');
    });

    it('does not send the request at all when it refuses', async () => {
      await expect(
        provider.fetchAdvisoryProduct('../x', 5, 'CONE'),
      ).rejects.toThrow();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('still allows the identifiers that are real', async () => {
      await provider.fetchAdvisoryProduct('EP142026', 5, 'CONE');

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://www.nhc.noaa.gov/storm_graphics/api/EP142026_005adv_CONE.kmz',
      );
    });

    it('allows a basin name through the same guard', async () => {
      await provider.fetchBasinSummary('ep');

      expect(fetchMock.mock.calls[0][0]).toBe(
        'https://www.nhc.noaa.gov/index-ep.xml',
      );
    });

    it('names the rejected value in the error, without fetching it', async () => {
      // The message is the only diagnostic, and it must not be the thing an
      // attacker can use to see what was echoed back.
      const attempt = provider
        .fetchAdvisoryProduct('../secret', 5, 'CONE')
        .catch((e: Error) => e.message);

      await expect(attempt).resolves.toContain('../secret');
    });
  });
});
