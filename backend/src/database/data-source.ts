import 'reflect-metadata';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Base config (also used by the container)
loadEnv({ path: join(__dirname, '..', '..', '..', '..', '.env') });

// CLI-only override: use localhost instead of the container hostname 'db'
loadEnv({ path: join(__dirname, '..', '..', '.env.cli'), override: true });

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: ['error', 'warn'],
});
