import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import type { Env } from '../../../config.js';
import { WELCOME_TOPIC } from './welcome-message.js';

/** Cliente Kafka do app: cria os tópicos e mantém um producer conectado. */
@Injectable()
export class Kafka implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(Kafka.name);
  readonly client: KafkaJS.Kafka;
  private readonly producer: KafkaJS.Producer;

  constructor(config: ConfigService<Env, true>) {
    this.client = new KafkaJS.Kafka({
      kafkaJS: {
        brokers: config
          .get('KAFKA_BOOTSTRAP_SERVERS', { infer: true })
          .split(','),
        logLevel: KafkaJS.logLevel.WARN,
      },
    });
    this.producer = this.client.producer();
  }

  async onModuleInit() {
    const admin = this.client.admin();
    await admin.connect();
    // 3 partições, 1 réplica: só dev. Devolve false se já existe (ok).
    await admin.createTopics({
      topics: [
        { topic: WELCOME_TOPIC, numPartitions: 3, replicationFactor: 1 },
      ],
    });
    await admin.disconnect();
    await this.producer.connect();
    this.logger.log('Kafka conectado');
  }

  /** Publica e só resolve depois do ack do broker. */
  async send(topic: string, key: string, value: string) {
    await this.producer.send({ topic, messages: [{ key, value }] });
  }

  async onApplicationShutdown() {
    await this.producer.disconnect();
  }
}
