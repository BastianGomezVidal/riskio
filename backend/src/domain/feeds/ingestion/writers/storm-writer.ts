import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { Storm } from '../../../weather/storms/entities/storm.entity.js';
import type { FeedStormSummary } from '../../../../common/contracts/feed-storm-summary.js';

/**
 * Every write to the `storms` table, and nothing else.
 *
 * These three methods used to live on StormsService, which is a read service:
 * the API calls it to answer questions, and nothing else. That put the whole
 * write path of ingestion behind a reader's API, which is why the ingestion
 * graph pointed at `weather` and could not be lifted out on its own.
 *
 * Moving them here means the writer owns the writes. The reader is left with
 * reads, and neither needs the other: the ingestion service depends on this,
 * and the advisories reader does not.
 *
 * Duplicated repository handle rather than a shared one on purpose. A reader
 * and a writer holding the same repository is the coupling being removed, not
 * a connection pool to be shared; the two are separate services after this
 * change, and a shared handle would be the seam that quietly reattaches them.
 */
@Injectable()
export class StormWriter {
  private readonly logger = new Logger(StormWriter.name);

  constructor(
    @InjectRepository(Storm)
    private readonly storms: Repository<Storm>,
  ) {}

  async findOneRaw(atcfId: string): Promise<Storm> {
    const storm = await this.storms.findOne({ where: { atcfId } });
    if (!storm) {
      throw new NotFoundException(`Storm ${atcfId} not found`);
    }
    return storm;
  }

  /**
   * Reconcile a basin's storms against what the feed reported: everything in
   * the basin is marked inactive, then the ones present are brought back.
   *
   * Inside one transaction on purpose. A crash halfway through would otherwise
   * leave a basin with a mix of active and inactive storms that no feed ever
   * described, and nothing would correct it until the next run.
   */
  async reconcileFromFeed(
    basin: string,
    summaries: FeedStormSummary[],
  ): Promise<void> {
    const now = new Date();

    await this.storms.manager.transaction(async (manager) => {
      await manager.update(Storm, { basin }, { isActive: false });

      for (const s of summaries) {
        await manager.upsert(
          Storm,
          {
            atcfId: s.atcfId,
            name: s.name,
            basin: s.basin,
            isActive: true,
            lastSeenInFeedAt: now,
          },
          { conflictPaths: ['atcfId'] },
        );
      }
    });
  }

  async upsert(input: {
    atcfId: string;
    name: string | null;
    basin: string;
  }): Promise<Storm> {
    await this.storms.upsert(
      {
        atcfId: input.atcfId,
        name: input.name,
        basin: input.basin,
        isActive: true,
        lastSeenInFeedAt: new Date(),
      },
      { conflictPaths: ['atcfId'] },
    );
    return this.storms.findOneOrFail({ where: { atcfId: input.atcfId } });
  }
}
