import { Router } from 'express';
import { withTx } from '../db.js';
import { bad } from '../errors.js';
import { parseBet, placeBet, settle } from '../wallet.js';
import { randomInt } from './common.js';

const router = Router();
export const SHELL_MULTIPLIER = 2.9;

router.post('/play', async (req, res) => {
  const bet = parseBet(req.body?.bet);
  const pick = Number(req.body?.pick);
  if (![0, 1, 2].includes(pick)) throw bad('Elige una de las tres cajitas');

  const catAt = randomInt(3);
  const win = catAt === pick;
  const payout = win ? Math.floor(bet * SHELL_MULTIPLIER) : 0;

  const { stars, outcome } = await withTx(async (c) => {
    await placeBet(c, req.user.id, 'shell', bet);
    return settle(c, {
      userId: req.user.id,
      game: 'shell',
      bet,
      payout,
      summary: win ? '¡Encontraste al michi!' : `El michi estaba en la cajita ${catAt + 1}`,
      details: { pick, catAt },
    });
  });

  res.json({ catAt, win, payout, stars, outcome });
});

export default router;
