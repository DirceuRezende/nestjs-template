import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { admin, createApp, resetDatabase, signup } from './app.js';

// Contrato HTTP + segurança, igual aos templates Java (UserControllerTest/SecurityTest) e Go.
describe('API (e2e)', () => {
  let app: INestApplication;
  let http: Awaited<ReturnType<typeof createApp>>['http'];

  beforeAll(async () => ({ app, http } = await createApp()));
  afterAll(() => app.close());
  beforeEach(() => resetDatabase(app));

  it('cadastro: 201 + Location, sem senha, 409 sem diferenciar caixa, 400 inválido', async () => {
    const res = await http()
      .post('/api/users')
      .send({ name: 'Ana', email: 'Dup@Example.com', password: 'secret123' })
      .expect(201);
    expect(res.headers.location).toBe(`/api/users/${res.body.id}`);
    expect(res.body).toMatchObject({
      email: 'dup@example.com',
      roles: ['USER'],
      active: true,
    });
    expect(res.body).not.toHaveProperty('password');
    expect(res.body).not.toHaveProperty('passwordHash');

    const dup = await http()
      .post('/api/users')
      .send({ name: 'Outra', email: 'DUP@example.com', password: 'secret123' })
      .expect(409);
    expect(dup.headers['content-type']).toContain('application/problem+json');
    expect(dup.body).toMatchObject({
      status: 409,
      detail: 'Email já cadastrado: dup@example.com',
    });

    for (const body of [
      { name: 'Ana', email: 'a@example.com', password: '123' },
      { name: 'Ana', email: 'not-an-email', password: 'secret123' },
      { name: ' ', email: 'a@example.com', password: 'secret123' },
    ]) {
      await http().post('/api/users').send(body).expect(400);
    }
  });

  it('rotas protegidas exigem token válido', async () => {
    const id = randomUUID();
    await http().get('/api/users').expect(401);
    await http().get(`/api/users/${id}`).expect(401);
    await http().delete(`/api/users/${id}`).expect(401);
    await http().post(`/api/users/${id}/welcome`).expect(401);

    const ana = await signup(app, 'ana@example.com');
    await http()
      .get(`/api/users/${ana.id}`)
      .set('Authorization', `${ana.bearer}x`)
      .expect(401);
    const expired = await app
      .get(JwtService)
      .signAsync({ roles: ['USER'] }, { subject: ana.id, expiresIn: -60 });
    await http()
      .get(`/api/users/${ana.id}`)
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
  });

  it('login: 200 com o par, 401 genérico, 400 sem corpo', async () => {
    await signup(app, 'ana@example.com');
    const res = await http()
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: 'secret123' })
      .expect(200);
    expect(res.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    await http()
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: 'errada123' })
      .expect(401);
    await http()
      .post('/api/auth/login')
      .send({ email: 'x@example.com', password: 'secret123' })
      .expect(401);
    await http()
      .post('/api/auth/login')
      .send({ email: '', password: '' })
      .expect(400);
  });

  it('usuário só gerencia a si mesmo', async () => {
    const ana = await signup(app, 'ana@example.com');
    const bob = await signup(app, 'bob@example.com');
    const as = (s: typeof ana) => ({ Authorization: s.bearer });

    await http().get(`/api/users/${ana.id}`).set(as(ana)).expect(200);
    const renamed = await http()
      .put(`/api/users/${ana.id}`)
      .set(as(ana))
      .send({ name: '  Ana 2 ' })
      .expect(200);
    expect(renamed.body.name).toBe('Ana 2');
    await http()
      .put(`/api/users/${ana.id}`)
      .set(as(ana))
      .send({ name: ' ' })
      .expect(400);

    await http().get(`/api/users/${bob.id}`).set(as(ana)).expect(403);
    await http()
      .put(`/api/users/${bob.id}`)
      .set(as(ana))
      .send({ name: 'x' })
      .expect(403);
    await http().delete(`/api/users/${bob.id}`).set(as(ana)).expect(403);
    await http().post(`/api/users/${bob.id}/welcome`).set(as(ana)).expect(403);
    await http().get('/api/users').set(as(ana)).expect(403);

    await http().post(`/api/users/${ana.id}/welcome`).set(as(ana)).expect(202);
    await http().delete(`/api/users/${ana.id}`).set(as(ana)).expect(204);
  });

  it('admin gerencia qualquer um', async () => {
    const adm = { Authorization: (await admin(app)).bearer };
    const ana = await signup(app, 'ana@example.com');
    const missing = randomUUID();

    await http().get(`/api/users/${ana.id}`).set(adm).expect(200);
    await http().get(`/api/users/${missing}`).set(adm).expect(404);
    await http().get('/api/users/not-a-uuid').set(adm).expect(400);
    await http()
      .put(`/api/users/${ana.id}`)
      .set(adm)
      .send({ name: 'Renomeada' })
      .expect(200);
    await http()
      .put(`/api/users/${missing}`)
      .set(adm)
      .send({ name: 'x' })
      .expect(404);
    await http().post(`/api/users/${ana.id}/welcome`).set(adm).expect(202);
    await http().post(`/api/users/${missing}/welcome`).set(adm).expect(404);
    await http().delete(`/api/users/${ana.id}`).set(adm).expect(204);
    await http().delete(`/api/users/${ana.id}`).set(adm).expect(204); // soft delete idempotente
    await http().delete(`/api/users/${missing}`).set(adm).expect(404);
    await http().post(`/api/users/${ana.id}/welcome`).set(adm).expect(404); // inativo
  });

  it('lista paginada (só ADMIN) com validação', async () => {
    const adm = { Authorization: (await admin(app)).bearer };
    await signup(app, 'ana@example.com');
    await signup(app, 'bob@example.com');

    const page = await http()
      .get('/api/users?page=1&size=2')
      .set(adm)
      .expect(200);
    expect(page.body).toMatchObject({ page: 1, size: 2, total: 3 });
    expect(page.body.items).toHaveLength(1);
    const defaults = await http().get('/api/users').set(adm).expect(200);
    expect(defaults.body).toMatchObject({ page: 0, size: 20 });
    for (const q of ['page=-1', 'size=0', 'size=101', 'page=abc']) {
      await http().get(`/api/users?${q}`).set(adm).expect(400);
    }
  });

  it('refresh rotaciona; logout revoga', async () => {
    const ana = await signup(app, 'ana@example.com');
    const refresh = (refreshToken: string) =>
      http().post('/api/auth/refresh').send({ refreshToken });

    await refresh(ana.refreshToken).expect(200);
    await refresh(ana.refreshToken).expect(401);

    const again = (
      await http()
        .post('/api/auth/login')
        .send({ email: 'ana@example.com', password: 'secret123' })
    ).body;
    await http()
      .post('/api/auth/logout')
      .send({ refreshToken: again.refreshToken })
      .expect(204);
    await refresh(again.refreshToken).expect(401);
    await http().post('/api/auth/logout').send({}).expect(400);
  });

  it('usuário removido não loga nem renova', async () => {
    const ana = await signup(app, 'ana@example.com');
    await http()
      .delete(`/api/users/${ana.id}`)
      .set({ Authorization: ana.bearer })
      .expect(204);
    await http()
      .post('/api/auth/refresh')
      .send({ refreshToken: ana.refreshToken })
      .expect(401);
    await http()
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: 'secret123' })
      .expect(401);
  });

  it('OpenAPI: documento com rotas, schemas do Zod e bearer', async () => {
    const { body } = await http().get('/api/docs-json').expect(200);
    expect(Object.keys(body.paths)).toEqual(
      expect.arrayContaining([
        '/api/users',
        '/api/users/{id}',
        '/api/auth/login',
      ]),
    );
    const register =
      body.paths['/api/users'].post.requestBody.content['application/json']
        .schema;
    expect(register.required).toEqual(['name', 'email', 'password']);
    expect(body.paths['/api/users'].get.security).toEqual([{ bearer: [] }]);
    await http().get('/api/docs').expect(200);
  });
});
