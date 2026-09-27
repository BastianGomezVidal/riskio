import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Role } from '../auth.roles.js';

/** An account that can log in and manage API tokens. */
@Entity('users')
export class User {
  @ApiProperty({ description: 'User UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Login email' })
  @Column({ type: 'varchar', unique: true })
  email: string;

  @ApiProperty({ description: 'Account role', example: 'client' })
  @Column({ type: 'varchar', default: 'client' })
  role: Role;

  @ApiProperty({ description: 'First name' })
  @Column({ type: 'varchar' })
  firstName: string;

  @ApiProperty({ description: 'Last name' })
  @Column({ type: 'varchar' })
  lastName: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1 555 010 1234',
  })
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @ApiPropertyOptional({
    description: 'Profile picture URL, null when the user has no avatar',
    nullable: true,
  })
  @Column({ type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  passwordHash: string | null;

  @ApiPropertyOptional({ description: 'When the user was created' })
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'When the user was last updated' })
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Last login timestamp', nullable: true })
  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @ApiPropertyOptional({
    description: 'Last login browser (parsed from User-Agent)',
    nullable: true,
  })
  @Column({ type: 'varchar', nullable: true })
  lastLoginBrowser: string | null;

  @ApiPropertyOptional({
    description: 'Last login OS (parsed from User-Agent)',
    nullable: true,
  })
  @Column({ type: 'varchar', nullable: true })
  lastLoginOs: string | null;

  @ApiPropertyOptional({
    description:
      'Current session id. Only the latest session is valid; older ones return 401.',
    nullable: true,
  })
  @Column({ type: 'varchar', nullable: true })
  currentSessionId: string | null;
}
