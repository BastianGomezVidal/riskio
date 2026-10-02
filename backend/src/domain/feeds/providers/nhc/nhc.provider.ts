import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BasinName } from '../../../../shared/basin/basin.js';

/** The per-advisory KMZ geometry products NHC publishes for each storm. */
export type AdvisoryProductKind = 'TRACK' | 'CONE' | 'WW';

const XML_ACCEPT = 'application/rss+xml, application/xml, text/xml';
const KMZ_ACCEPT = 'application/vnd.google-earth.kmz, application/zip';

/**
 * Fetches NHC feeds over HTTP.
 *
 * Normally used to pull basin summary RSS feeds, TCM forecast-advisory XML
 * documents and per-advisory KMZ geometry products. Base URL and timeout are
 * read from configuration, and every request carries a descriptive User-Agent
 * so NHC can identify the client.
 */
@Injectable()
export class NhcProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('NHC_BASE_URL')!;
    this.timeoutMs = config.get<number>('NHC_TIMEOUT_MS')!;
  }

  /**
   * Perform a single HTTP request against the configured base URL.
   *
   * @param path relative path such as `index-ep.xml`.
   * @param accept value for the HTTP Accept header.
   */
  private async request(
    path: string,
    accept: string,
  ): Promise<{ url: string; response: Response }> {
    // Each segment is checked, not the whole path.
    //
    // The segments are built from values parsed out of an NHC document, which
    // is remote input: an atcfId, a basin, a product kind. CodeQL flagged the
    // fetch below as `js/request-forgery` and was right to — an atcfId
    // containing `../` would walk the path and let the base URL point
    // somewhere else, and `@` or a colon would let it become an authority.
    //
    // `/` is allowed as a separator, because two of the three call sites build
    // a nested path (`xml/TCMEP4.xml`, `storm_graphics/api/...`) and a check
    // that rejected those would be a check that gets weakened later. So the
    // split happens first and each segment is validated on its own, which is
    // also what makes `..` rejectable: a character class alone cannot tell
    // `xml/TCMEP4.xml` from `../../../etc/passwd`, since both are made of
    // allowed characters. `.` and `..` are rejected explicitly for the same
    // reason, and a segment has to be non-empty, so `//` cannot smuggle one
    // past either.
    //
    // This is checked once, here, rather than at each call site: a caller that
    // forgets to validate is a bug, and a value validated twice is a value
    // that can drift between the two checks.
    const segments = path.split('/');
    if (
      segments.length === 0 ||
      segments.some(
        (s) => !/^[A-Za-z0-9._-]+$/.test(s) || s === '..' || s === '.',
      )
    ) {
      throw new Error(
        `Refusing to build an NHC URL from a path with unexpected characters: ${JSON.stringify(path)}`,
      );
    }

    // Rebuilt from the checked segments rather than reusing `path`, so the
    // string that reaches fetch is composed only of segments that passed. The
    // throw above means no unvalidated value exists past this line.
    const safePath = segments.join('/');

    const url = `${this.baseUrl}/${safePath}`;

    // Suppressed, with the reasoning above and in the commit: the taint model
    // for js/request-forgery does not recognise a split-and-check guard as a
    // sanitizer, so it keeps reporting a flow that is validated. Six tests
    // cover the shapes the query is worried about — `..` walking out of the
    // base path, `@` moving the authority, an absolute scheme, a query string —
    // and they fail if this guard is removed.
    // codeql[js/request-forgery] path segments are validated above, segment by segment
    const response = await fetch(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        'User-Agent': 'Riskio/0.1 (dev; contact: juanquindio@gmail.com)',
        Accept: accept,
      },
    });

    return { url, response };
  }

  /**
   * Fetch and return the raw text of an NHC XML document.
   *
   * @param path relative path like `index-ep.xml`.
   * @throws Error when the upstream returns a non-2xx status or when the
   *   request aborts after `NHC_TIMEOUT_MS`.
   */
  async fetchXml(path: string): Promise<string> {
    const { url, response } = await this.request(path, XML_ACCEPT);
    if (!response.ok) {
      throw new Error(`NHC returned ${response.status} for ${url}`);
    }
    return response.text();
  }

  /**
   * Fetch a basin's storm summary RSS feed (e.g. `index-ep.xml`).
   *
   * @param basin ocean basin where the storm is located, such as `at` for the Atlantic.
   */
  fetchBasinSummary(basin: BasinName): Promise<string> {
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

  /**
   * Fetch a per-advisory KMZ geometry product for a storm.
   *
   * Products are published at `storm_graphics/api/{ATCF}__{NNN}adv_{KIND}.kmz`,
   * e.g. `EP142026_005adv_TRACK.kmz`.
   *
   * @param atcfId ATCF identifier such as "EP142026".
   * @param advisoryNumber zero-padded to three digits in the product path.
   * @param kind the geometry product to fetch (`TRACK`, `CONE` or `WW`).
   * @returns the raw KMZ bytes, or `null` when upstream returns 404 — the
   *   Watch/Warning product is only published while a storm has active coastal
   *   watches or warnings.
   * @throws Error on any other non-2xx status or on timeout.
   */
  async fetchAdvisoryProduct(
    atcfId: string,
    advisoryNumber: number,
    kind: AdvisoryProductKind,
  ): Promise<Buffer | null> {
    const padded = String(advisoryNumber).padStart(3, '0');
    const path = `storm_graphics/api/${atcfId}_${padded}adv_${kind}.kmz`;
    const { url, response } = await this.request(path, KMZ_ACCEPT);

    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`NHC returned ${response.status} for ${url}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}
