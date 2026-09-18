import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { LineString, Polygon } from 'geojson';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Storm } from '../../storms/entities/storm.entity.js';
import { ForecastPoint } from './forecast-point.entity.js';
import { Warning } from './warning.entity.js';

/** One numbered forecast/advisory issued for a storm. */
@Entity('advisories')
@Unique(['storm', 'advisoryNumber'])
export class Advisory {
  @ApiProperty({ description: 'Advisory UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Advisory number for this storm', example: 2 })
  @Column({ type: 'int' })
  advisoryNumber: number;

  @ApiProperty({ description: 'When the advisory was issued' })
  @Column({ type: 'timestamptz' })
  issuedAt: Date;

  @ApiPropertyOptional({
    description: 'Raw TCM forecast/advisory text',
  })
  @Column({ type: 'text', nullable: true })
  rawText: string | null;

  @ApiProperty({ description: 'When this record was ingested' })
  @CreateDateColumn()
  ingestedAt: Date;

  @ApiProperty({ description: 'The storm this advisory belongs to' })
  @ManyToOne(() => Storm, (storm) => storm.advisories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storm_atcf_id' })
  storm: Relation<Storm>;

  @ApiPropertyOptional({
    type: () => ForecastPoint,
    isArray: true,
    description: 'Forecast track points for this advisory',
  })
  @OneToMany(() => ForecastPoint, (point) => point.advisory)
  forecastPoints: Relation<ForecastPoint[]>;

  @ApiPropertyOptional({
    description: 'Forecast track polyline (GeoJSON LineString)',
    example: {
      type: 'LineString',
      coordinates: [
        [-120.5, 16.5],
        [-122.5, 16.5],
      ],
    },
  })
  @Column('geography', {
    spatialFeatureType: 'LineString',
    srid: 4326,
    nullable: true,
  })
  track: LineString | null;

  @ApiPropertyOptional({
    description: 'Cone of uncertainty (GeoJSON Polygon)',
    example: {
      type: 'Polygon',
      coordinates: [
        [
          [-120.5, 16.5],
          [-118.5, 15.5],
        ],
      ],
    },
  })
  @Column('geography', {
    spatialFeatureType: 'Polygon',
    srid: 4326,
    nullable: true,
  })
  cone: Polygon | null;

  @ApiPropertyOptional({
    type: () => Warning,
    isArray: true,
    description: 'Coastal watch/warning segments',
  })
  @OneToMany(() => Warning, (warning) => warning.advisory)
  warnings: Relation<Warning[]>;
}
