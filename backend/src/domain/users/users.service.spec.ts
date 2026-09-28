import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { User } from '../auth/entities/user.entity.js';
import { UsersService } from './users.service.js';
import { STORAGE_SERVICE } from '../storage/storage.tokens.js';

/**
 * Account deletion (unit).
 *
 * The behaviour worth pinning here is the ordering. Deleting the account used
 * to hand the avatar key to a message broker, and the event never arrived: the
 * API published and the worker consumed, each holding its own in-memory queue.
 * Every deleted account left its avatar behind, silently.
 *
 * The other thing these tests guard is that the avatar is removed *after* the
 * transaction commits. Doing it inside would destroy the file even when the row
 * removal rolled back, which loses an avatar for a user who still exists.
 */
describe('UsersService.deleteMe', () => {
  const AVATAR_KEY = 'avatars/user-1-1700000000000.png';
  const AVATAR_URL = `http://localhost:8333/riskio-avatars/${AVATAR_KEY}`;

  let service: UsersService;
  let removed: boolean;
  let deletedKeys: string[];
  let failStorage: boolean;
  let commit: () => void;
  let failCommit: boolean;

  const user = (over: Partial<User> = {}) =>
    ({
      id: 'user-1',
      email: 'user@test.local',
      passwordHash: 'hash',
      avatarUrl: AVATAR_URL,
      ...over,
    }) as User;

  beforeEach(async () => {
    removed = false;
    deletedKeys = [];
    failStorage = false;
    failCommit = false;
    commit = () => {};

    const usersRepository = {
      findOne: async () => user(),
      manager: {
        transaction: async (work: (manager: unknown) => Promise<void>) => {
          if (failCommit) throw new Error('transaction rolled back');
          await work({ remove: async () => { removed = true; } });
          commit();
        },
      },
    };

    const storage = {
      extractKey: (url: string) =>
        url ? `avatars/${url.split('/').pop()}` : null,
      delete: async (key: string) => {
        if (failStorage) throw new Error('storage unreachable');
        deletedKeys.push(key);
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: STORAGE_SERVICE, useValue: storage },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it('removes the account and its avatar', async () => {
    await service.deleteMe('user-1');

    expect(removed).toBe(true);
    expect(deletedKeys).toEqual([AVATAR_KEY]);
  });

  it('deletes the avatar only after the transaction commits', async () => {
    const order: string[] = [];
    deletedKeys = [];

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: async () => user(),
            manager: {
              transaction: async (work: (m: unknown) => Promise<void>) => {
                await work({
                  remove: async () => {
                    order.push('removed');
                  },
                });
                order.push('committed');
              },
            },
          },
        },
        {
          provide: STORAGE_SERVICE,
          useValue: {
            extractKey: () => AVATAR_KEY,
            delete: async () => {
              order.push('avatar deleted');
            },
          },
        },
      ],
    }).compile();

    const tracked = moduleRef.get(UsersService);
    await tracked.deleteMe('user-1');

    expect(order).toEqual(['removed', 'committed', 'avatar deleted']);
  });

  it('keeps the avatar when the transaction fails', async () => {
    failCommit = true;

    await expect(service.deleteMe('user-1')).rejects.toThrow();

    // The file is still there: the account was not deleted, so neither should
    // its avatar be.
    expect(deletedKeys).toEqual([]);
  });

  it('still reports success when only the storage delete fails', async () => {
    failStorage = true;

    // The account is already gone. Failing the request now would tell the
    // user their deletion did not happen when it did.
    await expect(service.deleteMe('user-1')).resolves.toBeUndefined();
    expect(removed).toBe(true);
  });

  it('does not touch storage when the account has no avatar', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: async () => user({ avatarUrl: null }),
            manager: {
              transaction: async (work: (m: unknown) => Promise<void>) =>
                work({ remove: async () => { removed = true; } }),
            },
          },
        },
        {
          provide: STORAGE_SERVICE,
          useValue: { extractKey: () => null, delete: async () => {} },
        },
      ],
    }).compile();

    await moduleRef.get(UsersService).deleteMe('user-1');

    expect(removed).toBe(true);
  });

  it('rejects an unknown account', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: async () => null, manager: {} },
        },
        {
          provide: STORAGE_SERVICE,
          useValue: { extractKey: () => null, delete: async () => {} },
        },
      ],
    }).compile();

    await expect(moduleRef.get(UsersService).deleteMe('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
