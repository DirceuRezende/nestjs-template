import { vi } from 'vitest';
import { createApp, resetDatabase, signup } from './app.js';

// HTTP → outbox → relay → Kafka → consumer → notifier, tudo de verdade.
describe('Welcome flow (e2e)', () => {
  it('entrega as boas-vindas pelo Kafka', async () => {
    const { app, notifier, http } = await createApp();
    try {
      await resetDatabase(app);
      const ana = await signup(app, 'ana@example.com');
      await http()
        .post(`/api/users/${ana.id}/welcome`)
        .set({ Authorization: ana.bearer })
        .expect(202);
      await vi.waitFor(
        () => expect(notifier.sent).toContain('ana@example.com'),
        { timeout: 30_000, interval: 200 },
      );
    } finally {
      await app.close();
    }
  }, 60_000);
});
