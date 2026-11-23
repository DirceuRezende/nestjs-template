# user-template — Hexagonal com NestJS 12 + TypeScript

Template de referência com um agregado `User`, autenticação JWT + refresh token e mensageria com Kafka (Transactional Outbox). Mesmo contrato HTTP, mesmo schema e mesmo evento dos templates Java (Spring) e Go; a implementação segue o jeito Nest/TypeScript.

```bash
npm ci
npm run infra:up     # Postgres 17 (5432) + Kafka (9092) + Grafana LGTM (3000, OTLP 4317/4318)
npm run start:dev    # NODE_ENV=development: segredo JWT de dev + admin admin@example.com / admin12345, porta 8080
npm run check        # lint (oxlint + regra de arquitetura + Prettier) + unitários + e2e (precisa do Docker)
```

`api.http` tem o fluxo completo (cadastro → login → refresh → welcome → logout).

## Endpoints

| Método | Rota | Resposta | Quem |
|---|---|---|---|
| POST | `/api/users` | 201 + `Location` / 409 email duplicado | público |
| GET | `/api/users?page=0&size=20` | 200 paginado (size 1..100) | ADMIN |
| GET | `/api/users/{id}` | 200 / 404 | ADMIN ou o próprio |
| PUT | `/api/users/{id}` | 200 / 404 (altera só o nome) | ADMIN ou o próprio |
| DELETE | `/api/users/{id}` | 204 / 404 (soft delete, derruba as sessões) | ADMIN ou o próprio |
| POST | `/api/users/{id}/welcome` | 202 / 404 (via Kafka; inativo = 404) | ADMIN ou o próprio |
| POST | `/api/auth/login` | 200 par de tokens / 401 | público |
| POST | `/api/auth/refresh` | 200 par novo / 401 | público |
| POST | `/api/auth/logout` | 204 | público |

Erros: `application/problem+json` (RFC 9457) em todos os status de erro. Diferença em relação ao Java/Go: aqui 401/403/404 também trazem corpo (o filtro global do Nest trata toda exceção igual); status e formato são os mesmos.

## Estrutura

```
src/
├── main.ts, app.setup.ts       bootstrap; prefixo /api, pipe Zod e filtro problem+json (compartilhados com os e2e)
├── app.module.ts, config.ts    ConfigModule com o env validado por Zod
├── db/                         Database (Drizzle + transação ambiente via AsyncLocalStorage), schema.ts
├── http/problem-details.ts     filtro global problem+json
└── user/                       ← feature
    ├── domain/                 TypeScript puro: User imutável + funções, PasswordHash mascarado
    ├── application/            UserService, AuthService, ports.ts (abstract classes = tokens de DI)
    ├── infrastructure/
    │   ├── http/               controllers, schemas Zod, guards (AuthGuard, AdminGuard, SelfOrAdminGuard)
    │   ├── persistence/        repositórios Drizzle, Transactor
    │   ├── security/           bcrypt, JWT (@nestjs/jwt)
    │   ├── messaging/          Kafka, outbox + relay, consumer, notifier por log
    │   └── dev-admin.seeder.ts
    ├── testing/in-memory.ts    fakes das ports
    └── user.module.ts          wiring: port → adapter
drizzle/                        migrations SQL geradas (npm run db:generate)
test/                           e2e (Testcontainers)
```

### Decisões

| Decisão | Por quê |
|---|---|
| Ports como `abstract class` | Tipo e token de DI ao mesmo tempo: `{ provide: UserRepository, useClass: DrizzleUserRepository }`, sem `@Inject('STRING')`. |
| Domínio com dados imutáveis + funções | Idiomático em TS; nada de entidade com setters. Cada mudança devolve um `User` novo. |
| Falha esperada como valor | `undefined`, `false` ou união discriminada (`RegisterResult`); só o controller conhece HTTP. |
| Transação ambiente (AsyncLocalStorage) | `Transactor.run(fn)` e os repositórios/outbox participam sem receber `tx`. |
| Zod + `StandardSchemaValidationPipe` | Padrão do Nest 12: schema é o tipo, sem decorators nos DTOs. |
| Drizzle direto, guards próprios, outbox próprio | Paridade com Java/Go e didática; `@nestjs/drizzle`, `@nestjs/authentication` e `@nestjs/outbox` ainda são pré-1.0. |
| Vitest + oxlint + Prettier | Padrão gerado pelo Nest CLI 12 (ESM). |
| dependency-cruiser | Faz o papel do ArchUnit: `domain` sem dependências, `application` sem infra. |

## Configuração

