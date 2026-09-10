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

@Entity('forecast_points')
export class ForecastPoint {
  @ApiProperty({ description: 'Forecast point UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Forecast validity time (UTC)' })
  @Column({ type: 'timestamptz' })
  validAt: Date;

  @ApiProperty({ description: 'Latitude in decimal degrees', example: 16.7 })
  @Column({ type: 'double precision' })
  latitude: number;

  @ApiProperty({ description: 'Longitude in decimal degrees', example: -118.5 })
  @Column({ type: 'double precision' })
  longitude: number;

  @ApiPropertyOptional({
    description: 'Maximum sustained wind, knots',
    example: 35,
  })
  @Column({ type: 'int', nullable: true })
  windSpeedKt: number | null;

  @ApiPropertyOptional({ description: 'Minimum central pressure, hPa', example: 1006 })
  @Column({ type: 'int', nullable: true })
  pressureMb: number | null;

  @ApiPropertyOptional({
    description: 'Saffir-Simpson category (0-5), null below tropical-storm strength',
    example: 1,
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
