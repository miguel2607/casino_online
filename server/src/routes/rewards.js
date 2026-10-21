import { Router } from 'express';
import { pool, withTx } from '../db.js';
import { HttpError, bad } from '../errors.js';
import { moveStars } from '../wallet.js';

const router = Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, title, description, cost, icon, stock FROM rewards WHERE active ORDER BY cost, id',
  );
  res.json({ rewards: rows });
});

router.get('/mine', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, reward_id, reward_title, reward_icon, cost, status, note, admin_note, created_at, resolved_at
     FROM redemptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.user.id],
  );
  res.json({ redemptions: rows });
});

router.post('/:id/redeem', async (req, res) => {
  const rewardId = parseInt(req.params.id, 10);
  if (!rewardId) throw bad('Recompensa inválida');
  const note = req.body?.note ? String(req.body.note).trim().slice(0, 300) : null;

  const result = await withTx(async (c) => {
    const { rows } = await c.query('SELECT * FROM rewards WHERE id = $1 FOR UPDATE', [rewardId]);
    const reward = rows[0];
    if (!reward || !reward.active) throw new HttpError(404, 'Esta recompensa ya no está disponible');
    if (reward.stock !== null && reward.stock <= 0) throw bad('Esta recompensa está agotada 😿');

    const stars = await moveStars(c, req.user.id, -reward.cost, 'redeem', `Canje: ${reward.title}`);
    if (reward.stock !== null) {
      await c.query('UPDATE rewards SET stock = stock - 1, updated_at = now() WHERE id = $1', [reward.id]);
    }
    const { rows: [redemption] } = await c.query(
      `INSERT INTO redemptions (user_id, reward_id, reward_title, reward_icon, cost, note)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, reward.id, reward.title, reward.icon, reward.cost, note],
    );
    return { stars, redemption };
  });

  res.status(201).json(result);
});

export default router;
