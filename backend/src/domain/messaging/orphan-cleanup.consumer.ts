import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MESSAGE_BROKER } from './adapter/types/message-broker.token.js';
import type { IMessageBroker } from './adapter/interface/messaging-broker.js'; // ← este
import { STORAGE_SERVICE } from '../storage/storage.tokens.js';
import type { StorageService } from '../storage/storage.service.js';

interface OrphanCleanupMessage {
  type: 'avatar';
  key: string;
}

const TOPIC = 'orphan-cleanup';

/**
 * Consumes orphan cleanup messages and deletes the corresponding
 * objects from storage. Started on module init; the broker handles
 * retries per its own policy.
 */
@Injectable()
export class OrphanCleanupConsumer implements OnModuleInit {
  private readonly logger = new Logger(OrphanCleanupConsumer.name);

  constructor(
    @Inject(MESSAGE_BROKER)
    private readonly broker: IMessageBroker,

    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.IS_WORKER !== 'true') {
      this.logger.log('Not a worker, skipping orphan-cleanup subscription');
      return;
    }
    await this.broker.subscribe<OrphanCleanupMessage>(
      TOPIC,
      async (msg) => {
        if (msg.type === 'avatar') {
          await this.storage.delete(msg.key);
          this.logger.log(`Deleted orphaned avatar: ${msg.key}`);
        }
      },
      { groupId: 'riskio-orphan-cleanup' },
    );
  }

  /** Used by UsersService.deleteMe. */
  static topic(): string {
    return TOPIC;
  }
}
