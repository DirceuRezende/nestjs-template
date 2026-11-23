---
name: use-case
description: Receita para criar ou alterar um caso de uso neste projeto NestJS hexagonal (método em UserService/AuthService, port abstract class, teste com fakes em memória). Use ao criar uma regra de negócio, um caso de uso ou uma port nova.
---

# Criar um caso de uso

Um caso de uso é um método de um serviço em `src/user/application/` (`UserService`, `AuthService`). Modelos vivos: `UserService.delete` (escrita atômica com `Transactor`), `UserService.get` (leitura, `undefined`), `UserService.register` (resultado em união discriminada `RegisterResult`), `UserService.requestWelcome` (publica evento).

## Passos

1. **Método** no serviço da área (ou um serviço novo `@Injectable` em `application/`, registrado em `providers` do `user.module.ts`).
   - Entrada: tipos simples ou um objeto literal tipado.
   - Saída: tipos do domínio. "Não achou" é `undefined`/`false`; resultado de negócio esperado é união discriminada (`{ ok: true, ... } | { ok: false, reason: ... }`); entrada inválida lança `DomainValidationError`.
2. **Regras:** invariantes ficam no domínio (`domain/user.ts`, funções puras que devolvem um `User` novo). Política que precisa da entrada crua fica no caso de uso (ex.: tamanho mínimo da senha antes do hash). Tempo vem de `this.clock.now()`.
3. **Port nova:** `abstract class` em `application/ports.ts`, falando em tipos do domínio. Implemente em `infrastructure/` (skills `persistence` e `messaging`), ligue com `{ provide: Port, useClass: Adapter }` no `user.module.ts` e crie o fake em `src/user/testing/in-memory.ts` (incluindo em `inMemoryServices()`).
4. **Atomicidade:** mais de uma escrita → `this.tx.run(async () => { ... })`. Os adapters chamados dentro participam sozinhos.
5. **Teste** em `src/user/application/services.spec.ts`, só com `inMemoryServices()` (sem Nest): caminho feliz e cada saída alternativa (não encontrado, inativo, `ok: false`, `DomainValidationError`).

## Pronto quando

Cada saída do método tem teste, `npm test` passa e `npm run lint` continua limpo (o dependency-cruiser pega import de infra em `application/`). Para expor por HTTP, siga a skill `endpoint`.
