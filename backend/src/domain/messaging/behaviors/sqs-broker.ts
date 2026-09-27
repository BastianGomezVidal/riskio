import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  CreateQueueCommand,
  GetQueueUrlCommand,
} from '@aws-sdk/client-sqs';
import {
  IMessageBroker,
  IPublishOptions,
  ISubscribeOptions,
} from '../adapter/interface/messaging-broker.js';

interface Subscription {
  queueUrl: string;
  handler: (payload: unknown) => Promise<void>;
  running: boolean;
}

@Injectable()
export class SqsBroker
  implements IMessageBroker, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SqsBroker.name);
  private readonly client: SQSClient;
  private readonly queueUrls = new Map<string, string>();
  private readonly subscriptions: Subscription[] = [];

  constructor(private readonly config: ConfigService) {
    this.client = new SQSClient({
      region: this.config.get<string>('AWS_REGION', 'us-east-1'),
      endpoint: this.config.get<string>('AWS_ENDPOINT_URL') || undefined,
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID', 'test')!,
        secretAccessKey: this.config.get<string>(
          'AWS_SECRET_ACCESS_KEY',
          'test',
        )!,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    // Ensure queues exist for every topic we plan to use.
    // Called lazily when subscribe() or publish() is called instead.
  }

  private async ensureQueue(topic: string): Promise<string> {
    const cached = this.queueUrls.get(topic);
    if (cached) return cached;

    try {
      const { QueueUrl } = await this.client.send(
        new GetQueueUrlCommand({ QueueName: topic }),
      );
      if (!QueueUrl) throw new Error('No URL');
      this.queueUrls.set(topic, QueueUrl);
      return QueueUrl;
    } catch {
      const { QueueUrl } = await this.client.send(
        new CreateQueueCommand({ QueueName: topic }),
      );
      if (!QueueUrl) throw new Error('Failed to create queue');
      this.queueUrls.set(topic, QueueUrl);
      return QueueUrl;
    }
  }

  async publish<T>(
    topic: string,
    payload: T,
    options: IPublishOptions = {},
  ): Promise<void> {
    const queueUrl = await this.ensureQueue(topic);
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(payload),
        DelaySeconds: options.delaySeconds,
        MessageGroupId: options.key, // FIFO only; ignored for standard
      }),
    );
  }

  async subscribe<T>(
    topic: string,
    handler: (payload: T) => Promise<void>,
    options: ISubscribeOptions = {},
  ): Promise<void> {
    const queueUrl = await this.ensureQueue(topic);
    const sub: Subscription = {
      queueUrl,
      handler: handler as (p: unknown) => Promise<void>,
      running: true,
    };
    this.subscriptions.push(sub);
    void this.poll(sub, options);
  }

  private async poll(
    sub: Subscription,
    options: ISubscribeOptions,
  ): Promise<void> {
    const batchSize = options.batchSize ?? 10;
    while (sub.running) {
      try {
        const { Messages } = await this.client.send(
          new ReceiveMessageCommand({
            QueueUrl: sub.queueUrl,
            MaxNumberOfMessages: batchSize,
            WaitTimeSeconds: 20,
          }),
        );

        for (const msg of Messages ?? []) {
          try {
            const payload = JSON.parse(msg.Body ?? '{}');
            await sub.handler(payload);
            await this.client.send(
              new DeleteMessageCommand({
                QueueUrl: sub.queueUrl,
                ReceiptHandle: msg.ReceiptHandle!,
              }),
            );
          } catch (err) {
            this.logger.error(`Handler failed: ${String(err)}`);
            // Message remains in queue; will be retried after visibility timeout.
          }
        }
      } catch (err) {
        this.logger.error(`Poll error: ${String(err)}`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  async close(): Promise<void> {
    this.subscriptions.forEach((s) => (s.running = false));
    this.client.destroy();
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
