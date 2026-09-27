import { Injectable, Logger } from '@nestjs/common';
import {
  IMessageBroker,
  IPublishOptions,
  ISubscribeOptions,
} from '../adapter/interface/messaging-broker.js';

interface Handler {
  fn: (payload: unknown) => Promise<void>;
  options: ISubscribeOptions;
}

@Injectable()
export class InMemoryBroker implements IMessageBroker {
  private readonly logger = new Logger(InMemoryBroker.name);
  private readonly handlers = new Map<string, Handler[]>();

  async publish<T>(
    topic: string,
    payload: T,
    _options?: IPublishOptions,
  ): Promise<void> {
    const handlers = this.handlers.get(topic) ?? [];
    this.logger.debug(`Publishing to ${topic} (${handlers.length} handlers)`);
    for (const h of handlers) {
      // Fire and forget — same contract as a real broker.
      h.fn(payload).catch((err) =>
        this.logger.error(`Handler failed for ${topic}: ${String(err)}`),
      );
    }
  }

  async subscribe<T>(
    topic: string,
    handler: (payload: T) => Promise<void>,
    options: ISubscribeOptions = {},
  ): Promise<void> {
    const list = this.handlers.get(topic) ?? [];
    list.push({ fn: handler as (p: unknown) => Promise<void>, options });
    this.handlers.set(topic, list);
    this.logger.log(`Subscribed to ${topic}`);
  }

  async close(): Promise<void> {
    this.handlers.clear();
  }
}
