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
import { Storm } from '../../storms/entities/storm.entity.js';
import { ForecastPoint } from '../../forecast-points/entities/forecast-point.entity.js';

@Entity('advisories')
@Unique(['storm', 'advisoryNumber'])
export class Advisory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  advisoryNumber: number;

  @Column({ type: 'timestamptz' })
  issuedAt: Date;

  @Column({ type: 'text', nullable: true })
  rawText: string | null;

  @CreateDateColumn()
  ingestedAt: Date;

  @ManyToOne(() => Storm, (storm) => storm.advisories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storm_atcf_id' })
  storm: any;

  @OneToMany(() => ForecastPoint, (point) => point.advisory)
  forecastPoints: any;
}