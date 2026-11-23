---
name: endpoint
description: Receita para criar ou alterar um endpoint HTTP neste projeto NestJS (controller, schema Zod, status, guards de acesso, e2e com supertest). Use ao criar uma rota, um controller ou uma regra de acesso HTTP.
---

# Criar um endpoint

O controller só traduz HTTP para um método de serviço; o caso de uso vem antes (skill `use-case`). Modelos: `UserController` e `AuthController` em `src/user/infrastructure/http/`. O prefixo `/api` vem do `app.setup.ts`.

## Passos

1. **Schema** Zod em `http/schemas.ts` + tipo com `z.infer`. Use no handler: `@Body({ schema })`, `@Query({ schema })`, `@Param('id', { schema: userId })`. Strings de query/path são convertidas com `z.coerce`.
2. **Handler:** uma chamada de serviço e o mapeamento da resposta (`toResponse`). Nunca devolva o `User` do domínio.
3. **Status:**
   | Caso | Como |
   |---|---|
   | criar | `@Post()` (201) + `res.location(...)` com `@Res({ passthrough: true })` |
   | POST que não cria (login, ação) | `@HttpCode(200)` |
   | ler/atualizar | 200; `undefined` → `orNotFound` (404) |
   | remover | `@HttpCode(204)` |
   | assíncrono (outbox/Kafka) | `@HttpCode(202)` |
   | resultado esperado (`ok: false`) | `throw new ConflictException(...)` (ou o status do contrato) |
   | entrada inválida | 400 automático (schema, `DomainValidationError`) |
   Toda exceção vira problem+json pelos filtros.
4. **Acesso** com `@UseGuards` na rota (guards em `http/guards.ts`):
   - público: sem guard;
   - dono ou admin: `@UseGuards(AuthGuard, SelfOrAdminGuard)` (compara o `sub` do JWT com `:id`);
   - só admin: `@UseGuards(AuthGuard, AdminGuard)`.
5. **Testes e2e** em `test/api.e2e-spec.ts` (app inteiro, Postgres real; helpers `signup`, `admin`, `login` em `test/app.ts`):
   - acesso: anônimo `401`, outro usuário `403`, o próprio e o admin o sucesso, id inexistente `404`;
   - comportamento: payload, cada status da tabela que a rota devolve e o que o JSON **não** contém.
6. **Contrato:** a rota existe igual nos templates Java e Go; atualize `api.http` e a tabela de endpoints do README.

## Pronto quando

Cada status possível tem teste, as quatro situações de acesso estão cobertas e `npm run check` passa.
