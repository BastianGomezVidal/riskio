import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type NhcBasin = 'at' | 'ep' | 'cp';

@Injectable()
export class NhcProvider {
  private readonly logger = new Logger(NhcProvider.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>(
      'NHC_BASE_URL',
      'https://www.nhc.noaa.gov',
    );
    this.timeoutMs = this.config.get<number>('NHC_TIMEOUT_MS', 10_000);
  }

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

  fetchBasinSummary(basin: NhcBasin): Promise<string> {
    return this.fetchXml(`index-${basin}.xml`);
  }

  /**
   * Fetch the TCM forecast advisory for a wallet.
   * Wallet format from NHC: "EP4", "AL1", "CP5"
   * URL format: xml/TCMEP4.xml
   */
  fetchForecastAdvisory(wallet: string): Promise<string> {
    return this.fetchXml(`xml/TCM${wallet.toUpperCase()}.xml`);
  }
}
