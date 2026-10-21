import { ensureDatabase, pool } from './db.js';
import { migrate } from './migrate.js';

try {
  await ensureDatabase();
  await migrate();
  console.log('✅ Base de datos lista');
} catch (err) {
  console.error('❌ No se pudo preparar la base de datos:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
