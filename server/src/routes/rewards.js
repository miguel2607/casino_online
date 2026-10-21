import { Router } from 'express';
import { pool, withTx } from '../db.js';
import { HttpError, bad } from '../errors.js';
import { moveStars } from '../wallet.js';
import { emitTo } from '../bus.js';
import { parseReward } from '../rewardInput.js';

const router = Router();
const nameOf = (u) => u.display_name || u.username;

/**
 * Recompensas que puede canjear un usuario:
 *  - las que creó su pareja para él/ella
 *  - las globales del casino (creadas por el admin), salvo que sea el propio admin
 */
const VISIBLE = `r.active AND ((r.creator_id IS NULL AND NOT $1::boolean) OR r.creator_id = $2)`;
const visibleParams = (user) => [user.role === 'admin', user.partner_id ?? -1];

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.title, r.description, r.cost, r.icon, r.stock, r.creator_id,
            COALESCE(u.display_name, u.username) AS creator_name
     FROM rewards r LEFT JOIN users u ON u.id = r.creator_id
     WHERE ${VISIBLE} ORDER BY r.cost, r.id`,
    visibleParams(req.user),
  );
  res.json({ rewards: rows });
});

router.get('/mine', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT d.id, d.reward_id, d.reward_title, d.reward_icon, d.cost, d.status, d.note, d.admin_note,
            d.created_at, d.resolved_at, COALESCE(f.display_name, f.username) AS fulfiller_name
     FROM redemptions d LEFT JOIN users f ON f.id = d.fulfiller_id
     WHERE d.user_id = $1 ORDER BY d.created_at DESC LIMIT 100`,
    [req.user.id],
  );
  res.json({ redemptions: rows });
});

router.post('/:id/redeem', async (req, res) => {
  const rewardId = parseInt(req.params.id, 10);
  if (!rewardId) throw bad('Recompensa inválida');
  const note = req.body?.note ? String(req.body.note).trim().slice(0, 300) : null;

  const result = await withTx(async (c) => {
    const { rows } = await c.query(`SELECT r.* FROM rewards r WHERE r.id = $3 AND ${VISIBLE} FOR UPDATE`, [
      ...visibleParams(req.user),
      rewardId,
    ]);
    const reward = rows[0];
    if (!reward) throw new HttpError(404, 'Esta recompensa ya no está disponible');
    if (reward.stock !== null && reward.stock <= 0) throw bad('Esta recompensa está agotada 😿');

    const stars = await moveStars(c, req.user.id, -reward.cost, 'redeem', `Canje: ${reward.title}`);
    if (reward.stock !== null) {
      await c.query('UPDATE rewards SET stock = stock - 1, updated_at = now() WHERE id = $1', [reward.id]);
    }
    const { rows: [redemption] } = await c.query(
      `INSERT INTO redemptions (user_id, reward_id, reward_title, reward_icon, cost, note, fulfiller_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, reward.id, reward.title, reward.icon, reward.cost, note, reward.creator_id],
    );
    return { stars, redemption };
  });

  if (result.redemption.fulfiller_id) {
    emitTo(result.redemption.fulfiller_id, 'redemption', {
      by: nameOf(req.user),
      title: result.redemption.reward_title,
      icon: result.redemption.reward_icon,
    });
  }
  res.status(201).json(result);
});

// ---------- Cupones que yo creo para mi pareja ----------

router.get('/created', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.*, (SELECT count(*)::int FROM redemptions d WHERE d.reward_id = r.id AND d.status <> 'cancelled') AS times_redeemed
     FROM rewards r WHERE r.creator_id = $1 ORDER BY r.active DESC, r.cost, r.id`,
    [req.user.id],
  );
  res.json({ rewards: rows });
});

router.post('/created', async (req, res) => {
  const r = parseReward(req.body ?? {});
  const { rows } = await pool.query(
    `INSERT INTO rewards (title, description, icon, cost, stock, active, creator_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [r.title, r.description, r.icon, r.cost, r.stock, r.active, req.user.id],
  );
  if (req.user.partner_id) emitTo(req.user.partner_id, 'rewards:changed', { by: nameOf(req.user) });
  res.status(201).json({ reward: rows[0] });
});

router.patch('/created/:id', async (req, res) => {
  const fields = parseReward(req.body ?? {}, true);
  const keys = Object.keys(fields);
  if (!keys.length) throw bad('No hay cambios');
  const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  const { rows } = await pool.query(
    `UPDATE rewards SET ${sets}, updated_at = now() WHERE id = $1 AND creator_id = $2 RETURNING *`,
    [req.params.id, req.user.id, ...keys.map((k) => fields[k])],
  );
  if (!rows[0]) throw new HttpError(404, 'Recompensa no encontrada');
  res.json({ reward: rows[0] });
});

router.delete('/created/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM rewards WHERE id = $1 AND creator_id = $2', [req.params.id, req.user.id]);
  if (!rowCount) throw new HttpError(404, 'Recompensa no encontrada');
  res.json({ ok: true });
});

// ---------- Canjes que me toca cumplir ----------

router.get('/to-fulfill', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT d.*, COALESCE(u.display_name, u.username) AS redeemer_name
     FROM redemptions d JOIN users u ON u.id = d.user_id
     WHERE d.fulfiller_id = $1
     ORDER BY (d.status = 'pending') DESC, d.created_at DESC LIMIT 100`,
    [req.user.id],
  );
  res.json({ redemptions: rows });
});

router.post('/to-fulfill/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  if (!['fulfill', 'cancel'].includes(action)) throw new HttpError(404, 'Acción inválida');
  const note = req.body?.note ? String(req.body.note).trim().slice(0, 300) : null;

  const redemption = await withTx(async (c) => {
    const { rows } = await c.query(
      `UPDATE redemptions SET status = $3, admin_note = COALESCE($4, admin_note), resolved_at = now()
       WHERE id = $1 AND fulfiller_id = $2 AND status = 'pending' RETURNING *`,
      [id, req.user.id, action === 'fulfill' ? 'fulfilled' : 'cancelled', note],
    );
    const d = rows[0];
    if (!d) throw bad('Este canje ya fue resuelto');
    if (action === 'cancel') {
      await moveStars(c, d.user_id, d.cost, 'refund', `Devolución: ${d.reward_title}`);
      if (d.reward_id) await c.query('UPDATE rewards SET stock = stock + 1 WHERE id = $1 AND stock IS NOT NULL', [d.reward_id]);
    }
    return d;
  });

  const { rows: [redeemer] } = await pool.query('SELECT stars FROM users WHERE id = $1', [redemption.user_id]);
  emitTo(redemption.user_id, 'redemption:update', {
    by: nameOf(req.user),
    title: redemption.reward_title,
    status: redemption.status,
  });
  emitTo(redemption.user_id, 'stars', { stars: redeemer.stars });
  res.json({ redemption });
});

export default router;
