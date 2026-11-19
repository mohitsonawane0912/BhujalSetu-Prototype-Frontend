import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';

let pool: Pool | null = null;
let isConnected = false;

export function getPool(): Pool {
  if (!pool) {
    if (config.postgres.connectionString) {
      pool = new Pool({
        connectionString: config.postgres.connectionString,
      });
    } else {
      pool = new Pool({
        host: config.postgres.host,
        port: config.postgres.port,
        database: config.postgres.database,
        user: config.postgres.user,
        password: config.postgres.password || undefined,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 3000,
      });
    }

    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]', err);
      isConnected = false;
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const p = getPool();
  return p.query<T>(text, params);
}

export async function checkConnection(): Promise<boolean> {
  try {
    const res = await query('SELECT 1 as alive');
    isConnected = res.rows.length > 0;
    return isConnected;
  } catch (err) {
    isConnected = false;
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    isConnected = false;
  }
}
