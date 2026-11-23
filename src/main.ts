import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './config.js';

const app = configureApp(await NestFactory.create(AppModule));
await app.listen(
  app.get(ConfigService<Env, true>).get('PORT', { infer: true }),
);
