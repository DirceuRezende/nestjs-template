import { AsyncLocalStorage } from 'node:async_hooks';
import { resolve } from 'node:path';
import {
  Injectable,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { Env } from '../config.js';
import * as schema from './schema.js';

const connect = (pool: Pool) => drizzle(pool, { schema });
type Root = ReturnType<typeof connect>;
type Tx = Parameters<Parameters<Root['transaction']>[0]>[0];

/**
 * Conexão Drizzle + transação ambiente: dentro de `transaction(fn)`, `db` devolve a
 * transação (AsyncLocalStorage), então os repositórios participam sem receber `tx`.
 */
@Injectable()
export class Database implements OnModuleInit, OnApplicationShutdown {
  private readonly pool: Pool;
  private readonly root: Root;
  private readonly current = new AsyncLocalStorage<Tx>();

  constructor(config: ConfigService<Env, true>) {
    this.pool = new Pool({
      connectionString: config.get('DATABASE_URL', { infer: true }),
    });
    this.root = connect(this.pool);
  }

  get db(): Root | Tx {
    return this.current.getStore() ?? this.root;
  }

  transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (this.current.getStore()) return fn(); // já numa transação: participa dela
    return this.root.transaction((tx) => this.current.run(tx, fn));
  }

  /** Aplica migrations pendentes de drizzle/ (relativo ao diretório de trabalho). */
  async onModuleInit() {
    await migrate(this.root, { migrationsFolder: resolve('drizzle') });
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
