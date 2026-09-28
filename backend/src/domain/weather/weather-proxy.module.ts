import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WeatherProxyController } from './weather-proxy.controller.js';

/**
 * Routes the weather paths out to the weather service.
 *
 * Its own module so the forwarding can be removed in one place if the frontend
 * ever learns to talk to the service directly.
 */
@Module({
  imports: [ConfigModule],
  controllers: [WeatherProxyController],
})
export class WeatherProxyModule {}
