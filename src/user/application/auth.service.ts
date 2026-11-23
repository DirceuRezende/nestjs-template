import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { normalizeEmail, type User } from '../domain/user.js';
import {
  AccessTokenIssuer,
  Clock,
  PasswordHasher,
  RefreshTokenStore,
  Transactor,
  UserRepository,
} from './ports.js';

/** Configuração dos tokens; montada em user.module.ts a partir do ambiente. */
export class AuthSettings {
  constructor(readonly refreshTtlMs: number) {}
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string; // valor cru: só o cliente tem; no banco fica o hash
  expiresInSeconds: number;
}

export const hashToken = (raw: string) =>
  createHash('sha256').update(raw).digest('hex');

/** Login, refresh e logout. Falha de autenticação é undefined: a borda decide o 401. */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenStore,
    private readonly tx: Transactor,
    private readonly hasher: PasswordHasher,
    private readonly accessTokens: AccessTokenIssuer,
    private readonly clock: Clock,
    private readonly settings: AuthSettings,
  ) {}

  async login(email: string, password: string): Promise<TokenPair | undefined> {
    let normalized: string;
    try {
      normalized = normalizeEmail(email);
    } catch {
      return undefined;
    }
    const user = await this.users.findByEmail(normalized);
    // shortcut: usuário inexistente responde mais rápido que senha errada (timing), upgrade: hash dummy + rate limit
    if (
      !user?.active ||
      !(await this.hasher.matches(user.passwordHash, password))
    )
      return undefined;
    return this.issue(user);
  }

  /**
   * Troca o refresh token por um par novo. Cada token vale uma vez (rotação): é apagado mesmo se já expirou.
   * shortcut: reuso de token já rotacionado não é detectado, upgrade: famílias de token + revogar a família no reuso
   */
  refresh(raw: string): Promise<TokenPair | undefined> {
    return this.tx.run(async () => {
      const stored = await this.refreshTokens.take(hashToken(raw));
      if (!stored || stored.expiresAt <= this.clock.now()) return undefined;
      const user = await this.users.findById(stored.userId);
      return user?.active ? this.issue(user) : undefined;
    });
  }

  /** Revoga só o refresh token informado; o access token vale até expirar (stateless). */
  logout(raw: string): Promise<void> {
    return this.refreshTokens.delete(hashToken(raw));
  }

  private async issue(user: User): Promise<TokenPair> {
    const access = await this.accessTokens.issue(user);
    const refreshToken = randomBytes(32).toString('base64url');
    await this.refreshTokens.save({
      hash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(
        this.clock.now().getTime() + this.settings.refreshTtlMs,
      ),
    });
    return {
      accessToken: access.token,
      refreshToken,
      expiresInSeconds: access.expiresInSeconds,
    };
  }
}
