import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { envSchema } from './config.js';
import { UserModule } from './user/user.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => envSchema.parse(env),
    }),
    ScheduleModule.forRoot(),
    UserModule,
  ],
})
export class AppModule {}
