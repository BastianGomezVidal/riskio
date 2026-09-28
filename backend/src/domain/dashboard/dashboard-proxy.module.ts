import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DashboardProxyController } from './dashboard-proxy.controller.js';

/**
 * Routes /dashboard out to the dashboard service.
 *
 * Its own module for the same reason the weather one has its own: if the
 * frontend ever learns to talk to the service directly, the forwarding is
 * deleted from one place instead of being hunted through the composition root.
 */
@Module({
  imports: [ConfigModule],
  controllers: [DashboardProxyController],
})
export class DashboardProxyModule {}
