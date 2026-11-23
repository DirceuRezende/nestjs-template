import { defineConfig } from 'drizzle-kit';

// Só gera SQL a partir do schema (npm run db:generate); quem aplica é o app no startup.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
