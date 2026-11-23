// Sobe Postgres + Kafka uma vez para toda a suíte e2e e exporta o ambiente do app.
import {
  KafkaContainer,
  type StartedKafkaContainer,
} from '@testcontainers/kafka';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

let pg: StartedPostgreSqlContainer;
let kafka: StartedKafkaContainer;

export async function setup() {
  // O módulo Kafka do Testcontainers só suporta imagens Confluent; cp-kafka 8 = Kafka 4 em KRaft.
  [pg, kafka] = await Promise.all([
    new PostgreSqlContainer('postgres:17-alpine').start(),
    new KafkaContainer('confluentinc/cp-kafka:8.0.0').start(),
  ]);
  process.env.DATABASE_URL = pg.getConnectionUri();
  process.env.KAFKA_BOOTSTRAP_SERVERS = `${kafka.getHost()}:${kafka.getMappedPort(9093)}`;
  process.env.JWT_SECRET = 'test-secret-0123456789abcdef0123456789';
  process.env.OUTBOX_POLL_INTERVAL_MS = '100';
}

export async function teardown() {
  await Promise.all([pg?.stop(), kafka?.stop()]);
}
