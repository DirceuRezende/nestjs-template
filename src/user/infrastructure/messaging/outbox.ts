import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { asc, inArray, isNull } from 'drizzle-orm';
import type { Env } from '../../../config.js';
import { Database } from '../../../db/database.js';
import { outbox } from '../../../db/schema.js';
import { UserEvents } from '../../application/ports.js';
import type { WelcomeRequested } from '../../domain/user.js';
import { Kafka } from './kafka.js';
import { WELCOME_TOPIC, type WelcomeMessage } from './welcome-message.js';

/** Implementa a port gravando no outbox (na transação do chamador, se houver); quem fala com o Kafka é o relay. */
@Injectable()
export class OutboxUserEvents extends UserEvents {
  constructor(private readonly database: Database) {
    super();
  }

  async welcomeRequested(event: WelcomeRequested) {
    const message: WelcomeMessage = {
      ...event,
      occurredAt: event.occurredAt.toISOString(),
    };
    // chave = userId: mensagens do mesmo usuário caem na mesma partição, em ordem
    await this.database.db.insert(outbox).values({
      id: randomUUID(),
      topic: WELCOME_TOPIC,
      messageKey: event.userId,
      payload: JSON.stringify(message),
      createdAt: event.occurredAt,
    });
  }
}

const BATCH_SIZE = 100;

/**
 * Lê o outbox e publica. Só marca como publicado depois do ack; se falhar no meio do lote,
 * a transação volta e tudo é reenviado no próximo ciclo (at-least-once).
 * shortcut: linhas publicadas nunca são apagadas, upgrade: job de limpeza por published_at
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap {
  private readonly logger = new Logger(OutboxRelay.name);
  private running = false;

  constructor(
    private readonly database: Database,
    private readonly kafka: Kafka,
    private readonly scheduler: SchedulerRegistry,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Registrado no SchedulerRegistry: o ScheduleModule o cancela no shutdown. */
  onApplicationBootstrap() {
    const tick = setInterval(
      () => void this.tick(),
      this.config.get('OUTBOX_POLL_INTERVAL_MS', { infer: true }),
    );
    this.scheduler.addInterval(OutboxRelay.name, tick);
  }

  private async tick() {
    if (this.running) return; // ciclo anterior ainda rodando
    this.running = true;
    try {
      await this.publishPending();
    } catch (e) {
      this.logger.warn(
        `Falha ao publicar no Kafka, nova tentativa no próximo ciclo: ${(e as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }

  /** Publica um lote. SKIP LOCKED deixa várias instâncias rodarem o relay sem duplicar o lote. */
  publishPending(): Promise<void> {
    return this.database.transaction(async () => {
      const db = this.database.db;
      const pending = await db
        .select()
        .from(outbox)
        .where(isNull(outbox.publishedAt))
        .orderBy(asc(outbox.createdAt))
        .limit(BATCH_SIZE)
        .for('update', { skipLocked: true });
      if (pending.length === 0) return;
      for (const m of pending)
        await this.kafka.send(m.topic, m.messageKey, m.payload);
      await db
        .update(outbox)
        .set({ publishedAt: new Date() })
        .where(
          inArray(
            outbox.id,
            pending.map((m) => m.id),
          ),
        );
    });
  }
}
