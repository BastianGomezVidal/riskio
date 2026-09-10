import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Advisory } from '../../advisories/entities/advisory.entity.js';

@Entity('storms')
export class Storm {
  @PrimaryColumn()
  atcfId: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar' })
  basin: string;

  @CreateDateColumn()
  firstSeenAt: Date;

  @UpdateDateColumn()
  lastSeenAt: Date;

  @OneToMany(() => Advisory, (advisory) => advisory.storm)
  advisories: any;
}