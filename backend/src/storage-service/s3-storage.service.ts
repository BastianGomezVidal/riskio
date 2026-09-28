import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  NotFound,
} from '@aws-sdk/client-s3';
import type { StorageService } from '../domain/storage/storage.service.js';

@Injectable()
export class S3StorageService
  implements StorageService, OnApplicationBootstrap
{
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly isLocal: boolean;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('STORAGE_BUCKET');
    this.publicUrl = config.getOrThrow<string>('STORAGE_PUBLIC_URL');

    const endpoint = config.get<string>('STORAGE_ENDPOINT');
    this.isLocal = Boolean(endpoint);

    this.client = new S3Client({
      region: config.get<string>('STORAGE_REGION', 'us-east-1'),
      // If endpoint is set (MinIO/local), use it. If null, use AWS default.
      endpoint: endpoint || undefined,
      // MinIO requires path-style; AWS S3 prefers virtual-hosted.
      forcePathStyle: Boolean(endpoint),
      credentials: {
        accessKeyId: config.getOrThrow<string>('STORAGE_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('STORAGE_SECRET_KEY'),
      },
    });

    this.logger.log(
      `Storage initialized: bucket=${this.bucket} endpoint=${endpoint ?? 'aws'}`,
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.isLocal) {
      return;
    }
    await this.ensureBucket();
  }

  /**
   * Idempotently create the bucket and expose it publicly (local storage
   * only, e.g. SeaweedFS/MinIO). Replaces the old one-shot init containers.
   */
  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Storage bucket '${this.bucket}' already exists`);
      return;
    } catch (err) {
      if (!(err instanceof NotFound)) {
        this.logger.warn(
          `Storage bucket check failed, will attempt to create: ${err}`,
        );
      }
    }

    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Storage bucket '${this.bucket}' created`);
    } catch (err) {
      this.logger.warn(`Storage bucket creation failed: ${err}`);
      return;
    }

    try {
      await this.client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${this.bucket}/*`],
              },
            ],
          }),
        }),
      );
      this.logger.log(`Storage bucket '${this.bucket}' set public read`);
    } catch (err) {
      this.logger.warn(`Storage bucket policy failed: ${err}`);
    }
  }

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return this.getUrl(key);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  getUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  /**
   * Trivially synchronous work, but the contract is async because the API
   * reaches this over HTTP. Kept async so the two implementations are
   * interchangeable, which is what lets a test swap one for the other.
   */
  async extractKey(url: string): Promise<string | null> {
    const prefix = `${this.publicUrl}/`;
    if (!url.startsWith(prefix)) return null;
    return url.slice(prefix.length);
  }

  /**
   * Readiness. Unlike the `ping` this replaces, the error is rethrown: a
   * readiness probe that logs and then reports success is worse than no probe,
   * because it tells the orchestrator to send traffic that cannot be stored.
   */
  async assertBucketReachable(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  bucketName(): string {
    return this.bucket;
  }
}
