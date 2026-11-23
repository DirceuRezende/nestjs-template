import { inspect } from 'node:util';
import {
  DomainValidationError,
  grant,
  PasswordHash,
  registerUser,
  rename,
} from './user.js';

const hash = new PasswordHash('h');
const now = new Date('2026-01-01T00:00:00Z');

describe('User', () => {
  it('aplica as regras de cadastro', () => {
    const user = registerUser(
      { email: '  Ana@Example.COM ', name: '  Ana ', passwordHash: hash },
      now,
    );
    expect(user).toMatchObject({
      email: 'ana@example.com',
      name: 'Ana',
      roles: ['USER'],
      active: true,
      createdAt: now,
    });
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each([
    ['email vazio', '', 'Ana'],
    ['email inválido', 'not-an-email', 'Ana'],
    ['nome em branco', 'a@example.com', '  '],
    ['nome longo', 'a@example.com', 'a'.repeat(121)],
  ])('rejeita %s', (_, email, name) => {
    expect(() =>
      registerUser({ email, name, passwordHash: hash }, now),
    ).toThrow(DomainValidationError);
  });

  it('renomeia com trim e concede papel sem duplicar', () => {
    const user = registerUser(
      { email: 'a@example.com', name: 'Ana', passwordHash: hash },
      now,
    );
    expect(rename(user, '  Bia ').name).toBe('Bia');
    expect(() => rename(user, ' ')).toThrow(DomainValidationError);
    expect(grant(grant(user, 'ADMIN'), 'ADMIN').roles).toEqual([
      'USER',
      'ADMIN',
    ]);
    expect(user.roles).toEqual(['USER']); // imutável
  });

  it('mascara o hash em log e JSON', () => {
    const secret = new PasswordHash('$2b$secret');
    expect(String(secret)).toBe('***');
    expect(JSON.stringify({ secret })).toBe('{"secret":"***"}');
    expect(inspect({ secret })).not.toContain('$2b$');
  });
});
