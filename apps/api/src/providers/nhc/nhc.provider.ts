import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Ocean basins tracked by NHC's RSS index feeds. */
export type NhcBasin = 'at' | 'ep' | 'cp';

/**
 * Fetches NHC feeds over HTTP.
 *
 * Normally used to pull basin summary RSS feeds and TCM forecast-advisory
 * XML documents. Base URL and timeout are read from configuration, and every
 * request carries a descriptive User-Agent so NHC can identify the client.
 */
@Injectable()
export class NhcProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>(
      'NHC_BASE_URL',
      'https://www.nhc.noaa.gov',
    );
    this.timeoutMs = this.config.get<number>('NHC_TIMEOUT_MS', 10_000);
  }

  /**
   * Fetch and return the raw text of an NHC document.
   *
   * @param pathOrUrl relative path like `index-ep.xml` (resolved against the
   *   configured base URL) or a full `https` URL passed through unchanged.
   * @throws Error when the upstream returns a non-2xx status or when the
   *   request aborts after `NHC_TIMEOUT_MS`.
   */
  async fetchXml(pathOrUrl: string): Promise<string> {
    const url = pathOrUrl.startsWith('https')
      ? pathOrUrl
      : `${this.baseUrl}/${pathOrUrl}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Riskio/0.1 (dev; contact: juanquindio@gmail.com)',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      });
      if (!res.ok) {
        throw new Error(`NHC returned ${res.status} for ${url}`);
      }
      return await res.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fetch a basin's storm summary RSS feed (e.g. `index-ep.xml`).
   *
   * @param basin one of the {@link NhcBasin} identifiers.
   */
  fetchBasinSummary(basin: NhcBasin): Promise<string> {
    return this.fetchXml(`index-${basin}.xml`);
  }

  /**
   * Fetch the TCM forecast-advisory XML for a wallet.
   *
   * @param wallet NHC wallet identifier such as "EP4", "AL1" or "CP5" —
   *   matched to feeds like `xml/TCMEP4.xml`.
   */
  fetchForecastAdvisory(wallet: string): Promise<string> {
    return this.fetchXml(`xml/TCM${wallet.toUpperCase()}.xml`);
  }
}
