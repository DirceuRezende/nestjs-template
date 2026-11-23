import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { KafkaJS } from '@confluentinc/kafka-javascript';
import { UserService } from '../../application/user.service.js';
import { WelcomeNotifier } from '../../application/ports.js';
import { Kafka } from './kafka.js';
import { WELCOME_TOPIC, type WelcomeMessage } from './welcome-message.js';

/** Adapter de entrada: Kafka → caso de uso. Entrega é at-least-once. */
@Injectable()
export class WelcomeConsumer
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WelcomeConsumer.name);
  private readonly consumer: KafkaJS.Consumer;

  constructor(
    kafka: Kafka,
    private readonly users: UserService,
  ) {
    // grupo novo lê desde o início: não perde mensagens já publicadas
    this.consumer = kafka.client.consumer({
      kafkaJS: { groupId: 'user-template', fromBeginning: true },
    });
  }

  async onApplicationBootstrap() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topics: [WELCOME_TOPIC] });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const m = JSON.parse(
            message.value?.toString() ?? '',
          ) as WelcomeMessage;
          await this.users.sendWelcome(m);
        } catch (e) {
          // shortcut: mensagem que falha é logada e pulada (sem retry nem DLQ), upgrade: retry com backoff + tópico .DLT
          this.logger.error(
            `Mensagem descartada (offset ${message.offset}): ${(e as Error).message}`,
          );
        }
      },
    });
  }

  async onApplicationShutdown() {
    await this.consumer.disconnect();
  }
}

/** Stand-in de um envio real (e-mail, push...): troque este adapter sem tocar no core. */
@Injectable()
export class LoggingWelcomeNotifier extends WelcomeNotifier {
  private readonly logger = new Logger('WelcomeNotifier');

  async welcome(email: string, name: string) {
    this.logger.log(`Boas-vindas enviadas para ${name} <${email}>`);
  }
}
