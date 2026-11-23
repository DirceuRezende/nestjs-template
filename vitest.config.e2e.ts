import { defineConfig } from 'vitest/config';

// e2e: Postgres + Kafka reais (Testcontainers, test/global-setup.ts); precisa de Docker.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false, // um banco só para todos os arquivos
    hookTimeout: 180_000,
  },
});
