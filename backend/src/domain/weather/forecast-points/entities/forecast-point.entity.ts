import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Advisory } from '../../advisories/entities/advisory.entity.js';

/** One time-indexed forecast track point of an advisory. */
@Entity('forecast_points')
export class ForecastPoint {
  @ApiProperty({ description: 'Forecast point UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Valid time of this forecast point' })
  @Column({ type: 'timestamptz' })
  validAt: Date;

  @ApiProperty({ description: 'Latitude in degrees', example: 16.7 })
  @Column({ type: 'double precision' })
  latitude: number;

  @ApiProperty({ description: 'Longitude in degrees', example: -118.5 })
  @Column({ type: 'double precision' })
  longitude: number;

  @ApiPropertyOptional({ description: 'Max sustained wind in knots' })
  @Column({ type: 'int', nullable: true })
  windSpeedKt: number | null;

  @ApiPropertyOptional({ description: 'Minimum central pressure in mb' })
  @Column({ type: 'int', nullable: true })
  pressureMb: number | null;

  @ApiPropertyOptional({
    description: 'Saffir-Simpson category (0 = tropical storm)',
  })
  @Column({ type: 'int', nullable: true })
  category: number | null;

  @ApiProperty({ description: 'The advisory this point belongs to' })
  @ManyToOne(() => Advisory, (advisory) => advisory.forecastPoints, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'advisory_id' })
  advisory: Relation<Advisory>;
}
