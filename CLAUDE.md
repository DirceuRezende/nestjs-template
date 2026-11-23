# user-template (NestJS)

Template **hexagonal** em NestJS 12 (ESM) + Drizzle + Kafka (`@confluentinc/kafka-javascript`). Feature única: `src/user`. Mesmo contrato HTTP e de evento dos templates Java e Go (ver `api.http`).

## Comandos

Veja os scripts do `package.json`. Uma tarefa está pronta quando `npm run check` passa: `lint` (oxlint + dependency-cruiser + Prettier), `test` (unitários) e `test:e2e` (Postgres + Kafka via Testcontainers, precisa do Docker).

## Regra de dependência

`infrastructure → application → domain`, verificada pelo dependency-cruiser (`.dependency-cruiser.mjs`) no `npm run lint`.

- `domain/` é TypeScript puro: dados imutáveis (`User`) e funções que devolvem um novo (`rename`, `deactivate`, `grant`).
- `application/` tem os serviços (`UserService`, `AuthService`) e as ports em `ports.ts`. De npm, só `@Injectable` de `@nestjs/common`. Falha esperada é valor (`undefined`, `false`, `RegisterResult`), nunca exceção HTTP.
- Port é `abstract class`: vale como tipo e como token de DI. O `user.module.ts` liga cada port ao adapter com `{ provide: Port, useClass: Adapter }`.
- Transação: `Transactor.run(fn)`. Dentro dela, `Database.db` devolve a transação (AsyncLocalStorage), então repositórios e outbox participam sem receber `tx`.

## Convenções

- Identificadores em inglês; comentários, mensagens de erro e docs em português.
- Imports relativos terminam em `.js` (ESM). Classe injetada é importada como valor, nunca com `import type` (a DI lê os tipos do construtor em runtime).
- Validação na borda com Zod: `@Body({ schema })`, `@Param('id', { schema })`, `@Query({ schema })` + `StandardSchemaValidationPipe` (em `app.setup.ts`, que main e e2e compartilham).
- Erros saem como problem+json: `ProblemDetailsFilter` (global) e `DomainValidationFilter` (controllers de user).
- Segredo no domínio tem tipo que mascara `toString`/`toJSON`/inspect (ex.: `PasswordHash`). Controller responde sempre um objeto mapeado (`toResponse`), nunca o `User`.
- Tempo vem da port `Clock`; testes usam `FixedClock`.
- Atalho consciente ganha `// shortcut: <limite>, upgrade: <o que fazer>`.

## Nest 12 e as skills oficiais

As skills `nestjs*` em `.claude/skills` são as oficiais do Nest 12 (docs: https://docs.nestjs.com/llms.txt). Este template usa de propósito implementação própria onde elas sugerem pacotes ainda pré-1.0: Drizzle direto (não `@nestjs/drizzle`), guards próprios com `@nestjs/jwt` (não `@nestjs/authentication`) e outbox próprio (não `@nestjs/outbox`). Mantenha esse padrão; para trocar, decida com o usuário.

## Pegadinhas

- Migrations: o schema é `src/db/schema.ts`; `npm run db:generate -- --name <descricao>` gera o SQL em `drizzle/`, aplicado no startup (caminho relativo ao diretório de trabalho). Migration aplicada nunca é editada.
- Ordem por requisição: guards antes dos pipes. Anônimo com corpo inválido recebe 401, não 400.
- `bcrypt` e o cliente Kafka são nativos; o npm 11 só roda os scripts de instalação listados em `allowScripts`.
- O módulo Kafka do Testcontainers só aceita imagens Confluent; o e2e usa `confluentinc/cp-kafka:8.0.0`, o compose usa `apache/kafka`.
- O compose tem `name: user-template-node` e usa as portas 5432/9092, as mesmas dos templates Java e Go: pare um antes de subir o outro.
