import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { StormsModule } from './storms/storms.module.js';
import { AdvisoriesModule } from './advisories/advisories.module.js';
import { ForecastPointsModule } from './forecast-points/forecast-points.module.js';
import { IngestionModule } from './ingestion/ingestion.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: true, // ⚠️ DEV ONLY — replace with migrations before prod
      logging: ['error', 'warn'],
    }),
    StormsModule,
    AdvisoriesModule,
    ForecastPointsModule,
    IngestionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
