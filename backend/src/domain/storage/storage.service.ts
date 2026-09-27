/**
 * Storage abstraction over S3-compatible services.
 *
 * Implemented by S3StorageService, which speaks both MinIO (local dev)
 * and AWS S3 (production) via the same SDK. Only configuration changes
 * between environments.
 */
export interface StorageService {
  /**
   * Upload a file to the configured bucket.
   * @param key path within the bucket, e.g. "avatars/{userId}.png"
   * @param buffer file bytes
   * @param contentType MIME type (e.g. "image/png")
   * @returns the public URL of the uploaded file
   */
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;

  /** Delete a file from the bucket. Silently succeeds if not present. */
  delete(key: string): Promise<void>;

  /** Get the public URL of a file without checking existence. */
  getUrl(key: string): string;

  /** Extract the object key from a full public URL, or null if it does not match. */
  extractKey(url: string): string | null;
}
