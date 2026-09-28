import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WeatherClientService } from './weather-client.service.js';

/**
 * Provides the weather read client to the dashboard.
 *
 * Its own module because the dashboard needs it and nothing else in the API
 * does: weather is read by the frontend through the weather service directly.
 * That is the last place the API touches storms, and it is a read over HTTP
 * like the others, not a repository.
 */
@Module({
  imports: [ConfigModule],
  providers: [WeatherClientService],
  exports: [WeatherClientService],
})
export class WeatherClientModule {}
