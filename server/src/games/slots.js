import { Router } from 'express';
import { withTx } from '../db.js';
import { parseBet, placeBet, settle } from '../wallet.js';
import { weightedPick } from './common.js';

const router = Router();

// RTP aproximado del 97.8 %
export const SYMBOLS = [
  { id: 'paw', weight: 28, three: 4, two: 1 },
  { id: 'yarn', weight: 24, three: 6, two: 1 },
  { id: 'fish', weight: 20, three: 10, two: 1.5 },
  { id: 'milk', weight: 15, three: 15, two: 2 },
  { id: 'star', weight: 9, three: 30, two: 3 },
  { id: 'cat', weight: 4, three: 100, two: 5 },
];
const NAMES = { paw: 'patitas', yarn: 'estambres', fish: 'pescaditos', milk: 'lechitas', star: 'estrellas', cat: 'michis' };

router.post('/spin', async (req, res) => {
  const bet = parseBet(req.body?.bet);
  const reels = [0, 1, 2].map(() => weightedPick(SYMBOLS).id);

  const counts = {};
  for (const id of reels) counts[id] = (counts[id] || 0) + 1;
  const [bestId, bestCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const sym = SYMBOLS.find((s) => s.id === bestId);
  const multiplier = bestCount === 3 ? sym.three : bestCount === 2 ? sym.two : 0;
  const payout = Math.floor(bet * multiplier);

  const { stars, outcome } = await withTx(async (c) => {
    await placeBet(c, req.user.id, 'slots', bet);
    return settle(c, {
      userId: req.user.id,
      game: 'slots',
      bet,
      payout,
      summary: multiplier
        ? `${bestCount === 3 ? 'Tres' : 'Dos'} ${NAMES[bestId]} · x${multiplier}`
        : 'Sin combinación',
      details: { reels, multiplier },
    });
  });

  res.json({ reels, multiplier, payout, stars, outcome });
});

export default router;
