// Domínio puro: só TypeScript, sem Nest, Drizzle ou Kafka (dependency-cruiser garante).
// Dados imutáveis + funções que devolvem um User novo.
import { randomUUID } from 'node:crypto';

export type Role = 'USER' | 'ADMIN';

/** Violação de regra de entrada/domínio; a borda HTTP responde 400. */
export class DomainValidationError extends Error {
  override name = 'DomainValidationError';
}

/** Senha já com hash. Mascarada em log, JSON e inspect para não vazar. */
export class PasswordHash {
  constructor(readonly value: string) {
    if (!value) throw new DomainValidationError('Hash de senha é obrigatório');
  }
  toString() {
    return '***';
  }
  toJSON() {
    return '***';
  }
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return 'PasswordHash(***)';
  }
}

export interface User {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: PasswordHash;
  readonly roles: readonly Role[];
  readonly active: boolean;
  readonly createdAt: Date;
}

const NAME_MAX_LENGTH = 120;
const EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Emails comparam sem diferenciar caixa: trim + minúsculas + formato. */
export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!email) throw new DomainValidationError('Email é obrigatório');
  if (!EMAIL_FORMAT.test(email))
    throw new DomainValidationError(`Email inválido: ${email}`);
  return email;
}

function validName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new DomainValidationError('Nome é obrigatório');
  if (name.length > NAME_MAX_LENGTH) {
    throw new DomainValidationError(
      `Nome excede ${NAME_MAX_LENGTH} caracteres`,
    );
  }
  return name;
}

/** Cadastro de um usuário novo: papel USER, ativo, id gerado aqui (não no banco). */
export function registerUser(
  input: { email: string; name: string; passwordHash: PasswordHash },
  now: Date,
): User {
  return {
    id: randomUUID(),
    email: normalizeEmail(input.email),
    name: validName(input.name),
    passwordHash: input.passwordHash,
    roles: ['USER'],
    active: true,
    createdAt: now,
  };
}

export const rename = (user: User, name: string): User => ({
  ...user,
  name: validName(name),
});

export const deactivate = (user: User): User => ({ ...user, active: false });

export const grant = (user: User, role: Role): User =>
  user.roles.includes(role) ? user : { ...user, roles: [...user.roles, role] };

/** Evento de domínio: pedido de boas-vindas. */
export interface WelcomeRequested {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly occurredAt: Date;
}
