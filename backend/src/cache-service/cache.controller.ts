import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service.js';

/**
 * The wire contract for the cache service.
 *
 * Keyed resources rather than a `/get` RPC, so a read of a cache entry is a
 * plain HTTP GET that a proxy can log and rate-limit without knowing anything
 * about the payload.
 *
 * `found` is separate from `value` because a JSON `null` is a legitimate thing
 * to cache. Folding the two together would make "cached null" indistinguishable
 * from "not cached", and every cached null would become a loader call that
 * caches null again, forever.
 */
@Controller('cache')
export class CacheController {
  constructor(private readonly cache: RedisCacheService) {}

  @Get(':key')
  async get(@Param('key') key: string): Promise<{ found: boolean; value: unknown }> {
    const value = await this.cache.get(key);
    return { found: value !== undefined, value: value ?? null };
  }

  @Put()
  async set(
    @Body() body: { key?: string; value?: unknown; ttlMs?: number },
  ): Promise<{ stored: true }> {
    const { key, value, ttlMs } = body ?? {};
    if (typeof key !== 'string' || !key || typeof ttlMs !== 'number' || !Number.isFinite(ttlMs)) {
      // 400 rather than a thrown Error, which Nest would turn into a 500 and
      // make a malformed call look like the cache being broken.
      throw new BadRequestException('key and a finite numeric ttlMs are required');
    }
    await this.cache.set(key, value, ttlMs);
    return { stored: true };
  }

  @Delete(':key')
  @HttpCode(204)
  async del(@Param('key') key: string): Promise<void> {
    await this.cache.del(key);
  }

  @Post('invalidate')
  async invalidate(@Body() body: { pattern?: string }): Promise<{ deleted: number }> {
    const pattern = body?.pattern;
    if (typeof pattern !== 'string' || !pattern) {
      throw new BadRequestException('pattern is required');
    }
    return { deleted: await this.cache.invalidate(pattern) };
  }
}
