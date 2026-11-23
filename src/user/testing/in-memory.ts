// Fakes em memória das ports, para testes sem banco/broker. Não use fora de teste.
import {
  PasswordHash,
  type User,
  type WelcomeRequested,
} from '../domain/user.js';
import {
  AccessTokenIssuer,
  Clock,
  PasswordHasher,
  RefreshTokenStore,
  type StoredRefreshToken,
  Transactor,
  UserEvents,
  UserRepository,
  WelcomeNotifier,
} from '../application/ports.js';
import { AuthService, AuthSettings } from '../application/auth.service.js';
import { UserService } from '../application/user.service.js';

export class InMemoryUserRepository extends UserRepository {
  readonly byId = new Map<string, User>();

  async create(user: User) {
    if ([...this.byId.values()].some((u) => u.email === user.email))
      return false;
    this.byId.set(user.id, user);
    return true;
  }
  async save(user: User) {
    this.byId.set(user.id, user);
  }
  async findById(id: string) {
    return this.byId.get(id);
  }
  async findByEmail(email: string) {
    return [...this.byId.values()].find((u) => u.email === email);
  }
  async list(offset: number, limit: number) {
    const all = [...this.byId.values()].sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
    return { items: all.slice(offset, offset + limit), total: all.length };
  }
}

export class InMemoryRefreshTokenStore extends RefreshTokenStore {
  readonly byHash = new Map<string, StoredRefreshToken>();

  async save(token: StoredRefreshToken) {
    this.byHash.set(token.hash, token);
  }
  async take(hash: string) {
    const token = this.byHash.get(hash);
    this.byHash.delete(hash);
    return token;
  }
  async delete(hash: string) {
    this.byHash.delete(hash);
  }
  async deleteAllOf(userId: string) {
    for (const [hash, t] of this.byHash)
      if (t.userId === userId) this.byHash.delete(hash);
  }
}

/** Sem rollback: os testes de caso de uso não dependem disso. */
export class NoTransactor extends Transactor {
  run<T>(fn: () => Promise<T>) {
    return fn();
  }
}

/** "Hash" reversível e rápido. */
export class FakeHasher extends PasswordHasher {
  async hash(raw: string) {
    return new PasswordHash(`hashed:${raw}`);
  }
  async matches(hash: PasswordHash, raw: string) {
    return hash.value === `hashed:${raw}`;
  }
}

export class FakeAccessTokens extends AccessTokenIssuer {
  async issue(user: User) {
    return { token: `access-${user.id}`, expiresInSeconds: 900 };
  }
}

export class RecordingEvents extends UserEvents {
  readonly published: WelcomeRequested[] = [];
  async welcomeRequested(event: WelcomeRequested) {
    this.published.push(event);
  }
}

export class RecordingNotifier extends WelcomeNotifier {
  readonly sent: string[] = [];
  async welcome(email: string) {
    this.sent.push(email);
  }
}

export class FixedClock extends Clock {
  constructor(public current = new Date('2026-01-01T12:00:00Z')) {
    super();
  }
  now() {
    return this.current;
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

/** Monta os dois serviços só com fakes (sem Nest). */
export function inMemoryServices() {
  const deps = {
    users: new InMemoryUserRepository(),
    tokens: new InMemoryRefreshTokenStore(),
    events: new RecordingEvents(),
    notifier: new RecordingNotifier(),
    clock: new FixedClock(),
  };
  const tx = new NoTransactor();
  const hasher = new FakeHasher();
  return {
    ...deps,
    userService: new UserService(
      deps.users,
      deps.tokens,
      tx,
      hasher,
      deps.events,
      deps.notifier,
      deps.clock,
    ),
    authService: new AuthService(
      deps.users,
      deps.tokens,
      tx,
      hasher,
      new FakeAccessTokens(),
      deps.clock,
      new AuthSettings(7 * 24 * 3600 * 1000),
    ),
  };
}
