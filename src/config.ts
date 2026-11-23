import { z } from 'zod';

// Só para desenvolvimento local (NODE_ENV=development).
export const DEV_JWT_SECRET = 'dev-only-secret-change-me-0123456789abcdef';
export const DEV_ADMIN = { email: 'admin@example.com', password: 'admin12345' };

/** Ambiente validado no boot: app não sobe com config inválida. Defaults = docker-compose.yml. */
export const envSchema = z
  .object({
    NODE_ENV: z.string().default('production'),
    PORT: z.coerce.number().int().default(8080),
    DATABASE_URL: z
      .string()
      .default('postgres://users:users@localhost:5432/users'),
    KAFKA_BOOTSTRAP_SERVERS: z.string().default('localhost:9092'),
    JWT_SECRET: z.string().optional(),
    ACCESS_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60),
    REFRESH_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(7 * 24 * 3600),
    OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  })
  .transform((env) => ({
    ...env,
    JWT_SECRET:
      env.JWT_SECRET ?? (env.NODE_ENV === 'development' ? DEV_JWT_SECRET : ''),
  }))
  .refine((env) => Buffer.byteLength(env.JWT_SECRET) >= 32, {
    message: 'JWT_SECRET é obrigatório e precisa de ao menos 32 bytes',
    path: ['JWT_SECRET'],
  });

export type Env = z.infer<typeof envSchema>;
