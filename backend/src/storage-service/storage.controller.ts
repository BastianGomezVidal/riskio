import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { STORAGE_SERVICE } from '../domain/storage/storage.tokens.js';
import type { StorageService } from '../domain/storage/storage.service.js';

/**
 * The wire contract for the storage service.
 *
 * Four operations, and that is the whole surface. `users` used to hold the S3
 * credentials and the AWS SDK just to answer "where does this avatar live";
 * now it asks this service, and only this service knows what a bucket is.
 *
 * Bytes travel base64-encoded in JSON. Avatars are small — a few hundred KB at
 * the limit — so the 33% overhead is cheaper than a second content type and a
 * streaming parser to maintain. If this ever carries large files, multipart is
 * the answer, and that is the decision to revisit then.
 */
@Controller('files')
export class StorageController {
  constructor(
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  @Post()
  async upload(
    @Body() body: { key?: string; contentBase64?: string; contentType?: string },
  ): Promise<{ url: string }> {
    const { key, contentBase64, contentType } = body ?? {};

    if (!key || !contentBase64 || !contentType) {
      throw new BadRequestException(
        'key, contentBase64 and contentType are required',
      );
    }

    const buffer = Buffer.from(contentBase64, 'base64');
    // Base64 that decodes to nothing means the caller sent garbage rather than
    // an empty file, and storing a zero-byte object would look like a
    // successful upload.
    if (buffer.length === 0) {
      throw new BadRequestException('contentBase64 did not decode to any bytes');
    }

    const url = await this.storage.upload(key, buffer, contentType);
    return { url };
  }

  @Delete(':key')
  async remove(@Param('key') key: string): Promise<{ deleted: true }> {
    await this.storage.delete(key);
    return { deleted: true };
  }

  /**
   * An endpoint rather than client-side string handling, because the public URL
   * format is a storage concern and should live where the bucket lives. Callers
   * that used to slice the URL themselves now cannot drift from it.
   */
  @Get('extract')
  async extractKey(@Query('url') url: string): Promise<{ key: string | null }> {
    if (!url) {
      throw new BadRequestException('url is required');
    }
    return { key: await this.storage.extractKey(url) };
  }
}
