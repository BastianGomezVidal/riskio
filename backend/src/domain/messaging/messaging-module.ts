import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaBroker } from './behaviors/kafka.broker.js';
import { SqsBroker } from './behaviors/sqs-broker.js';
import { InMemoryBroker } from './behaviors/im-memoy.broker.js';
import { MESSAGE_BROKER } from './adapter/types/message-broker.token.js';
import { OrphanCleanupConsumer } from './orphan-cleanup.consumer.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [ConfigModule, StorageModule],
  providers: [
    {
      provide: MESSAGE_BROKER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('BROKER_DRIVER', 'memory');
        switch (driver) {
          case 'kafka':
            return new KafkaBroker(config);
          case 'sqs':
            return new SqsBroker(config);
          case 'memory':
          default:
            return new InMemoryBroker();
        }
      },
    },
    OrphanCleanupConsumer,
  ],
  exports: [MESSAGE_BROKER],
})
export class MessagingModule {}
