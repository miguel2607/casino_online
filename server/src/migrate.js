import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { config } from './config.js';

const DEFAULT_REWARDS = [
  { icon: '💋', title: 'Un besito', description: 'Un beso tierno cuando quieras, sin preguntas.', cost: 100 },
  { icon: '🤗', title: 'Abrazo de oso', description: 'Un abrazo largo y apretado de al menos 30 segundos.', cost: 150 },
  { icon: '🎬', title: 'Yo elijo la película', description: 'Tú eliges la película y yo no me quejo.', cost: 300 },
  { icon: '💆‍♀️', title: 'Masaje de 15 minutos', description: 'Masaje relajante en espalda, cuello o pies.', cost: 500 },
  { icon: '🍫', title: 'Antojo dulce', description: 'Te llevo tu postre o snack favorito.', cost: 700 },
  { icon: '🥞', title: 'Desayuno en la cama', description: 'Desayuno sorpresa preparado con amor.', cost: 1200 },
  { icon: '🍝', title: 'Cena romántica', description: 'Una cena especial, tú eliges el lugar.', cost: 2000 },
  { icon: '🎁', title: 'Cita sorpresa', description: 'Un plan sorpresa organizado por mí de principio a fin.', cost: 3000 },
];

export async function migrate() {
  const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);

  await pool.query(`
    INSERT INTO settings (key, value) VALUES ('starting_stars', '1000'), ('daily_bonus', '200')
    ON CONFLICT (key) DO NOTHING`);

  const seeded = await pool.query(`SELECT 1 FROM settings WHERE key = 'rewards_seeded'`);
  if (!seeded.rowCount) {
    for (const r of DEFAULT_REWARDS) {
      await pool.query('INSERT INTO rewards (icon, title, description, cost) VALUES ($1, $2, $3, $4)', [
        r.icon, r.title, r.description, r.cost,
      ]);
    }
    await pool.query(`INSERT INTO settings (key, value) VALUES ('rewards_seeded', 'true')`);
    console.log('🎁 Recompensas de ejemplo creadas');
  }

  if (config.adminUsername && config.adminPassword) {
    const { rows } = await pool.query('SELECT id, role FROM users WHERE lower(username) = lower($1)', [
      config.adminUsername,
    ]);
    if (!rows[0]) {
      const hash = await bcrypt.hash(config.adminPassword, 10);
      await pool.query(
        `INSERT INTO users (username, display_name, password_hash, role, avatar) VALUES ($1, $1, $2, 'admin', 'black')`,
        [config.adminUsername, hash],
      );
      console.log(`👑 Usuario administrador "${config.adminUsername}" creado`);
    } else if (rows[0].role !== 'admin') {
      await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [rows[0].id]);
    }
    if (rows[0] && config.adminResetPassword) {
      const hash = await bcrypt.hash(config.adminPassword, 10);
      await pool.query(
        `UPDATE users SET password_hash = $2, password_changed_at = now(), recovery_failed = 0, recovery_locked_until = NULL
         WHERE id = $1`,
        [rows[0].id, hash],
      );
      console.log(`🔑 Contraseña de "${config.adminUsername}" restablecida desde ADMIN_PASSWORD. Quita ADMIN_RESET_PASSWORD.`);
    }
  }
}
