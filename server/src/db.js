import pg from 'pg';
import { config } from './config.js';

// DATE como 'YYYY-MM-DD' en lugar de un Date en hora local
pg.types.setTypeParser(1082, (v) => v);

// Las conexiones externas a Render exigen SSL; la URL interna no
const ssl = config.databaseSsl ? { rejectUnauthorized: false } : undefined;

export const pool = new pg.Pool({ connectionString: config.databaseUrl, ssl, max: 10 });

export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Crea la base de datos indicada en DATABASE_URL si todavía no existe.
 * En Render la base ya viene creada, así que solo se comprueba la conexión.
 */
export async function ensureDatabase() {
  const probe = new pg.Client({ connectionString: config.databaseUrl, ssl });
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (err) {
    await probe.end().catch(() => {});
    if (err.code !== '3D000') throw err; // 3D000 = la base no existe
  }

  const url = new URL(config.databaseUrl);
  const dbName = decodeURIComponent(url.pathname.slice(1));
  url.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: url.toString(), ssl });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!rowCount) {
      await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`🐾 Base de datos "${dbName}" creada`);
    }
  } finally {
    await admin.end();
  }
}

export async function getSetting(key, fallback, client = pool) {
  const { rows } = await client.query('SELECT value FROM settings WHERE key = $1', [key]);
  return rows[0] ? rows[0].value : fallback;
}
