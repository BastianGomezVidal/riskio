import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StormsModule } from '../../src/domain/weather/storms/storms.module.js';
import { AdvisoriesModule } from '../../src/domain/weather/advisories/advisories.module.js';
import { Storm } from '../../src/domain/weather/storms/entities/storm.entity.js';
import { Advisory } from '../../src/domain/weather/advisories/entities/advisory.entity.js';
import { ForecastPoint } from '../../src/domain/weather/advisories/entities/forecast-point.entity.js';
import { Warning } from '../../src/domain/weather/advisories/entities/warning.entity.js';
import { StormsService } from '../../src/domain/weather/storms/storms.service.js';
import { AdvisoriesService } from '../../src/domain/weather/advisories/advisories.service.js';

/**
 * The weather domain, in process, for tests.
 *
 * The real WeatherModule cannot be imported here: it opens its own TypeORM
 * connection and listens on a port, and a test wants the domain against the
 * test database.
 *
 * The dashboard's client is overridden in createTestApp, pointing at the
 * StormsService and AdvisoriesService exported here. The dashboard assertions
 * therefore still exercise the real queries and the real mapping; the HTTP hop
 * is covered by the client's own spec.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Storm, Advisory, ForecastPoint, Warning]),
    StormsModule,
    AdvisoriesModule,
  ],
  providers: [StormsService, AdvisoriesService],
  // Both are re-declared as providers here on purpose: Nest only lets a module
  // export something in its own providers array, and importing the domain
  // modules was not enough to re-export their services onward.
  exports: [StormsService, AdvisoriesService],
})
export class TestWeatherModule {}