| Variável | Default |
|---|---|
| `NODE_ENV` | `production` (`development` liga segredo e admin de dev) |
| `PORT` | `8080` |
| `DATABASE_URL` | `postgres://users:users@localhost:5432/users` |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` |
| `JWT_SECRET` | obrigatório fora de dev, ≥ 32 bytes |
| `ACCESS_TTL_SECONDS` / `REFRESH_TTL_SECONDS` | `900` / `604800` |
| `OUTBOX_POLL_INTERVAL_MS` | `1000` |

OpenTelemetry usa as variáveis padrão `OTEL_*` (ex.: `OTEL_EXPORTER_OTLP_ENDPOINT`, padrão `http://localhost:4318`; `OTEL_SERVICE_NAME`, padrão `user-template`; `OTEL_SDK_DISABLED=true` desliga).

## Segurança

- **Login** devolve `accessToken` (JWT HS256, 15 min, `sub` = id, claim `roles`) e `refreshToken` (32 bytes aleatórios, 7 dias, guardado só como SHA-256).
- **Refresh** rotaciona: cada refresh token vale uma vez (é apagado mesmo se expirou). **Logout** revoga o token enviado. Remover um usuário revoga todos os dele; inativo não loga nem renova.
- Login falha sempre com o mesmo 401 (usuário inexistente, senha errada, email malformado, inativo).

**Limites conhecidos** (marcados com `shortcut:` no código): access token vale até expirar após logout; timing diferente entre usuário inexistente e senha errada; sem detecção de reuso de refresh token; sem rate limit; sem limpeza de tokens expirados.

## Mensageria (Kafka + Transactional Outbox)

```
POST /api/users/{id}/welcome
  └─ UserService.requestWelcome ─(port UserEvents)─► OutboxUserEvents ─► tabela outbox → 202
OutboxRelay (intervalo 1s) ─► outbox pendente (FOR UPDATE SKIP LOCKED) ─► Kafka.send ─► user.welcome-requested
WelcomeConsumer ─► UserService.sendWelcome ─(port WelcomeNotifier)─► LoggingWelcomeNotifier
```

- Tópico `user.welcome-requested`, 3 partições, chave = userId, JSON `{userId, email, name, occurredAt}`.
- Cliente `@confluentinc/kafka-javascript` (API compatível com KafkaJS, mantido pela Confluent; o `kafkajs` está sem manutenção).
- Outbox: o evento é gravado na mesma transação da mudança; o relay só marca `published_at` depois do ack. Entrega **at-least-once**: o consumidor tolera duplicata.

Ver as mensagens:

```bash
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 --topic user.welcome-requested --from-beginning
```

**Limites conhecidos:** sem retry nem DLQ (mensagem com erro é logada e pulada), sem idempotência no consumidor, sem limpeza do outbox.

## Observabilidade (OpenTelemetry)

Traces, métricas e logs saem via OTLP (http/protobuf). `src/instrumentation.ts` sobe o SDK com as auto-instrumentações (HTTP, Express, pg...) e entra antes do app com `node --import ./dist/instrumentation.js` (`start:*` e o `Dockerfile` já fazem isso; os testes não carregam). `OtelLogger` (`src/otel-logger.ts`) manda os logs do Nest também para o OTel, ligados ao trace da requisição.

Local: `npm run infra:up` sobe o `grafana/otel-lgtm`; Grafana em http://localhost:3000 (admin/admin) → Explore → Tempo (traces), Prometheus (métricas), Loki (logs).

**Limites conhecidos:** o cliente `@confluentinc/kafka-javascript` não tem instrumentação OTel e a do Nest ainda não cobre o Nest 12, então não há spans de Kafka nem de controller/guard; o trace de `POST /welcome` termina no insert do outbox. Queries pg sem span pai (polling do outbox, migrations) não geram trace.

## Testes

| Nível | Onde | Infra |
|---|---|---|
| Domínio e serviços | `src/**/*.spec.ts` (`npm test`) | fakes (`testing/in-memory.ts`) |
| HTTP + segurança (paridade com o `SecurityTest` do Java) | `test/api.e2e-spec.ts` | Postgres + Kafka (Testcontainers) |
| Ponta a ponta HTTP → outbox → Kafka → consumer | `test/welcome-flow.e2e-spec.ts` | Postgres + Kafka (Testcontainers) |

Os containers sobem uma vez por suíte (`test/global-setup.ts`). O Kafka dos testes é `confluentinc/cp-kafka:8.0.0` porque o módulo do Testcontainers só suporta imagens Confluent.

## Pontos em aberto para um projeto real

- Lock otimista (coluna de versão) quando houver updates concorrentes no mesmo usuário.
- Segunda feature: novo módulo em `src/<feature>` com a mesma forma; a regra do dependency-cruiser já vale para qualquer `src/*/domain` e `src/*/application`.
- Observabilidade (o scaffold do Nest traz `@nestjs/observe`, removido aqui) e health check (`@nestjs/terminus`) não estão no template.
