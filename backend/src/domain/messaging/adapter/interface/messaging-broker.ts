export interface IMessageBroker {
  /**
   * Publish a message to a topic/queue.
   * @param topic logical name (queue, topic, or channel)
   * @param payload JSON-serializable payload
   * @param options per-message overrides
   */
  publish<T>(
    topic: string,
    payload: T,
    options?: IPublishOptions,
  ): Promise<void>;

  /**
   * Subscribe to a topic. The handler is called for each message.
   * Called once at module init.
   */
  subscribe<T>(
    topic: string,
    handler: (payload: T) => Promise<void>,
    options?: ISubscribeOptions,
  ): Promise<void>;

  /** Close connections cleanly on shutdown. */
  close(): Promise<void>;
}

export interface IPublishOptions {
  /** Deduplication / ordering key (Kafka partition key, SQS MessageGroupId). */
  key?: string;
  /** Delay before delivery (SQS only). */
  delaySeconds?: number;
}

export interface ISubscribeOptions {
  /** Consumer group (Kafka). Ignored by SQS. */
  groupId?: string;
  /** Max messages to fetch per poll. */
  batchSize?: number;
}
