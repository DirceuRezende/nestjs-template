import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ProblemDetailsFilter } from './http/problem-details.js';

/** Tudo que main.ts configura no app; os testes e2e chamam o mesmo. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();
  // Swagger UI em /api/docs, JSON em /api/docs-json. Schemas vêm do Zod (@Body/@Param/@Query).
  const config = new DocumentBuilder()
    .setTitle('user-template')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, () =>
    SwaggerModule.createDocument(app, config),
  );
  return app;
}
