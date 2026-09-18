import { Pool, PoolClient, QueryResultRow } from 'pg';
import { env } from './env.js';

export const pool = new Pool({ connectionString: env.databaseUrl, max: 20, idleTimeoutMillis: 30_000 });
pool.on('error', (error) => console.error(JSON.stringify({ level: 'error', msg: 'postgres pool error', error: error.message })));

export const query = <T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) => pool.query<T>(text, params);
export const withTransaction = async <T>(work: (client: PoolClient) => Promise<T>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
