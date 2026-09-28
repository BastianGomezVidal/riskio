import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { weatherEnvValidationSchema } from '../config/env.validation.js';
import { StormsModule } from '../domain/weather/storms/storms.module.js';
import { AdvisoriesModule } from '../domain/weather/advisories/advisories.module.js';
import { Storm } from '../domain/weather/storms/entities/storm.entity.js';
import { Advisory } from '../domain/weather/advisories/entities/advisory.entity.js';
import { ForecastPoint } from '../domain/weather/advisories/entities/forecast-point.entity.js';
import { Warning } from '../domain/weather/advisories/entities/warning.entity.js';
import { ObservabilityModule } from '../config/observability.module.js';
import { AppCacheModule } from '../domain/cache/cache.module.js';
import { WeatherReadController } from './weather-read.controller.js';
import { WeatherHealthController } from './weather-health.controller.js';

/**
 * The weather service: the read side of storms and advisories.
 *
 * `feeds-service` writes those tables and this one reads them, which is the
 * only writer/reader pair in the system. The database stays shared, as the plan
 * says; a schema per service is out of scope.
 *
 * It owns the read side of {@link StormsService} and {@link AdvisoriesService}
 * and publishes their controllers as-is. The *write* half already moved to the
 * feeds service, so neither service does both.
 *
 * The domain folder itself is not moved. `feeds-service` imports these entities
 * for its writers, and the API still needs the DTOs for the responses it hands
 * back, so relocating twenty files would buy tidiness and cost churn. The
 * boundary that matters is the network one, and that is here.
 */
@Module({
  imports: [
    ObservabilityModule,
    AppCacheModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: weatherEnvValidationSchema,
      expandVariables: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [Storm, Advisory, ForecastPoint, Warning],
        migrationsRun: false,
        synchronize: false,
      }),
    }),
    StormsModule,
    AdvisoriesModule,
  ],
  controllers: [WeatherReadController, WeatherHealthController],
})
export class WeatherModule {}
