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

  @ApiPropertyOptional({ description: 'Phone number', example: '+1 555 010 1234' })
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  /** Null when the account was created via Google/Outlook OAuth. */
  @Column({ type: 'varchar', nullable: true })
  passwordHash: string | null;

  @ApiPropertyOptional({ description: 'When the user was created' })
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'When the user was last updated' })
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}