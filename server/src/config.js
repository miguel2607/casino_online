import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

if (!process.env.DATABASE_URL) {
  console.error('❌ Falta DATABASE_URL en server/.env (copia server/.env.example)');
  process.exit(1);
}

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.warn('⚠️  JWT_SECRET no definido: las sesiones se cerrarán al reiniciar el servidor.');
  jwtSecret = crypto.randomBytes(32).toString('hex');
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret,
  adminUsername: process.env.ADMIN_USERNAME?.trim(),
  adminPassword: process.env.ADMIN_PASSWORD,
  timezone: process.env.TIMEZONE || 'America/Bogota',
  allowRegistration: process.env.ALLOW_REGISTRATION !== 'false',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  databaseSsl: process.env.DATABASE_SSL === 'true',
  // Render (y cualquier proxy HTTPS) va delante de la app
  trustProxy: process.env.TRUST_PROXY === 'true',
  // Si es true, al arrancar la contraseña del admin se reemplaza por ADMIN_PASSWORD
  adminResetPassword: process.env.ADMIN_RESET_PASSWORD === 'true',
  // Recuperación de contraseña con pregunta secreta (la respuesta nunca va en el código)
  recovery: {
    question: process.env.RECOVERY_QUESTION || '¿Cómo se llama mi jugador de fútbol favorito?',
    options: (process.env.RECOVERY_OPTIONS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    answer: process.env.RECOVERY_ANSWER?.trim() || '',
  },
};
