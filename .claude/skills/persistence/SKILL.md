---
name: persistence
description: Receita de persistência neste projeto NestJS (schema Drizzle, migration gerada, repositório que implementa a port, transação ambiente). Use ao criar ou alterar tabela, coluna, migration, query ou repositório.
---

# Persistência (Drizzle atrás de port)

O núcleo vê só as ports (`UserRepository`, `RefreshTokenStore`); os adapters em `src/user/infrastructure/persistence/` usam Drizzle. Modelos: `DrizzleUserRepository` (agregado em duas tabelas, `array_agg` dos papéis, `toDomain`) e `DrizzleRefreshTokenStore` (`delete ... returning`).

## Passos

1. **Schema:** altere `src/db/schema.ts`.
   - Tipos: `string` (UUID) ↔ `uuid()`; `Date` ↔ `instant()` (`timestamp(6) with time zone`); `string` ↔ `varchar({ length })`/`text()`; `boolean` ↔ `boolean()`.
   - Dê nome a constraints e índices (`uk_`, `fk_`, `idx_`); o adapter reconhece violação pelo nome (`pgError(e).constraint`).
   - O schema é o mesmo nos templates Java e Go: replique a mudança lá se o contrato mudar.
2. **Migration:** `npm run db:generate -- --name <descricao_snake>` e revise o SQL gerado em `drizzle/`. Aplicada no startup e nos e2e. Uma migration aplicada é imutável: mudança nova = migration nova.
3. **Port:** método na `abstract class` de `application/ports.ts`, em tipos do domínio; "não achou" devolve `undefined`.
4. **Adapter:** sempre `this.database.db` (é a transação ambiente quando houver). Escrita em mais de uma tabela vai dentro de `this.database.transaction(async () => {...})`. Converta linha ↔ domínio numa função (`toDomain`/`toRow`); o hash vira `PasswordHash`.
5. **Fake:** o mesmo método em `src/user/testing/in-memory.ts`.
6. **Teste:** a regra fica no caso de uso (fake, skill `use-case`); o adapter é coberto pelos e2e (Postgres real). Tabela nova entra no `TRUNCATE` de `resetDatabase` (`test/app.ts`).

## Banco de dev

Banco inconsistente com as migrations: `npm run infra:down && docker volume rm user-template-node_pgdata && npm run infra:up` recria vazio (apaga os dados de dev).

## Pronto quando

A migration nova está versionada em `drizzle/`, o app sobe e `npm run check` passa.
