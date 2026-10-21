import { Router } from 'express';
import { withTx } from '../db.js';
import { bad } from '../errors.js';
import { placeBet, settle, MAX_BET } from '../wallet.js';
import { randomInt } from './common.js';

const router = Router();

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
// Lo que se devuelve por cada estrellita apostada (incluye la apuesta)
const RETURNS = { number: 36, red: 2, black: 2, even: 2, odd: 2, low: 2, high: 2, dozen: 3, column: 3 };
const LABELS = {
  red: 'Rojo', black: 'Negro', even: 'Par', odd: 'Impar', low: '1-18', high: '19-36',
};

const colorOf = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');

function wins(type, value, n) {
  switch (type) {
    case 'number': return n === value;
    case 'red': return RED.has(n);
    case 'black': return n !== 0 && !RED.has(n);
    case 'even': return n !== 0 && n % 2 === 0;
    case 'odd': return n % 2 === 1;
    case 'low': return n >= 1 && n <= 18;
    case 'high': return n >= 19;
    case 'dozen': return n !== 0 && Math.ceil(n / 12) === value;
    case 'column': return n !== 0 && ((n - 1) % 3) + 1 === value;
    default: return false;
  }
}

function parseBets(raw) {
  if (!Array.isArray(raw) || raw.length === 0) throw bad('Coloca al menos una ficha en la mesa');
  if (raw.length > 60) throw bad('Demasiadas apuestas en una sola tirada');
  return raw.map((b) => {
    const type = String(b?.type);
    if (!(type in RETURNS)) throw bad('Tipo de apuesta inválido');
    const amount = Number(b.amount);
    if (!Number.isInteger(amount) || amount < 1) throw bad('Cada ficha debe valer al menos 1 ⭐');
    let value = null;
    if (type === 'number') {
      value = Number(b.value);
      if (!Number.isInteger(value) || value < 0 || value > 36) throw bad('Número inválido');
    } else if (type === 'dozen' || type === 'column') {
      value = Number(b.value);
      if (![1, 2, 3].includes(value)) throw bad('Docena o columna inválida');
    }
    return { type, value, amount };
  });
}

const betLabel = (b) =>
  b.type === 'number' ? `Pleno ${b.value}`
  : b.type === 'dozen' ? `${b.value}ª docena`
  : b.type === 'column' ? `Columna ${b.value}`
  : LABELS[b.type];

router.post('/spin', async (req, res) => {
  const bets = parseBets(req.body?.bets);
  const totalBet = bets.reduce((s, b) => s + b.amount, 0);
  if (totalBet > MAX_BET) throw bad(`La apuesta máxima es ${MAX_BET} ⭐`);

  const number = randomInt(37);
  const winningBets = bets.filter((b) => wins(b.type, b.value, number));
  const payout = winningBets.reduce((s, b) => s + b.amount * RETURNS[b.type], 0);
  const color = colorOf(number);
  const colorName = { red: 'rojo', black: 'negro', green: 'verde' }[color];

  const { stars, outcome } = await withTx(async (c) => {
    await placeBet(c, req.user.id, 'roulette', totalBet);
    return settle(c, {
      userId: req.user.id,
      game: 'roulette',
      bet: totalBet,
      payout,
      summary: winningBets.length
        ? `Salió el ${number} ${colorName} · acertaste ${winningBets.map(betLabel).join(', ')}`
        : `Salió el ${number} ${colorName}`,
      details: { number, color, bets },
    });
  });

  res.json({ number, color, payout, totalBet, winningBets, stars, outcome });
});

export default router;
