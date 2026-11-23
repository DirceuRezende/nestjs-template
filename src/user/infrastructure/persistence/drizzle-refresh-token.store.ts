import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Database } from '../../../db/database.js';
import { refreshTokens } from '../../../db/schema.js';
import {
  RefreshTokenStore,
  type StoredRefreshToken,
  Transactor,
} from '../../application/ports.js';

@Injectable()
export class DrizzleRefreshTokenStore extends RefreshTokenStore {
  constructor(private readonly database: Database) {
    super();
  }

  async save(token: StoredRefreshToken) {
    await this.database.db.insert(refreshTokens).values({
      tokenHash: token.hash,
      userId: token.userId,
      expiresAt: token.expiresAt,
    });
  }

  async take(hash: string) {
    const [row] = await this.database.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hash))
      .returning();
    return (
      row && {
        hash: row.tokenHash,
        userId: row.userId,
        expiresAt: row.expiresAt,
      }
    );
  }

  async delete(hash: string) {
    await this.database.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hash));
  }

  async deleteAllOf(userId: string) {
    await this.database.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.userId, userId));
  }
}

@Injectable()
export class DrizzleTransactor extends Transactor {
  constructor(private readonly database: Database) {
    super();
  }

  run<T>(fn: () => Promise<T>) {
    return this.database.transaction(fn);
  }
}
