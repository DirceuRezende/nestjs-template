import { randomUUID } from 'node:crypto';
import { DomainValidationError } from '../domain/user.js';
import { inMemoryServices } from '../testing/in-memory.js';

async function withAna() {
  const s = inMemoryServices();
  const result = await s.userService.register({
    name: 'Ana',
    email: 'Ana@Example.com',
    password: 'secret123',
  });
  if (!result.ok) throw new Error('cadastro falhou');
  return { ...s, ana: result.user };
}

describe('UserService', () => {
  it('cadastra com hash e recusa email repetido sem diferenciar caixa', async () => {
    const { userService, ana } = await withAna();
    expect(ana.passwordHash.value).toBe('hashed:secret123');
    expect(
      await userService.register({
        name: 'Outra',
        email: 'ANA@example.com',
        password: 'secret123',
      }),
    ).toEqual({
      ok: false,
      reason: 'email-taken',
      email: 'ana@example.com',
    });
    await expect(
      userService.register({
        name: 'Bia',
        email: 'bia@example.com',
        password: '1234567',
      }),
    ).rejects.toThrow(DomainValidationError);
  });

  it('pagina por ordem de criação', async () => {
    const s = inMemoryServices();
    for (const email of ['a@x.com', 'b@x.com', 'c@x.com']) {
      await s.userService.register({ name: 'X', email, password: 'secret123' });
      s.clock.advance(1000);
    }
    const page = await s.userService.list(1, 2);
    expect(page).toMatchObject({ page: 1, size: 2, total: 3 });
    expect(page.items.map((u) => u.email)).toEqual(['c@x.com']);
  });

  it('renomeia e devolve undefined para inexistente', async () => {
    const { userService, ana } = await withAna();
    expect((await userService.rename(ana.id, '  Bia '))?.name).toBe('Bia');
    expect(await userService.rename(randomUUID(), 'Bia')).toBeUndefined();
  });

  it('delete é soft, idempotente e derruba as sessões', async () => {
    const { userService, authService, tokens, ana } = await withAna();
    const pair = await authService.login('ana@example.com', 'secret123');

    expect(await userService.delete(ana.id)).toBe(true);
    expect(await userService.delete(ana.id)).toBe(true);
    expect(await userService.delete(randomUUID())).toBe(false);
    expect((await userService.get(ana.id))?.active).toBe(false);
    expect(tokens.byHash.size).toBe(0);
    expect(await authService.refresh(pair!.refreshToken)).toBeUndefined();
    expect(
      await authService.login('ana@example.com', 'secret123'),
    ).toBeUndefined();
  });

  it('pede boas-vindas só para usuário ativo e entrega ao notifier', async () => {
    const { userService, events, notifier, clock, ana } = await withAna();
    expect(await userService.requestWelcome(ana.id)).toBe(true);
    expect(events.published).toEqual([
      {
        userId: ana.id,
        email: 'ana@example.com',
        name: 'Ana',
        occurredAt: clock.current,
      },
    ]);
    await userService.sendWelcome(events.published[0]);
    expect(notifier.sent).toEqual(['ana@example.com']);

    await userService.delete(ana.id);
    expect(await userService.requestWelcome(ana.id)).toBe(false);
  });
});

describe('AuthService', () => {
  it('login devolve o par e recusa credenciais ruins', async () => {
    const { authService } = await withAna();
    const pair = await authService.login(' ANA@example.com', 'secret123');
    expect(pair?.accessToken).toBeTruthy();
    expect(pair?.refreshToken).toHaveLength(43); // 32 bytes em base64url
    expect(
      await authService.login('ana@example.com', 'errada123'),
    ).toBeUndefined();
    expect(
      await authService.login('ninguem@example.com', 'secret123'),
    ).toBeUndefined();
    expect(
      await authService.login('not-an-email', 'secret123'),
    ).toBeUndefined();
  });

  it('refresh rotaciona e expira (apagando o expirado)', async () => {
    const { authService, tokens, clock } = await withAna();
    const first = (await authService.login('ana@example.com', 'secret123'))!;
    const second = await authService.refresh(first.refreshToken);
    expect(second?.refreshToken).not.toBe(first.refreshToken);
    expect(await authService.refresh(first.refreshToken)).toBeUndefined();

    clock.advance(7 * 24 * 3600 * 1000 + 1000);
    expect(await authService.refresh(second!.refreshToken)).toBeUndefined();
    expect(tokens.byHash.size).toBe(0);
  });

  it('logout revoga e é idempotente', async () => {
    const { authService } = await withAna();
    const pair = (await authService.login('ana@example.com', 'secret123'))!;
    await authService.logout(pair.refreshToken);
    await authService.logout(pair.refreshToken);
    expect(await authService.refresh(pair.refreshToken)).toBeUndefined();
  });
});
