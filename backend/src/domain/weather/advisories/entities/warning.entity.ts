import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { LineString } from 'geojson';
import { ApiProperty } from '@nestjs/swagger';
import { Advisory } from './advisory.entity.js';

/** One coastal watch/warning line segment attached to an advisory. */
@Entity('warnings')
export class Warning {
  @ApiProperty({ description: 'Warning segment UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Watch/warning type, e.g. "Hurricane Watch"',
    example: 'Hurricane Watch',
  })
  @Column({ type: 'varchar' })
  warningType: string;

  @ApiProperty({
    description: 'Coastal watch/warning line (GeoJSON LineString)',
    example: {
      type: 'LineString',
      coordinates: [
        [-80.5, 25.9],
        [-80.4, 26.1],
      ],
    },
  })
  @Column('geography', {
    spatialFeatureType: 'LineString',
    srid: 4326,
  })
  geometry: LineString;

  @ApiProperty({ description: 'The advisory this segment belongs to' })
  @ManyToOne(() => Advisory, (advisory) => advisory.warnings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'advisory_id' })
  advisory: Relation<Advisory>;
}
