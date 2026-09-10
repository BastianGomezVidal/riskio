import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { NhcProvider } from './nhc.provider.js';

describe('NhcProvider', () => {
  let provider: NhcProvider;
  const fetchMock = vi.fn();

  function makeProvider(overrides: Record<string, unknown> = {}) {
    const config = {
      get: (key: string, fallback?: unknown) =>
        overrides[key] ?? fallback,
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

    await provider.fetchBasinSummary('ep');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.nhc.noaa.gov/index-ep.xml',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('fetches a TCM forecast advisory for a wallet', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<rss/>',
    });

    await provider.fetchForecastAdvisory('EP4');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.nhc.noaa.gov/xml/TCMEP4.xml',
      expect.anything(),
    );
  });

  it('uses the configured base URL and timeout', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });
    const providerWithCfg = makeProvider({
      NHC_BASE_URL: 'https://example.test',
      NHC_TIMEOUT_MS: 5000,
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
      text: async () => 'unavailable',
    });

    await expect(provider.fetchBasinSummary('at')).rejects.toThrow(
      'NHC returned 503',
    );
  });

  it('aborts the request when the configured timeout elapses', async () => {
    vi.useFakeTimers();
    try {
      const providerWithCfg = makeProvider({ NHC_TIMEOUT_MS: 100 });
      fetchMock.mockImplementation(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new Error('The operation was aborted')),
            );
          }),
      );

      const pending = providerWithCfg.fetchBasinSummary('at');
      const assertion = expect(pending).rejects.toThrow('aborted');
      await vi.advanceTimersByTimeAsync(150);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('passes a full https URL through unchanged', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    });

    await provider.fetchXml('https://other.example.com/feed.xml');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://other.example.com/feed.xml',
      expect.anything(),
    );
  });
});