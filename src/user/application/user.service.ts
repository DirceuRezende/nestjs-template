import { Injectable } from '@nestjs/common';
import {
  deactivate,
  DomainValidationError,
  registerUser,
  rename,
  type User,
} from '../domain/user.js';
import {
  Clock,
  PasswordHasher,
  RefreshTokenStore,
  Transactor,
  UserEvents,
  UserRepository,
  WelcomeNotifier,
} from './ports.js';

export const MIN_PASSWORD_LENGTH = 8;

export type RegisterResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'email-taken'; email: string };

/** Casos de uso de usuário. Não sabe nada de HTTP: "não achou" é undefined/false. */
@Injectable()
export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenStore,
    private readonly tx: Transactor,
    private readonly hasher: PasswordHasher,
    private readonly events: UserEvents,
    private readonly notifier: WelcomeNotifier,
    private readonly clock: Clock,
  ) {}

  async register(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<RegisterResult> {
    // Política de senha precisa da senha crua, então fica antes do hash (não no domínio).
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new DomainValidationError(
        `Senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres`,
      );
    }
    const user = registerUser(
      { ...input, passwordHash: await this.hasher.hash(input.password) },
      this.clock.now(),
    );
    return (await this.users.create(user))
      ? { ok: true, user }
      : { ok: false, reason: 'email-taken', email: user.email };
  }

  get(id: string): Promise<User | undefined> {
    return this.users.findById(id);
  }

  async list(page: number, size: number) {
    const { items, total } = await this.users.list(page * size, size);
    return { items, page, size, total };
  }

  async rename(id: string, name: string): Promise<User | undefined> {
    const user = await this.users.findById(id);
    if (!user) return undefined;
    const renamed = rename(user, name);
    await this.users.save(renamed);
    return renamed;
  }

  /** Soft delete + derruba as sessões. Repetir é ok (continua true). */
  delete(id: string): Promise<boolean> {
    return this.tx.run(async () => {
      const user = await this.users.findById(id);
      if (!user) return false;
      await this.users.save(deactivate(user));
      await this.refreshTokens.deleteAllOf(id);
      return true;
    });
  }

  /** Só registra o evento (outbox); o envio acontece no consumer Kafka. */
  async requestWelcome(id: string): Promise<boolean> {
    const user = await this.users.findById(id);
    if (!user?.active) return false;
    await this.events.welcomeRequested({
      userId: user.id,
      email: user.email,
      name: user.name,
      occurredAt: this.clock.now(),
    });
    return true;
  }

  /** Roda no consumer. Entrega é at-least-once: precisa tolerar repetição. */
  sendWelcome(event: { email: string; name: string }): Promise<void> {
    return this.notifier.welcome(event.email, event.name);
  }
}
