import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config.js';
import { DatabaseModule } from '../db/database.module.js';
import { AuthService, AuthSettings } from './application/auth.service.js';
import {
  AccessTokenIssuer,
  Clock,
  PasswordHasher,
  RefreshTokenStore,
  Transactor,
  UserEvents,
  UserRepository,
  WelcomeNotifier,
} from './application/ports.js';
import { UserService } from './application/user.service.js';
import { DevAdminSeeder } from './infrastructure/dev-admin.seeder.js';
import { AuthController } from './infrastructure/http/auth.controller.js';
import {
  AdminGuard,
  AuthGuard,
  SelfOrAdminGuard,
} from './infrastructure/http/guards.js';
import { UserController } from './infrastructure/http/user.controller.js';
import { Kafka } from './infrastructure/messaging/kafka.js';
import {
  OutboxRelay,
  OutboxUserEvents,
} from './infrastructure/messaging/outbox.js';
import {
  LoggingWelcomeNotifier,
  WelcomeConsumer,
} from './infrastructure/messaging/welcome.consumer.js';
import {
  DrizzleRefreshTokenStore,
  DrizzleTransactor,
} from './infrastructure/persistence/drizzle-refresh-token.store.js';
import { DrizzleUserRepository } from './infrastructure/persistence/drizzle-user.repository.js';
import { BcryptPasswordHasher } from './infrastructure/security/bcrypt-password.hasher.js';
import { JwtAccessTokenIssuer } from './infrastructure/security/jwt-access-token.issuer.js';

/** Wiring da feature: cada port (abstract class) aponta para o seu adapter. */
@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [UserController, AuthController],
  providers: [
    UserService,
    AuthService,
    {
      provide: AuthSettings,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new AuthSettings(
          config.get('REFRESH_TTL_SECONDS', { infer: true }) * 1000,
        ),
    },
    { provide: UserRepository, useClass: DrizzleUserRepository },
    { provide: RefreshTokenStore, useClass: DrizzleRefreshTokenStore },
    { provide: Transactor, useClass: DrizzleTransactor },
    { provide: PasswordHasher, useClass: BcryptPasswordHasher },
    { provide: AccessTokenIssuer, useClass: JwtAccessTokenIssuer },
    { provide: UserEvents, useClass: OutboxUserEvents },
    { provide: WelcomeNotifier, useClass: LoggingWelcomeNotifier },
    { provide: Clock, useValue: { now: () => new Date() } },
    AuthGuard,
    AdminGuard,
    SelfOrAdminGuard,
    Kafka,
    OutboxRelay,
    WelcomeConsumer,
    DevAdminSeeder,
  ],
})
export class UserModule {}
