import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import type { ApiToken } from './entities/api-token.entity.js';
import type { User } from './entities/user.entity.js';

/**
 * The three `/auth/tokens` endpoints had no spec at all (D16), and the gap was
 * not academic: `listApiTokens` returned its entities, and an `ApiToken` carries
 * `tokenHash`, so every browser that opened the token list received a
 * password-equivalent verifier. The first test here is the one that would have
 * caught it.
 *
 * These are unit tests over fakes. What they pin down is the response shape and
 * the ownership scoping, which is where the bugs were; wiring is the
 * integration suite's job.
 */
describe('AuthService API tokens', () => {
  let service: AuthService;
  let tokens: {
    find: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  const userId = '11111111-1111-4111-8111-111111111111';

  function makeRow(overrides: Partial<ApiToken> = {}): ApiToken {
    return {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'ci',
      tokenHash: 'a'.repeat(64),
      prefix: 'm5JbBHVA',
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      updatedAt: new Date('2026-01-02T03:04:05.000Z'),
      lastUsedAt: null,
      revokedAt: null,
      user: { id: userId } as User,
      ...overrides,
    } as ApiToken;
  }

  beforeEach(() => {
    tokens = {
      find: vi.fn(),
      save: vi.fn((row: ApiToken) => Promise.resolve(row)),
      // Stands in for @PrimaryGeneratedColumn('uuid'): the row comes back from
      // create() already carrying an id, and a fake that omits it fails on the
      // response assertions for reasons that have nothing to do with the code.
      create: vi.fn((row: ApiToken) => ({
        ...row,
        id: '44444444-4444-4444-8444-444444444444',
        createdAt: new Date('2026-01-02T03:04:05.000Z'),
      })),
      update: vi.fn(),
    };

    service = new AuthService(
      { findOne: vi.fn() } as unknown as Repository<User>,
      tokens as unknown as Repository<ApiToken>,
      { find: vi.fn(), save: vi.fn() } as unknown as Repository<never>,
      { sign: vi.fn() } as never,
      new ConfigService({
        ADMIN_EMAILS: '',
        FRONTEND_URL: 'http://localhost:5173',
      }),
      { exchange: vi.fn() } as never,
      { sendPasswordResetLink: vi.fn() } as never,
    );
  });

  describe('listApiTokens', () => {
    it('never returns the token digest', async () => {
      // The regression this file exists for. The entity has tokenHash and
      // returning it shipped an offline guessing oracle to the browser.
      tokens.find.mockResolvedValue([makeRow()]);

      const [token] = await service.listApiTokens(userId);

      expect(token).not.toHaveProperty('tokenHash');
      expect(Object.keys(token).sort()).toEqual([
        'createdAt',
        'id',
        'lastUsedAt',
        'name',
        'prefix',
      ]);
    });

    it("only asks for the caller's own unrevoked tokens", async () => {
      tokens.find.mockResolvedValue([]);

      await service.listApiTokens(userId);

      const where = tokens.find.mock.calls[0][0].where;
      expect(where.user).toEqual({ id: userId });
      // revokedAt: IsNull() is what makes "revoke" mean gone rather than
      // flagged, and it is asserted as present-and-not-null because IsNull()
      // is an operator object, not a value.
      expect(where.revokedAt).toBeDefined();
      expect(where.revokedAt).not.toBeNull();
    });

    it('returns newest first', async () => {
      tokens.find.mockResolvedValue([]);

      await service.listApiTokens(userId);

      expect(tokens.find.mock.calls[0][0].order).toEqual({ createdAt: 'DESC' });
    });

    it('passes a null lastUsedAt through instead of dropping the field', async () => {
      // The UI renders "never used" from this exact null; undefined would change
      // the type under a schema that asserts it.
      tokens.find.mockResolvedValue([makeRow({ lastUsedAt: null })]);

      const [token] = await service.listApiTokens(userId);

      expect(token).toHaveProperty('lastUsedAt', null);
    });

    it('keeps a real lastUsedAt', async () => {
      const usedAt = new Date('2026-02-03T04:05:06.000Z');
      tokens.find.mockResolvedValue([makeRow({ lastUsedAt: usedAt })]);

      const [token] = await service.listApiTokens(userId);

      expect(token.lastUsedAt).toBe(usedAt);
    });
  });

  describe('createApiToken', () => {
    it('returns the plaintext and persists only its digest', async () => {
      let saved: ApiToken | undefined;
      tokens.save.mockImplementation((row: ApiToken) => {
        saved = row;
        return Promise.resolve(row);
      });

      const created = await service.createApiToken(userId, 'ci');

      expect(created.token).toBeTruthy();
      expect(created.prefix).toBeTruthy();
      expect(created.id).toBeTruthy();
      // The plaintext is in the response and not in the row: the digest is what
      // gets stored, which is why the list endpoint can show a token without
      // being able to re-issue it.
      expect(saved?.tokenHash).toBeTruthy();
      expect(saved?.tokenHash).not.toBe(created.token);
      expect(saved?.user).toEqual({ id: userId });
    });

    it('never returns the digest alongside the plaintext', async () => {
      const created = await service.createApiToken(userId, 'ci');

      expect(created).not.toHaveProperty('tokenHash');
    });

    it('carries the label through to the response', async () => {
      const created = await service.createApiToken(userId, 'github-actions');

      expect(created.name).toBe('github-actions');
    });

    it('hands out a different secret every time', async () => {
      const seen = new Set<string>();

      for (let i = 0; i < 5; i += 1) {
        seen.add((await service.createApiToken(userId, `ci-${i}`)).token);
      }

      expect(seen.size).toBe(5);
    });
  });

  describe('revokeApiToken', () => {
    /**
     * The update scopes ownership in its WHERE clause rather than reading the
     * row first and checking it in JavaScript. That is stronger than the
     * version I originally wrote these tests against: there is no window
     * between the read and the write, and `affected` answers "was it yours and
     * still live" in the same round trip.
     */
    it("scopes the update to the caller, inside the where clause", async () => {
      tokens.update.mockResolvedValue({ affected: 1 });

      await service.revokeApiToken(userId, 'mine');

      expect(tokens.update.mock.calls[0][0]).toEqual({
        id: 'mine',
        user: { id: userId },
      });
    });

    it("404s for a token belonging to somebody else, without writing", async () => {
      // affected: 0 is what a foreign id produces, because the where clause
      // never matches it.
      tokens.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.revokeApiToken(userId, 'theirs'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('stamps revokedAt instead of deleting the row', async () => {
      // Soft delete: the row is the record of which credentials existed.
      tokens.update.mockResolvedValue({ affected: 1 });

      await service.revokeApiToken(userId, 'mine');

      expect(tokens.update.mock.calls[0][1].revokedAt).toBeInstanceOf(Date);
    });

    it('reports already-revoked and never-existed identically', async () => {
      // Both are `affected: 0`, so the endpoint cannot be used to probe which
      // ids are real.
      tokens.update.mockResolvedValue({ affected: 0 });

      await expect(service.revokeApiToken(userId, 'gone')).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        service.revokeApiToken(userId, 'never-existed'),
      ).rejects.toThrow(NotFoundException);
    });

    it('treats a null affected count as not found', async () => {
      // Drivers are allowed to omit it; `!result.affected` covers undefined, and
      // an un-updated token must not answer 204.
      tokens.update.mockResolvedValue({});

      await expect(
        service.revokeApiToken(userId, 'mine'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
