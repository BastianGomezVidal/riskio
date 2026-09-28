import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { StormWriter } from './storm-writer.js';
import { Storm } from '../../../weather/storms/entities/storm.entity.js';

/**
 * These cases used to live in storms.service.spec.ts against StormsService,
 * which no longer has the methods. They moved here with the code, and the
 * stakes are the write path: a reconcile that half-applies leaves a basin with
 * a mix of active and inactive storms that no feed ever described.
 */
describe('StormWriter', () => {
  let findOne: ReturnType<typeof vi.fn>;
  let findOneOrFail: ReturnType<typeof vi.fn>;
  let upsert: ReturnType<typeof vi.fn>;
  let managerUpdate: ReturnType<typeof vi.fn>;
  let managerUpsert: ReturnType<typeof vi.fn>;
  let writer: StormWriter;

  beforeEach(() => {
    findOne = vi.fn();
    findOneOrFail = vi.fn();
    upsert = vi.fn();
    managerUpdate = vi.fn();
    managerUpsert = vi.fn();
    const repository = {
      findOne,
      findOneOrFail,
      upsert,
      manager: {
        transaction: vi.fn(async (fn: (m: unknown) => unknown) =>
          fn({ update: managerUpdate, upsert: managerUpsert }),
        ),
      },
    } as unknown as Repository<Storm>;
    writer = new StormWriter(repository);
  });

  describe('findOneRaw', () => {
    it('returns the storm', async () => {
      const storm = { atcfId: 'EP142026' } as Storm;
      findOne.mockResolvedValue(storm);

      await expect(writer.findOneRaw('EP142026')).resolves.toBe(storm);
      expect(findOne).toHaveBeenCalledWith({ where: { atcfId: 'EP142026' } });
    });

    it('throws NotFound rather than returning null', async () => {
      findOne.mockResolvedValue(null);

      // A null here would travel into the ingestion as a storm that exists.
      await expect(writer.findOneRaw('NOPE')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('reconcileFromFeed', () => {
    it('flips the basin inactive and upserts the feed storms in one transaction', async () => {
      managerUpdate.mockResolvedValue(undefined);
      managerUpsert.mockResolvedValue(undefined);

      await writer.reconcileFromFeed('EP', [
        { atcfId: 'EP142026', name: 'Odile', basin: 'EP' },
        { atcfId: 'EP152026', name: null, basin: 'EP' },
      ]);

      expect(managerUpdate).toHaveBeenCalledWith(
        Storm,
        { basin: 'EP' },
        { isActive: false },
      );

      expect(managerUpsert).toHaveBeenCalledTimes(2);

      expect(managerUpsert).toHaveBeenNthCalledWith(
        1,
        Storm,
        {
          atcfId: 'EP142026',
          name: 'Odile',
          basin: 'EP',
          isActive: true,
          lastSeenInFeedAt: expect.any(Date),
        },
        { conflictPaths: ['atcfId'] },
      );

      expect(managerUpsert).toHaveBeenNthCalledWith(
        2,
        Storm,
        {
          atcfId: 'EP152026',
          name: null,
          basin: 'EP',
          isActive: true,
          lastSeenInFeedAt: expect.any(Date),
        },
        { conflictPaths: ['atcfId'] },
      );
    });

    it('marks every basin storm inactive when the feed is empty', async () => {
      managerUpdate.mockResolvedValue(undefined);

      await writer.reconcileFromFeed('CP', []);

      expect(managerUpdate).toHaveBeenCalledWith(
        Storm,
        { basin: 'CP' },
        { isActive: false },
      );

      expect(managerUpsert).not.toHaveBeenCalled();
    });

    it('propagates transaction failures', async () => {
      const error = new Error('transaction aborted');
      managerUpdate.mockRejectedValue(error);

      await expect(writer.reconcileFromFeed('EP', [])).rejects.toBe(error);
    });
  });

  describe('upsert', () => {
    it('stores the storm as active and returns the reloaded row', async () => {
      const storm = { atcfId: 'EP142026' } as Storm;
      upsert.mockResolvedValue(undefined);
      findOneOrFail.mockResolvedValue(storm);

      await expect(
        writer.upsert({ atcfId: 'EP142026', name: 'Odile', basin: 'EP' }),
      ).resolves.toBe(storm);

      expect(upsert).toHaveBeenCalledWith(
        {
          atcfId: 'EP142026',
          name: 'Odile',
          basin: 'EP',
          isActive: true,
          lastSeenInFeedAt: expect.any(Date),
        },
        { conflictPaths: ['atcfId'] },
      );

      expect(findOneOrFail).toHaveBeenCalledWith({
        where: { atcfId: 'EP142026' },
      });
    });
  });
});
