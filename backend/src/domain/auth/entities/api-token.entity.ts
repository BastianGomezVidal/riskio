import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from './user.entity.js';

/** A long-lived API token that authenticates machine clients. */
@Entity('api_tokens')
export class ApiToken {
  @ApiProperty({ description: 'Token UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @ApiProperty({ description: 'Human-readable label' })
  @Column({ type: 'varchar' })
  name: string;

  /** SHA-256 digest of the plaintext token (never stored in clear). */
  @Column({ type: 'varchar', unique: true })
  tokenHash: string;

  /** First characters of the token, shown in listings instead of the value. */
  @Column({ type: 'varchar' })
  prefix: string;

  @ApiPropertyOptional({ description: 'When the token was created' })
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'When the token was last updated' })
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'When the token was last used' })
  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @ApiPropertyOptional({ description: 'When the token was revoked' })
  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;
}
