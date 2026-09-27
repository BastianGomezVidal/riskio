import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from './user.entity.js';

/**
 * A single-use token that lets its bearer choose a new password.
 *
 * The plaintext token only ever exists in the email link; the row stores its
 * SHA-256 digest, mirroring how {@link ApiToken} is handled. A row is spent
 * by stamping `usedAt`, which keeps the audit trail that a plain DELETE would
 * throw away.
 */
@Entity('password_reset_tokens')
export class PasswordResetToken {
  @ApiProperty({ description: 'Token UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @ApiProperty({ description: 'SHA-256 digest of the token, never the token' })
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  tokenHash: string;

  @ApiProperty({ description: 'When the link stops working' })
  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @ApiPropertyOptional({ description: 'When the link was redeemed' })
  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date | null;

  @ApiPropertyOptional({ description: 'When the token was issued' })
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
