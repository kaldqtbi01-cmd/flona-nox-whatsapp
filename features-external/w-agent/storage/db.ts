import { Pool, type PoolClient, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

import { config } from '../config.js';
import { logger } from '../logger.js';

const defaultPoolConfig: PoolConfig = {
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
};

let pool: Pool | undefined;

export function createPool(
  connectionString = config.DATABASE_URL,
  overrides: PoolConfig = {},
): Pool {
  return new Pool({
    connectionString,
    ...defaultPoolConfig,
    ...overrides,
  });
}

export function getPool(): Pool {
  if (!pool) {
    pool = createPool();
    pool.on('error', (err: Error) => {
      logger.error({ err }, 'Unexpected idle Postgres client error');
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
}

/**
 * Point the process-wide pool at a different database (testcontainers / CI).
 * Closes any existing pool first.
 */
export async function useDatabaseUrl(connectionString: string): Promise<void> {
  await closePool();
  pool = createPool(connectionString);
}
