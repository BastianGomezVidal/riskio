import { Client } from 'pg';

export const TEST_DB_NAME = 'riskio_test';
export const TEST_DATABASE_URL = `postgresql://riskio:riskio_dev_password@localhost:5432/${TEST_DB_NAME}`;

/**
 * Ensures the dedicated integration-test database exists, and drops/recreates
 * it so every run starts from a clean schema (migrations run via the app).
 */
export async function resetTestDatabase(): Promise<void> {
  const admin = new Client({
    connectionString:
      'postgresql://riskio:riskio_dev_password@localhost:5432/riskio',
  });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
    await admin.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  } finally {
    await admin.end();
  }
}

// setupFiles are imported before each test file; top-level code runs once per
// worker. This re-creates the test DB before the app under test connects.
await resetTestDatabase();