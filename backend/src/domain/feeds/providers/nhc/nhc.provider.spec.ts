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
});
