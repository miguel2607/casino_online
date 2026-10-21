import { Router } from 'express';
import { withTx } from '../db.js';
import { bad } from '../errors.js';
import { placeBet, settle } from '../wallet.js';
import { randomInt, shuffle, weightedPick } from './common.js';

const router = Router();

export const TICKETS = { mini: 10, classic: 50, deluxe: 200 };
// Pesos sobre 1000 · RTP aproximado del 98 %
const PRIZES = [
  { symbol: null, multiplier: 0, weight: 639 },
  { symbol: 'paw', multiplier: 1, weight: 150 },
  { symbol: 'fish', multiplier: 2, weight: 100 },
  { symbol: 'yarn', multiplier: 3, weight: 60 },
  { symbol: 'milk', multiplier: 5, weight: 30 },
  { symbol: 'star', multiplier: 10, weight: 15 },
  { symbol: 'cat', multiplier: 25, weight: 6 },
];
const ALL = ['paw', 'fish', 'yarn', 'milk', 'star', 'cat'];

/** 9 casillas: el símbolo ganador aparece 3 veces y ningún otro más de 2. */
function buildGrid(winSymbol) {
  const cells = winSymbol ? [winSymbol, winSymbol, winSymbol] : [];
  const pool = ALL.filter((s) => s !== winSymbol);
  const counts = {};
  while (cells.length < 9) {
    const s = pool[randomInt(pool.length)];
    if ((counts[s] || 0) < 2) {
      counts[s] = (counts[s] || 0) + 1;
      cells.push(s);
    }
  }
  return shuffle(cells);
}

router.post('/buy', async (req, res) => {
  const ticket = String(req.body?.ticket);
  const price = TICKETS[ticket];
  if (!price) throw bad('Boleto inválido');

  const prize = weightedPick(PRIZES);
  const grid = buildGrid(prize.symbol);
  const payout = price * prize.multiplier;

  const { stars, outcome } = await withTx(async (c) => {
    await placeBet(c, req.user.id, 'scratch', price);
    return settle(c, {
      userId: req.user.id,
      game: 'scratch',
      bet: price,
      payout,
      summary: prize.multiplier ? `Tres iguales · x${prize.multiplier}` : 'Boleto sin premio',
      details: { ticket, grid, symbol: prize.symbol },
    });
  });

  res.json({ grid, symbol: prize.symbol, multiplier: prize.multiplier, payout, price, stars, outcome });
});

export default router;
