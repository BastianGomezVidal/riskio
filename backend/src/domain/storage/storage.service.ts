/**
 * Storage contract, as the rest of the system sees it.
 *
 * Three operations, and the shape is chosen by what callers actually need:
 * upload bytes and get back a URL, delete by key, and turn a URL back into a
 * key. There is deliberately no "build a URL from a key" here — the public URL
 * belongs to whichever bucket is configured, so callers ask for it instead of
 * assembling it and getting it subtly wrong for a different endpoint.
 *
 * Two implementations, on purpose: S3StorageService inside the storage service,
 * and an HTTP client in the API. The API never holds storage credentials, and
 * the storage service never holds a database connection.
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

  /**
   * Extract the object key from a full public URL, or null if it does not match.
   *
   * Async because it is a network call now that the implementation lives in
   * another service, and a URL can no longer be sliced locally without
   * duplicating a format that the storage service owns.
   */
  extractKey(url: string): Promise<string | null>;
}
