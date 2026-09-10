import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

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
