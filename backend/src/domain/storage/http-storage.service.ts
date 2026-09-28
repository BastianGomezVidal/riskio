import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StorageService } from './storage.service.js';

/**
 * Talks to the storage service over HTTP.
 *
 * This is the only storage code left in the API. Before the extraction it held
 * the AWS SDK and the bucket credentials, which meant the API's blast radius
 * included the storage account: anything that could execute code in the API
 * could read and write every object. Now the worst case is "can talk to four
 * endpoints on an internal service", and the credentials live in one container
 * that holds no user data.
 *
 * Bytes go base64-encoded in JSON, matching the service. Avatars are small, so
 * the 33% overhead is cheaper than a second content type and a streaming parser
 * to keep.
 */
@Injectable()
export class HttpStorageService implements StorageService {
  private readonly logger = new Logger(HttpStorageService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>('STORAGE_API_URL', 'http://storage:3004')
      .replace(/\/+$/, '');
    // Number(), because ConfigService does not coerce: everything it reads
    // from the environment is a string, whatever the generic claims. Handing
    // "5000" to AbortSignal.timeout throws a TypeError, and it throws on the
    // first call, in a way that looks like a storage outage rather than a
    // config bug.
    this.timeoutMs = Number(config.get('STORAGE_API_TIMEOUT_MS', 5_000));
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const { url } = await this.request<{ url: string }>('/files', {
      method: 'POST',
      body: JSON.stringify({
        key,
        contentBase64: buffer.toString('base64'),
        contentType,
      }),
    });
    return url;
  }

  async delete(key: string): Promise<void> {
    // The key is a path segment. Encoding it matters: avatar keys contain a
    // user id, and an unencoded '/' or '..' would address a different object
    // than the one being deleted.
    await this.request(`/files/${encodeURIComponent(key)}`, { method: 'DELETE' });
  }

  async extractKey(url: string): Promise<string | null> {
    const { key } = await this.request<{ key: string | null }>(
      `/files/extract?url=${encodeURIComponent(url)}`,
      { method: 'GET' },
    );
    return key;
  }

  /**
   * Every call goes through here so the timeout and the error message are
   * uniform. Without the timeout a wedged storage service would hold the
   * request open until the client gave up, which is how one slow dependency
   * becomes an outage of everything upstream of it.
   */
  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { 'Content-Type': 'application/json', ...init.headers },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `storage service returned ${response.status} for ${init.method} ${path}: ${body.slice(0, 200)}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error(
          `storage service timed out after ${this.timeoutMs}ms on ${init.method} ${path}`,
        );
      }
      this.logger.error(
        `storage call failed: ${init.method} ${path} — ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
