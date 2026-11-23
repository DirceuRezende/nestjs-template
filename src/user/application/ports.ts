// Ports como abstract class: servem de tipo E de token de DI do Nest (sem @Inject('STRING')).
// Implementações em infrastructure/; fakes em testing/in-memory.ts.
import type { PasswordHash, User, WelcomeRequested } from '../domain/user.js';

export abstract class UserRepository {
  /** Devolve false se o email já existe. */
  abstract create(user: User): Promise<boolean>;
  abstract save(user: User): Promise<void>;
  abstract findById(id: string): Promise<User | undefined>;
  abstract findByEmail(email: string): Promise<User | undefined>;
  abstract list(
    offset: number,
    limit: number,
  ): Promise<{ items: User[]; total: number }>;
}

/** Refresh token persistido: só o hash, nunca o valor que o cliente recebe. */
export interface StoredRefreshToken {
  hash: string;
  userId: string;
  expiresAt: Date;
}

export abstract class RefreshTokenStore {
  abstract save(token: StoredRefreshToken): Promise<void>;
  /** Apaga e devolve (uso único). */
  abstract take(hash: string): Promise<StoredRefreshToken | undefined>;
  abstract delete(hash: string): Promise<void>;
  abstract deleteAllOf(userId: string): Promise<void>;
}

/** Roda fn numa transação; os repositórios chamados dentro dela participam sozinhos. */
export abstract class Transactor {
  abstract run<T>(fn: () => Promise<T>): Promise<T>;
}

export abstract class PasswordHasher {
  abstract hash(raw: string): Promise<PasswordHash>;
  abstract matches(hash: PasswordHash, raw: string): Promise<boolean>;
}

export abstract class AccessTokenIssuer {
  abstract issue(
    user: User,
  ): Promise<{ token: string; expiresInSeconds: number }>;
}

export abstract class UserEvents {
  abstract welcomeRequested(event: WelcomeRequested): Promise<void>;
}

export abstract class WelcomeNotifier {
  abstract welcome(email: string, name: string): Promise<void>;
}

export abstract class Clock {
  abstract now(): Date;
}
