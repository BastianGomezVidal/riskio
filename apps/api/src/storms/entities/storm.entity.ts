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

@Entity('storms')
export class Storm {
  @ApiProperty({ description: 'ATCF storm identifier', example: 'EP142026' })
  @PrimaryColumn()
  atcfId: string;

  @ApiPropertyOptional({
    description: 'Storm name, null when unnamed (e.g. a numbered depression)',
    example: 'Lowell',
  })
  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @ApiProperty({ description: 'Ocean basin', example: 'EP' })
  @Column({ type: 'varchar' })
  basin: string;

  @ApiProperty({ description: 'When the storm was first observed' })
  @CreateDateColumn()
  firstSeenAt: Date;

  @ApiProperty({ description: 'When the storm was last observed' })
  @UpdateDateColumn()
  lastSeenAt: Date;

  @ApiPropertyOptional({
    type: () => Advisory,
    isArray: true,
    description: 'Forecast advisories issued for this storm',
  })
  @OneToMany(() => Advisory, (advisory) => advisory.storm)
  advisories: Relation<Advisory[]>;
}
