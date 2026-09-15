import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Advisory } from '../../advisories/entities/advisory.entity.js';

/** A tropical cyclone tracked by its ATCF identifier (e.g. `EP142026`). */
@Entity('storms')
export class Storm {
  @ApiProperty({ description: 'ATCF storm identifier', example: 'EP142026' })
  @PrimaryColumn({ type: 'varchar' })
  atcfId: string;

  @ApiPropertyOptional({ description: 'Storm name, null when unnamed' })
  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @ApiProperty({ description: 'Basin code', example: 'EP' })
  @Column({ type: 'varchar' })
  basin: string;

  @ApiProperty({ description: 'When the storm was first seen' })
  @CreateDateColumn({ type: 'timestamp' })
  firstSeenAt: Date;

  @ApiProperty({ description: 'When the storm was last seen' })
  @UpdateDateColumn({ type: 'timestamp' })
  lastSeenAt: Date;

  @ApiPropertyOptional({
    type: () => Advisory,
    isArray: true,
    description: 'Advisories issued for this storm',
  })
  @OneToMany(() => Advisory, (advisory) => advisory.storm)
  advisories: Relation<Advisory[]>;
}
