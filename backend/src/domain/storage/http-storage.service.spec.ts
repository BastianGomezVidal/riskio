import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpStorageService } from './http-storage.service.js';

/**
 * The API stopped speaking S3 and now speaks HTTP to a service it does not
 * control the internals of. These tests are about the parts that go wrong
 * quietly: a key that addresses the wrong object, a storage service that
 * wedges, and an error whose message does not say which call failed.
 */
describe('HttpStorageService', () => {
  // Strings on purpose, because that is what ConfigService hands back for
  // anything coming from the environment. A mock returning a number here hid
  // a real bug: AbortSignal.timeout("5000") throws a TypeError on the first
  // request, which reads as a storage outage and is not one.
  const config = {
    get: (key: string, fallback?: unknown) =>
      ({
        STORAGE_API_URL: 'http://storage:3004/',
        STORAGE_API_TIMEOUT_MS: '5000',
      })[key] ?? fallback,
  } as never;

  let service: HttpStorageService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    service = new HttpStorageService(config);
  });

  afterEach(() => vi.unstubAllGlobals());

  const ok = (body: unknown) => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  it('strips a trailing slash so paths never double up', async () => {
    fetchMock.mockResolvedValue(ok({ url: 'http://cdn/a.png' }));
    await service.upload('a.png', Buffer.from('x'), 'image/png');

    expect(fetchMock.mock.calls[0][0]).toBe('http://storage:3004/files');
  });

  it('sends bytes base64-encoded with the key and content type', async () => {
    fetchMock.mockResolvedValue(ok({ url: 'http://cdn/avatars/1.png' }));
    const url = await service.upload(
      'avatars/1.png',
      Buffer.from('hola'),
      'image/png',
    );

    expect(url).toBe('http://cdn/avatars/1.png');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      key: 'avatars/1.png',
      contentBase64: Buffer.from('hola').toString('base64'),
      contentType: 'image/png',
    });
  });

  /**
   * The one that would matter most. Avatar keys are built from a user id, and
   * an unencoded separator would let a delete address a different object than
   * the one the caller meant — deleting someone else's avatar.
   */
  it('encodes the key into the delete path', async () => {
    fetchMock.mockResolvedValue(ok({ deleted: true }));
    await service.delete('avatars/a b/../2.png');

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe(
      'http://storage:3004/files/' + encodeURIComponent('avatars/a b/../2.png'),
    );
    expect(url).not.toContain('/../');
  });

  it('returns the extracted key, and null when the service finds none', async () => {
    fetchMock.mockResolvedValueOnce(ok({ key: 'avatars/9.png' }));
    await expect(service.extractKey('http://cdn/avatars/9.png')).resolves.toBe(
      'avatars/9.png',
    );

    fetchMock.mockResolvedValueOnce(ok({ key: null }));
    await expect(
      service.extractKey('http://otro/cdn/x.png'),
    ).resolves.toBeNull();
  });

  it('passes the url through encoded in the query', async () => {
    fetchMock.mockResolvedValue(ok({ key: null }));
    await service.extractKey('http://cdn/a.png?x=1&y=2');

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('url=http%3A%2F%2Fcdn%2Fa.png%3Fx%3D1%26y%3D2');
  });

  /**
   * A failed status has to name the call. "Request failed" from a service four
   * hops away turns a five-minute investigation into a guessing game.
   */
  it('reports the status, method and path on a failed call', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => 'bucket on fire',
    });

    await expect(
      service.upload('a.png', Buffer.from('x'), 'image/png'),
    ).rejects.toThrow(/500.*POST \/files.*bucket on fire/s);
  });

  /**
   * The regression test for a bug this file shipped with: ConfigService hands
   * back the env var as a string, and AbortSignal.timeout("5000") throws a
   * TypeError. Every avatar upload failed with a 500 that read as a storage
   * outage. Asserting the argument is the only thing that catches it — the
   * other timeout test mocks the rejection, so it passes either way.
   */
  it('coerces the configured timeout to a number', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    fetchMock.mockResolvedValue(ok({ url: 'http://cdn/a.png' }));

    await service.upload('a.png', Buffer.from('x'), 'image/png');

    expect(spy).toHaveBeenCalledWith(5000);
    expect(typeof spy.mock.calls[0][0]).toBe('number');
    spy.mockRestore();
  });

  it('applies a timeout, so a wedged service cannot hold the request open', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      // Reproduce what fetch does when AbortSignal.timeout fires.
      const error = new Error('The operation was aborted due to timeout');
      error.name = 'TimeoutError';
      void init.signal;
      return Promise.reject(error);
    });

    await expect(
      service.upload('a.png', Buffer.from('x'), 'image/png'),
    ).rejects.toThrow(/timed out after 5000ms/);
  });
});
