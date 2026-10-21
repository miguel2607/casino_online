import { Router } from 'express';
import { pool, withTx } from '../db.js';
import { HttpError, bad } from '../errors.js';
import { moveStars } from '../wallet.js';

const router = Router();

router.get('/overview', async (req, res) => {
  const [{ rows: [counts] }, { rows: recent }] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT count(*)::int FROM users WHERE role = 'player') AS players,
        (SELECT coalesce(sum(stars), 0)::int FROM users WHERE role = 'player') AS stars_in_wallets,
        (SELECT count(*)::int FROM redemptions WHERE status = 'pending') AS pending_redemptions,
        (SELECT count(*)::int FROM redemptions WHERE status = 'fulfilled') AS fulfilled_redemptions,
        (SELECT count(*)::int FROM game_results) AS games_played,
        (SELECT count(*)::int FROM game_results WHERE created_at > now() - interval '24 hours') AS games_today,
        (SELECT count(*)::int FROM rewards WHERE active) AS active_rewards`),
    pool.query(`
      SELECT g.id, g.game, g.bet, g.payout, g.outcome, g.summary, g.created_at, u.username, u.display_name
      FROM game_results g JOIN users u ON u.id = g.user_id
      ORDER BY g.created_at DESC LIMIT 15`),
  ]);
  res.json({ counts, recent });
});

// ---- Recompensas ----

function parseReward(body, partial = false) {
  const out = {};
  if (!partial || body.title !== undefined) {
    out.title = String(body.title ?? '').trim().slice(0, 80);
    if (!out.title) throw bad('La recompensa necesita un título');
  }
  if (!partial || body.description !== undefined) out.description = String(body.description ?? '').trim().slice(0, 300);
  if (!partial || body.icon !== undefined) out.icon = String(body.icon ?? '').trim().slice(0, 16) || '🎁';
  if (!partial || body.cost !== undefined) {
    out.cost = Number(body.cost);
    if (!Number.isInteger(out.cost) || out.cost < 1) throw bad('El costo debe ser un número entero mayor a 0');
  }
  if (!partial || body.stock !== undefined) {
    if (body.stock === null || body.stock === '' || body.stock === undefined) out.stock = null;
    else {
      out.stock = Number(body.stock);
      if (!Number.isInteger(out.stock) || out.stock < 0) throw bad('El stock debe ser un entero (o vacío para ilimitado)');
    }
  }
  if (!partial || body.active !== undefined) out.active = body.active === undefined ? true : Boolean(body.active);
  return out;
}

router.get('/rewards', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT r.*, (SELECT count(*)::int FROM redemptions d WHERE d.reward_id = r.id AND d.status <> 'cancelled') AS times_redeemed
    FROM rewards r ORDER BY r.active DESC, r.cost, r.id`);
  res.json({ rewards: rows });
});

router.post('/rewards', async (req, res) => {
  const r = parseReward(req.body ?? {});
  const { rows } = await pool.query(
    `INSERT INTO rewards (title, description, icon, cost, stock, active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [r.title, r.description, r.icon, r.cost, r.stock, r.active],
  );
  res.status(201).json({ reward: rows[0] });
});

router.patch('/rewards/:id', async (req, res) => {
  const fields = parseReward(req.body ?? {}, true);
  const keys = Object.keys(fields);
  if (!keys.length) throw bad('No hay cambios');
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const { rows } = await pool.query(
    `UPDATE rewards SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
    [req.params.id, ...keys.map((k) => fields[k])],
  );
  if (!rows[0]) throw new HttpError(404, 'Recompensa no encontrada');
  res.json({ reward: rows[0] });
});

router.delete('/rewards/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM rewards WHERE id = $1', [req.params.id]);
  if (!rowCount) throw new HttpError(404, 'Recompensa no encontrada');
  res.json({ ok: true });
});

// ---- Canjes ----

router.get('/redemptions', async (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  const { rows } = await pool.query(
    `SELECT d.*, u.username, u.display_name FROM redemptions d JOIN users u ON u.id = d.user_id
     WHERE ($1::text IS NULL OR d.status = $1)
     ORDER BY (d.status = 'pending') DESC, d.created_at DESC LIMIT 200`,
    [status],
  );
  res.json({ redemptions: rows });
});

router.post('/redemptions/:id/fulfill', async (req, res) => {
  const adminNote = req.body?.adminNote ? String(req.body.adminNote).trim().slice(0, 300) : null;
  const { rows } = await pool.query(
    `UPDATE redemptions SET status = 'fulfilled', admin_note = COALESCE($2, admin_note), resolved_at = now()
     WHERE id = $1 AND status = 'pending' RETURNING *`,
    [req.params.id, adminNote],
  );
  if (!rows[0]) throw bad('Este canje ya fue resuelto');
  res.json({ redemption: rows[0] });
});

router.post('/redemptions/:id/cancel', async (req, res) => {
  const adminNote = req.body?.adminNote ? String(req.body.adminNote).trim().slice(0, 300) : null;
  const redemption = await withTx(async (c) => {
    const { rows } = await c.query(
      `UPDATE redemptions SET status = 'cancelled', admin_note = COALESCE($2, admin_note), resolved_at = now()
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [req.params.id, adminNote],
    );
    if (!rows[0]) throw bad('Este canje ya fue resuelto');
    await moveStars(c, rows[0].user_id, rows[0].cost, 'refund', `Devolución: ${rows[0].reward_title}`);
    if (rows[0].reward_id) {
      await c.query('UPDATE rewards SET stock = stock + 1 WHERE id = $1 AND stock IS NOT NULL', [rows[0].reward_id]);
    }
    return rows[0];
  });
  res.json({ redemption });
});

// ---- Jugadores ----

router.get('/users', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT u.id, u.username, u.display_name, u.role, u.stars, u.avatar, u.created_at, u.last_login_at,
           (SELECT count(*)::int FROM game_results g WHERE g.user_id = u.id) AS games_played,
           (SELECT count(*)::int FROM redemptions d WHERE d.user_id = u.id AND d.status = 'pending') AS pending
    FROM users u ORDER BY u.role DESC, u.created_at`);
  res.json({ users: rows });
});

router.get('/users/:id/history', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, game, bet, payout, outcome, summary, created_at FROM game_results
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.params.id],
  );
  res.json({ results: rows });
});

router.post('/users/:id/stars', async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isInteger(amount) || amount === 0) throw bad('Indica una cantidad entera distinta de 0');
  const reason = String(req.body?.reason ?? '').trim().slice(0, 120)
    || (amount > 0 ? 'Regalo del administrador 💝' : 'Ajuste del administrador');
  const stars = await withTx((c) => moveStars(c, req.params.id, amount, 'admin', reason));
  res.json({ stars });
});

// ---- Ajustes ----

const SETTING_KEYS = ['starting_stars', 'daily_bonus'];

router.get('/settings', async (req, res) => {
  const { rows } = await pool.query('SELECT key, value FROM settings WHERE key = ANY($1)', [SETTING_KEYS]);
  res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

router.put('/settings', async (req, res) => {
  for (const key of SETTING_KEYS) {
    if (req.body?.[key] === undefined) continue;
    const value = Number(req.body[key]);
    if (!Number.isInteger(value) || value < 0) throw bad('Los valores deben ser enteros positivos');
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(value)],
    );
  }
  const { rows } = await pool.query('SELECT key, value FROM settings WHERE key = ANY($1)', [SETTING_KEYS]);
  res.json({ settings: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
});

export default router;
