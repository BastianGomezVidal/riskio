import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

/**
 * Start the HTTP server.
 *
 * Responsibilities:
 *  - enforce DTO validation on every request body/query/param,
 *  - allow browser front-ends to call the API from a different origin
 *    (CORS origins come from `CORS_ORIGINS`; empty = allow all),
 *  - serve the Swagger UI at /docs and the machine-readable spec at /docs-json.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const configService = app.get(ConfigService);
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
  });

  const config = new DocumentBuilder()
    .setTitle('Riskio API')
    .setDescription('Tropical cyclone data ingested from NOAA NHC feeds.')
    .setVersion('0.1.0')
    .addTag('storms', 'Tropical cyclone storm records')
    .addTag('advisories', 'Per-storm forecast advisories')
    .addTag('forecast-points', 'Time-indexed forecast track points')
    .addTag('ingestion', 'Manual ingestion triggers')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
