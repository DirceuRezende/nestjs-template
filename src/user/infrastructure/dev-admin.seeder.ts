import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEV_ADMIN, type Env } from '../../config.js';
import { Clock, PasswordHasher, UserRepository } from '../application/ports.js';
import { grant, registerUser } from '../domain/user.js';

/** Só em NODE_ENV=development: em produção o primeiro admin é provisionado por fora. */
@Injectable()
export class DevAdminSeeder implements OnApplicationBootstrap {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async onApplicationBootstrap() {
    if (this.config.get('NODE_ENV', { infer: true }) !== 'development') return;
    if (await this.users.findByEmail(DEV_ADMIN.email)) return;
    const passwordHash = await this.hasher.hash(DEV_ADMIN.password);
    await this.users.create(
      grant(
        registerUser(
          { email: DEV_ADMIN.email, name: 'Admin', passwordHash },
          this.clock.now(),
        ),
        'ADMIN',
      ),
    );
  }
}
