import { config } from './config.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { ensureDatabase, pool } from './db.js';
import { migrate } from './migrate.js';
import { requireAdmin, requireAuth } from './auth.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import rewardRoutes from './routes/rewards.js';
import adminRoutes from './routes/admin.js';
import gameRoutes from './games/index.js';

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);

// Salud: para UptimeRobot / Render. Responde GET y HEAD y comprueba la base de datos.
const startedAt = Date.now();
async function health(req, res) {
  res.set('Cache-Control', 'no-store');
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    res.json({ status: 'ok', db: 'ok', uptime: Math.round((Date.now() - startedAt) / 1000), time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'down', time: new Date().toISOString() });
  }
}
app.get('/health', health);
app.get('/api/health', health);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use('/api/me', requireAuth, meRoutes);
app.use('/api/rewards', requireAuth, rewardRoutes);
app.use('/api/games', requireAuth, gameRoutes);
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// En producción el servidor también entrega el frontend compilado
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message;
  if (err.code === '23505') {
    status = 409;
    message = 'Ese registro ya existe';
  }
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Ups, algo falló en el servidor 😿' : message });
});

try {
  await ensureDatabase();
  await migrate();
} catch (err) {
  console.error('❌ No se pudo conectar a PostgreSQL:', err.message);
  console.error('   Revisa DATABASE_URL en server/.env');
  process.exit(1);
}

app.listen(config.port, '0.0.0.0', () => {
  console.log(`🐱 Michi Casino API escuchando en http://localhost:${config.port}`);
});
