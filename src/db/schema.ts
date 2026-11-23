// Schema do banco (mesmo dos templates Java e Go). Mudou aqui? `npm run db:generate`
// cria a migration em drizzle/; migration aplicada nunca é editada.
import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const instant = (name: string) =>
  timestamp(name, { precision: 6, withTimezone: true });

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    active: boolean('active').notNull(),
    createdAt: instant('created_at').notNull(),
  },
  (t) => [unique('uk_users_email').on(t.email)],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id').notNull(),
    role: varchar('role', { length: 32 }).notNull(),
  },
  (t) => [
    primaryKey({ name: 'pk_user_roles', columns: [t.userId, t.role] }),
    foreignKey({
      name: 'fk_user_roles_user',
      columns: [t.userId],
      foreignColumns: [users.id],
    }),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
    userId: uuid('user_id').notNull(),
    expiresAt: instant('expires_at').notNull(),
  },
  (t) => [index('idx_refresh_tokens_user').on(t.userId)],
);

export const outbox = pgTable(
  'outbox',
  {
    id: uuid('id').primaryKey(),
    topic: varchar('topic', { length: 255 }).notNull(),
    messageKey: varchar('message_key', { length: 255 }).notNull(),
    payload: text('payload').notNull(),
    createdAt: instant('created_at').notNull(),
    publishedAt: instant('published_at'),
  },
  // O relay só lê pendentes; índice parcial fica pequeno mesmo com o histórico crescendo
  (t) => [
    index('idx_outbox_pending')
      .on(t.createdAt)
      .where(sql`${t.publishedAt} IS NULL`),
  ],
);
