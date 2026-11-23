import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { ProblemDetailsFilter } from './http/problem-details.js';

/** Tudo que main.ts configura no app; os testes e2e chamam o mesmo. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();
  return app;
}
