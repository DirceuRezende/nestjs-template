import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { Database } from '../src/db/database.js';
import {
  PasswordHasher,
  UserRepository,
  WelcomeNotifier,
} from '../src/user/application/ports.js';
import { grant, registerUser } from '../src/user/domain/user.js';
import { RecordingNotifier } from '../src/user/testing/in-memory.js';

/** O app inteiro (Postgres e Kafka reais), com o notifier trocado por um que grava. */
export async function createApp() {
  const notifier = new RecordingNotifier();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(WelcomeNotifier)
    .useValue(notifier)
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init(); // sem porta: supertest usa o server direto
  return { app, notifier, http: () => request(app.getHttpServer()) };
}

export async function resetDatabase(app: INestApplication) {
  await app
    .get(Database)
    .db.execute(sql`TRUNCATE users, user_roles, refresh_tokens, outbox`);
}

export interface Session {
  id: string;
  accessToken: string;
  refreshToken: string;
  bearer: string;
}

export async function login(
  app: INestApplication,
  email: string,
  password: string,
  id = '',
): Promise<Session> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  return { id, ...res.body, bearer: `Bearer ${res.body.accessToken}` };
}

export async function signup(
  app: INestApplication,
  email: string,
): Promise<Session> {
  const res = await request(app.getHttpServer())
    .post('/api/users')
    .send({ name: 'Ana', email, password: 'secret123' })
    .expect(201);
  return login(app, email, 'secret123', res.body.id);
}

export async function admin(app: INestApplication): Promise<Session> {
  const passwordHash = await app.get(PasswordHasher).hash('admin12345');
  const user = grant(
    registerUser(
      { email: 'admin@example.com', name: 'Admin', passwordHash },
      new Date(),
    ),
    'ADMIN',
  );
  await app.get(UserRepository).create(user);
  return login(app, 'admin@example.com', 'admin12345', user.id);
}
