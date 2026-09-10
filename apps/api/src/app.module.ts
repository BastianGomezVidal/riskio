import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { envValidationSchema } from './config/env.validation.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { StormsModule } from './storms/storms.module.js';
import { AdvisoriesModule } from './advisories/advisories.module.js';
import { ForecastPointsModule } from './forecast-points/forecast-points.module.js';
import { IngestionModule } from './ingestion/ingestion.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      expandVariables: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: ['dist/database/migrations/*.js'],
        migrationsRun: true,
        logging: ['error', 'warn'],
      }),
    }),
    ScheduleModule.forRoot(), // ← NEW
    StormsModule,
    AdvisoriesModule,
    ForecastPointsModule,
    IngestionModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
