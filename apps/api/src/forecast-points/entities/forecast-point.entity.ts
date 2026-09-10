import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Advisory } from '../../advisories/entities/advisory.entity.js';

@Entity('forecast_points')
export class ForecastPoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz' })
  validAt: Date;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ type: 'int', nullable: true })
  windSpeedKt: number | null;

  @Column({ type: 'int', nullable: true })
  pressureMb: number | null;

  @Column({ type: 'int', nullable: true })
  category: number | null;

  @ManyToOne(() => Advisory, (advisory) => advisory.forecastPoints, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'advisory_id' })
  advisory: any;
}