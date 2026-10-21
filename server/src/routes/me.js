import { Router } from 'express';
import { pool, withTx, getSetting } from '../db.js';
import { bad } from '../errors.js';
import { moveStars } from '../wallet.js';
import { AVATARS, publicUser, todayStr } from '../auth.js';

const router = Router();

const clampLimit = (v, def = 30, max = 200) => Math.min(Math.max(parseInt(v, 10) || def, 1), max);

router.post('/daily-bonus', async (req, res) => {
  const today = todayStr();
  const amount = Number(await getSetting('daily_bonus', 200)) || 0;
  const stars = await withTx(async (c) => {
    const { rowCount } = await c.query(
      `UPDATE users SET last_daily_bonus = $2
       WHERE id = $1 AND (last_daily_bonus IS NULL OR last_daily_bonus < $2)`,
      [req.user.id, today],
    );
    if (!rowCount) throw bad('Ya reclamaste tu bono de hoy, vuelve mañana 😺');
    return moveStars(c, req.user.id, amount, 'bonus', 'Bono diario ☀️');
  });
  res.json({ stars, amount });
});

router.patch('/profile', async (req, res) => {
  const displayName = req.body?.displayName != null ? String(req.body.displayName).trim().slice(0, 40) : null;
  const avatar = req.body?.avatar;
  if (avatar != null && !AVATARS.includes(avatar)) throw bad('Avatar inválido');
  const { rows } = await pool.query(
    `UPDATE users SET display_name = COALESCE(NULLIF($2, ''), display_name), avatar = COALESCE($3, avatar)
     WHERE id = $1 RETURNING *`,
    [req.user.id, displayName, avatar ?? null],
  );
  res.json({ user: publicUser(rows[0]) });
});

router.get('/history', async (req, res) => {
  const limit = clampLimit(req.query.limit);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const game = req.query.game ? String(req.query.game) : null;
  const { rows } = await pool.query(
    `SELECT id, game, bet, payout, outcome, summary, details, created_at
     FROM game_results WHERE user_id = $1 AND ($2::text IS NULL OR game = $2)
     ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`,
    [req.user.id, game, limit, offset],
  );
  res.json({ results: rows });
});

router.get('/transactions', async (req, res) => {
  const limit = clampLimit(req.query.limit, 50);
  const { rows } = await pool.query(
    `SELECT id, amount, balance_after, kind, description, game, created_at
     FROM transactions WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
    [req.user.id, limit],
  );
  res.json({ transactions: rows });
});

router.get('/stats', async (req, res) => {
  const { rows: games } = await pool.query(
    `SELECT game,
            count(*)::int AS played,
            count(*) FILTER (WHERE outcome = 'win')::int AS wins,
            coalesce(sum(bet), 0)::int AS wagered,
            coalesce(sum(payout), 0)::int AS returned,
            coalesce(max(payout - bet), 0)::int AS best
     FROM game_results WHERE user_id = $1 GROUP BY game ORDER BY played DESC`,
    [req.user.id],
  );
  const { rows: [redeemed] } = await pool.query(
    `SELECT count(*)::int AS count, coalesce(sum(cost), 0)::int AS stars
     FROM redemptions WHERE user_id = $1 AND status <> 'cancelled'`,
    [req.user.id],
  );
  const totals = games.reduce(
    (t, g) => ({
      played: t.played + g.played,
      wins: t.wins + g.wins,
      wagered: t.wagered + g.wagered,
      returned: t.returned + g.returned,
      best: Math.max(t.best, g.best),
    }),
    { played: 0, wins: 0, wagered: 0, returned: 0, best: 0 },
  );
  res.json({ totals, games, redeemed, user: publicUser(req.user) });
});

export default router;
