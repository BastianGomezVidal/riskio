// backend/src/domain/messaging/kafka.broker.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, logLevel } from 'kafkajs';
import type { Producer, Consumer } from 'kafkajs';
import {
  IMessageBroker,
  IPublishOptions,
  ISubscribeOptions,
} from '../adapter/interface/messaging-broker.js';

@Injectable()
export class KafkaBroker implements IMessageBroker, OnModuleDestroy {
  private readonly logger = new Logger(KafkaBroker.name);
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumers: Consumer[] = [];

  constructor(private readonly config: ConfigService) {
    this.kafka = new Kafka({
      clientId: 'riskio',
      brokers: (this.config.get<string>('KAFKA_BROKERS') ?? 'kafka:9092').split(
        ',',
      ),
      logLevel: logLevel.WARN,
    });
    this.producer = this.kafka.producer();
  }

  async publish<T>(
    topic: string,
    payload: T,
    options: IPublishOptions = {},
  ): Promise<void> {
    await this.producer.send({
      topic,
      messages: [
        {
          key: options.key,
          value: JSON.stringify(payload),
        },
      ],
    });
  }

  async subscribe<T>(
    topic: string,
    handler: (payload: T) => Promise<void>,
    options: ISubscribeOptions = {},
  ): Promise<void> {
    const consumer = this.kafka.consumer({
      groupId: options.groupId ?? 'riskio-default',
    });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        const payload = JSON.parse(message.value.toString()) as T;
        await handler(payload);
      },
    });
    this.consumers.push(consumer);
  }

  async close(): Promise<void> {
    await Promise.all(this.consumers.map((c) => c.disconnect()));
    await this.producer.disconnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
