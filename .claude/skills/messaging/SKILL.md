---
name: messaging
description: Receita de mensageria com Kafka neste projeto NestJS (evento de domínio, outbox na transação ambiente, relay, consumer, teste ponta a ponta). Use ao publicar ou consumir um evento, criar um tópico ou mexer no outbox.
---

# Mensageria (Kafka + Transactional Outbox)

O núcleo nunca vê Kafka. Um caso de uso publica pela port `UserEvents`, o `OutboxUserEvents` grava no **outbox** (na transação ambiente, se houver), o `OutboxRelay` (genérico) leva ao Kafka e o `WelcomeConsumer` entrega de volta a um serviço. Entrega **at-least-once**. Tudo em `src/user/infrastructure/messaging/`.

Fluxo modelo: `UserService.requestWelcome` → `OutboxUserEvents` → `OutboxRelay.publishPending` → `Kafka.send` → `WelcomeConsumer` → `UserService.sendWelcome` → `WelcomeNotifier`.

## Publicar um evento

1. **Evento** em `domain/user.ts`: interface com tipos do domínio e `occurredAt`, nomeada como fato (`...Requested`).
2. **Port:** método novo em `UserEvents` (`application/ports.ts`); fake em `RecordingEvents`.
3. **Caso de uso:** chama a port. Se também escreve no banco, faça tudo dentro de `this.tx.run(...)`: o outbox entra na mesma transação.
4. **Contrato** em `welcome-message.ts` (ou um arquivo irmão): constante do tópico `<contexto>.<evento-kebab>` e a interface da mensagem JSON (datas como ISO string).
5. **Adapter:** `INSERT` no `outbox` com chave = id do agregado (ordem por agregado).
6. **Tópico:** acrescente em `Kafka.onModuleInit` (`createTopics`).

## Consumir um evento

7. **Consumer:** provider com `onApplicationBootstrap` (connect, subscribe, run) e `onApplicationShutdown` (disconnect), registrado no `user.module.ts`. `eachMessage` faz o parse e chama um serviço.
8. **Idempotência:** a mesma mensagem pode chegar duas vezes; o serviço consumidor precisa produzir o mesmo efeito na repetição. Efeito não repetível (cobrança, e-mail real) registra os ids já processados.

## Contrato

O JSON é o mesmo nos templates Java e Go. Evolua só **adicionando** campos; para quebrar, crie um tópico novo.

## Testes

- Unitário do caso de uso: `RecordingEvents.published` tem o evento no caminho feliz e fica vazio nos alternativos.
- Ponta a ponta: modelo `test/welcome-flow.e2e-spec.ts` (Postgres + Kafka reais, `OUTBOX_POLL_INTERVAL_MS=100`, notifier trocado por `RecordingNotifier`, `vi.waitFor` com timeout).

## Pronto quando

O teste ponta a ponta prova que o evento sai pelo outbox e chega ao consumidor, `npm run check` passa e o README lista o tópico.
