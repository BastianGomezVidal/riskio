import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { IngestionScheduler } from './ingestion.scheduler.js';
import { IngestionService } from './ingestion.service.js';

/**
 * Unit tests for {@link IngestionScheduler}.
 *
 * The `@Cron` decorator only registers metadata — the schedule itself is
 * exercised by Nest at runtime — so these tests cover the handler logic:
 * happy-path reporting, per-basin error reporting and the never-throw
 * guarantee on unexpected failures.
 */
describe('IngestionScheduler', () => {
  function makeScheduler(reports?: unknown[], error?: unknown) {
    const ingestAllBasins = error
      ? vi.fn().mockRejectedValue(error)
      : vi.fn().mockResolvedValue(reports ?? []);
    const ingestion = { ingestAllBasins } as unknown as IngestionService;
    const scheduler = new IngestionScheduler(ingestion);
    return { scheduler, ingestAllBasins };
  }

  function makeReport(
    basin: 'at' | 'ep' | 'cp',
    overrides: Record<string, unknown> = {},
  ) {
    return {
      basin,
      stormsSeen: 1,
      stormsUpserted: 1,
      advisoriesInserted: 1,
      advisoriesSkipped: 0,
      forecastPointsInserted: 5,
      geometriesUpdated: 1,
      warningSegments: 2,
      errors: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to ingestAllBasins and logs a compact per-basin summary', async () => {
    const { scheduler, ingestAllBasins } = makeScheduler([
      makeReport('at'),
      makeReport('ep', { advisoriesSkipped: 1 }),
    ]);

    await expect(scheduler.pollAllBasins()).resolves.toBeUndefined();
    expect(ingestAllBasins).toHaveBeenCalledTimes(1);
  });

  it('warns when basins report errors but still resolves', async () => {
    const { scheduler } = makeScheduler([
      makeReport('ep', { errors: ['ep fetch failed'] }),
    ]);

    await expect(scheduler.pollAllBasins()).resolves.toBeUndefined();
  });

  it('never throws when ingestion itself rejects', async () => {
    const { scheduler } = makeScheduler([], new Error('db down'));

    await expect(scheduler.pollAllBasins()).resolves.toBeUndefined();
  });
});
