import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { IngestionScheduler } from './ingestion.scheduler.js';
import { IngestionService } from '../ingestion.service.js';

/**
 * Unit tests for IngestionScheduler.
 *
 * The @Cron decorator only registers metadata. The actual scheduling is
 * exercised by NestJS at runtime, so these tests focus on the handler:
 *
 * - delegation to IngestionService
 * - successful completion logging
 * - per-basin error reporting
 * - incomplete storm visibility
 * - unexpected rejection handling
 * - never-throw behavior
 */
describe('IngestionScheduler', () => {
  function makeScheduler(reports?: unknown[], error?: unknown) {
    const ingestAllBasins = error
      ? vi.fn().mockRejectedValue(error)
      : vi.fn().mockResolvedValue(reports ?? []);

    const ingestion = {
      ingestAllBasins,
    } as unknown as IngestionService;

    const scheduler = new IngestionScheduler(ingestion);

    return {
      scheduler,
      ingestAllBasins,
    };
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

  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    warnSpy = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to ingestAllBasins exactly once', async () => {
    const { scheduler, ingestAllBasins } = makeScheduler([
      makeReport('at'),
      makeReport('ep'),
      makeReport('cp'),
    ]);

    await expect(scheduler.pollAllBasins()).resolves.toBeUndefined();

    expect(ingestAllBasins).toHaveBeenCalledTimes(1);
    expect(ingestAllBasins).toHaveBeenCalledWith();
  });

  it('logs start and completion for a successful ingestion', async () => {
    const { scheduler } = makeScheduler([makeReport('at'), makeReport('ep')]);

    await scheduler.pollAllBasins();

    expect(logSpy).toHaveBeenCalledTimes(2);

    expect(logSpy.mock.calls[0][0]).toBe('scheduled-ingest start');

    expect(logSpy.mock.calls[1][0]).toContain('scheduled-ingest done');
  });

  it('includes every basin and its counters in the completion summary', async () => {
    const { scheduler } = makeScheduler([
      makeReport('at', {
        stormsSeen: 2,
        stormsUpserted: 2,
        advisoriesInserted: 2,
        forecastPointsInserted: 16,
        geometriesUpdated: 2,
        warningSegments: 4,
      }),
      makeReport('ep', {
        stormsSeen: 1,
        stormsUpserted: 1,
        advisoriesInserted: 1,
        advisoriesSkipped: 1,
        forecastPointsInserted: 0,
      }),
      makeReport('cp', {
        stormsSeen: 0,
        stormsUpserted: 0,
        advisoriesInserted: 0,
        advisoriesSkipped: 0,
        forecastPointsInserted: 0,
        geometriesUpdated: 0,
        warningSegments: 0,
      }),
    ]);

    await scheduler.pollAllBasins();

    const completionLog = logSpy.mock.calls
      .map(([message]) => String(message))
      .find((message) => message.includes('scheduled-ingest done'));

    expect(completionLog).toBeDefined();

    expect(completionLog).toContain(
      'at:storms=2/~2,adv+2/~0,pts+16,geo+2,ww+4,err=0',
    );

    expect(completionLog).toContain(
      'ep:storms=1/~1,adv+1/~1,pts+0,geo+1,ww+2,err=0',
    );

    expect(completionLog).toContain(
      'cp:storms=0/~0,adv+0/~0,pts+0,geo+0,ww+0,err=0',
    );
  });

  it('handles an empty report list without throwing or warning', async () => {
    const { scheduler, ingestAllBasins } = makeScheduler([]);

    await expect(scheduler.pollAllBasins()).resolves.toBeUndefined();

    expect(ingestAllBasins).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();

    const completionLog = logSpy.mock.calls
      .map(([message]) => String(message))
      .find((message) => message.includes('scheduled-ingest done'));

    expect(completionLog).toBeDefined();
    expect(completionLog).toContain('scheduled-ingest done');
  });

  it('warns when a basin contains ingestion errors', async () => {
    const { scheduler } = makeScheduler([
      makeReport('ep', {
        errors: ['ep fetch failed'],
      }),
    ]);

    await expect(scheduler.pollAllBasins()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);

    const warning = String(warnSpy.mock.calls[0][0]);

    expect(warning).toContain('scheduled-ingest basins-with-errors=1');

    expect(warning).toContain('ep fetch failed');
    expect(warning).toContain('"basin":"ep"');
    expect(warning).toContain('"stormsSeen":1');
    expect(warning).toContain('"stormsUpserted":1');
  });

  it('reports the correct number when multiple basins have errors', async () => {
    const { scheduler } = makeScheduler([
      makeReport('at', {
        errors: ['AT fetch failed'],
      }),
      makeReport('ep', {
        errors: ['EP storm failed'],
      }),
      makeReport('cp'),
    ]);

    await scheduler.pollAllBasins();

    expect(warnSpy).toHaveBeenCalledTimes(1);

    const warning = String(warnSpy.mock.calls[0][0]);

    expect(warning).toContain('scheduled-ingest basins-with-errors=2');

    expect(warning).toContain('AT fetch failed');
    expect(warning).toContain('EP storm failed');
  });

  it('does not warn when all basins complete without errors', async () => {
    const { scheduler } = makeScheduler([
      makeReport('at'),
      makeReport('ep'),
      makeReport('cp'),
    ]);

    await scheduler.pollAllBasins();

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('exposes incomplete storm ingestion through the summary', async () => {
    const { scheduler } = makeScheduler([
      makeReport('ep', {
        stormsSeen: 2,
        stormsUpserted: 1,
        errors: ['first storm failed'],
      }),
    ]);

    await scheduler.pollAllBasins();

    const completionLog = logSpy.mock.calls
      .map(([message]) => String(message))
      .find((message) => message.includes('scheduled-ingest done'));

    expect(completionLog).toBeDefined();

    expect(completionLog).toContain('ep:storms=1/~2');

    expect(completionLog).toContain('err=1');

    expect(warnSpy).toHaveBeenCalledTimes(1);

    const warning = String(warnSpy.mock.calls[0][0]);

    expect(warning).toContain('first storm failed');
    expect(warning).toContain('"stormsSeen":2');
    expect(warning).toContain('"stormsUpserted":1');
  });

  it('does not throw when ingestion rejects with an Error', async () => {
    const error = new Error('db down');

    const { scheduler } = makeScheduler([], error);

    await expect(scheduler.pollAllBasins()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);

    expect(errorSpy).toHaveBeenCalledWith(
      'scheduled-ingest failed: db down',
      error.stack,
    );
  });

  it('does not throw when ingestion rejects with a non-Error value', async () => {
    const { scheduler } = makeScheduler([], 'network exploded');

    await expect(scheduler.pollAllBasins()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);

    expect(errorSpy.mock.calls[0][0]).toBe(
      'scheduled-ingest failed: network exploded',
    );

    expect(errorSpy.mock.calls[0][1]).toBeUndefined();
  });

  it('logs the failure stack when ingestion rejects with an Error', async () => {
    const error = new Error('connection reset');
    error.stack = 'STACK_TRACE';

    const { scheduler } = makeScheduler([], error);

    await scheduler.pollAllBasins();

    expect(errorSpy).toHaveBeenCalledWith(
      'scheduled-ingest failed: connection reset',
      'STACK_TRACE',
    );
  });
});
