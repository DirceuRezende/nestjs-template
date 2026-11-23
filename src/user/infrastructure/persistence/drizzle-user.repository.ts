import { Injectable } from '@nestjs/common';
import { asc, count, eq, getTableColumns, sql, type SQL } from 'drizzle-orm';
import { Database } from '../../../db/database.js';
import { userRoles, users } from '../../../db/schema.js';
import { UserRepository } from '../../application/ports.js';
import { PasswordHash, type Role, type User } from '../../domain/user.js';

// Papéis agregados numa coluna; DESC deixa USER antes de ADMIN, como nos outros templates.
const roles = sql<
  Role[]
>`array_agg(${userRoles.role} order by ${userRoles.role} desc)`;

type Row = typeof users.$inferSelect & { roles: Role[] };

const toDomain = ({ passwordHash, ...row }: Row): User => ({
  ...row,
  passwordHash: new PasswordHash(passwordHash),
});

/** Erro do driver pg (o Drizzle embrulha em `cause`). */
const pgError = (e: unknown) =>
  ((e as { cause?: unknown }).cause ?? e) as {
    code?: string;
    constraint?: string;
  };

@Injectable()
export class DrizzleUserRepository extends UserRepository {
  constructor(private readonly database: Database) {
    super();
  }

  async create(user: User): Promise<boolean> {
    try {
      await this.database.transaction(async () => {
        await this.database.db.insert(users).values(this.toRow(user));
        await this.insertRoles(user);
      });
      return true;
    } catch (e) {
      if (pgError(e).constraint === 'uk_users_email') return false;
      throw e;
    }
  }

  save(user: User): Promise<void> {
    return this.database.transaction(async () => {
      const { name, passwordHash, active } = this.toRow(user);
      await this.database.db
        .update(users)
        .set({ name, passwordHash, active })
        .where(eq(users.id, user.id));
      await this.database.db
        .delete(userRoles)
        .where(eq(userRoles.userId, user.id));
      await this.insertRoles(user);
    });
  }

  findById(id: string) {
    return this.findOne(eq(users.id, id));
  }

  findByEmail(email: string) {
    return this.findOne(eq(users.email, email));
  }

  async list(offset: number, limit: number) {
    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(users);
    const rows = await this.selectUsers()
      .orderBy(asc(users.createdAt), asc(users.id))
      .limit(limit)
      .offset(offset);
    return { items: rows.map(toDomain), total };
  }

  private async findOne(where: SQL) {
    const [row] = await this.selectUsers().where(where);
    return row && toDomain(row);
  }

  private selectUsers() {
    return this.database.db
      .select({ ...getTableColumns(users), roles })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .groupBy(users.id)
      .$dynamic();
  }

  private toRow(user: User): typeof users.$inferInsert {
    const { roles: _, passwordHash, ...rest } = user;
    return { ...rest, passwordHash: passwordHash.value };
  }

  private async insertRoles(user: User) {
    await this.database.db
      .insert(userRoles)
      .values(user.roles.map((role) => ({ userId: user.id, role })));
  }
}
