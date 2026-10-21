import { Router } from 'express';
import { withTx } from '../db.js';
import { bad } from '../errors.js';
import { createSession, getActiveSession, parseBet, placeBet, saveSession, settle } from '../wallet.js';
import { randomFloat } from './common.js';

const router = Router();

const CATS = [
  { id: 'bigotes', name: 'Bigotes', color: 'orange' },
  { id: 'luna', name: 'Luna', color: 'black' },
  { id: 'copito', name: 'Copito', color: 'white' },
  { id: 'canela', name: 'Canela', color: 'calico' },
  { id: 'nube', name: 'Nube', color: 'gray' },
  { id: 'galleta', name: 'Galleta', color: 'cream' },
];

export function newCard() {
  const strength = CATS.map(() => 1 + randomFloat() * 3);
  const total = strength.reduce((a, b) => a + b, 0);
  return {
    runners: CATS.map((cat, i) => {
      const p = strength[i] / total;
      return { ...cat, p, odds: Math.max(1.2, Math.floor((0.95 / p) * 10) / 10) };
    }),
  };
}

/** Orden de llegada: sorteo ponderado sin reemplazo. */
export function raceOrder(runners) {
  const left = [...runners];
  const order = [];
  while (left.length) {
    const total = left.reduce((s, r) => s + r.p, 0);
    let roll = randomFloat() * total;
    let idx = left.findIndex((r) => (roll -= r.p) < 0);
    if (idx === -1) idx = left.length - 1;
    order.push(left.splice(idx, 1)[0].id);
  }
  return order;
}

const publicCard = (session) => ({
  raceId: session.id,
  runners: session.state.runners.map(({ p, ...r }) => ({ ...r, chance: Math.round(p * 100) })),
});

async function getOrCreateCard(c, userId) {
  const existing = await getActiveSession(c, userId, 'race', { forUpdate: true });
  return existing || createSession(c, userId, 'race', 0, newCard());
}

router.get('/card', async (req, res) => {
  const session = await withTx((c) => getOrCreateCard(c, req.user.id));
  res.json(publicCard(session));
});

router.post('/bet', async (req, res) => {
  const bet = parseBet(req.body?.bet);
  const catId = String(req.body?.cat);

  const result = await withTx(async (c) => {
    const session = await getActiveSession(c, req.user.id, 'race', { forUpdate: true });
    if (!session || (req.body?.raceId && Number(req.body.raceId) !== Number(session.id))) {
      throw bad('Esta carrera ya terminó, revisa la nueva tarjeta');
    }
    const runner = session.state.runners.find((r) => r.id === catId);
    if (!runner) throw bad('Elige un michi para apostar');

    await placeBet(c, req.user.id, 'race', bet);
    const order = raceOrder(session.state.runners);
    const win = order[0] === catId;
    const payout = win ? Math.floor(bet * runner.odds) : 0;
    const winnerName = session.state.runners.find((r) => r.id === order[0]).name;
    const position = order.indexOf(catId) + 1;

    session.state = { ...session.state, order, pick: catId };
    await saveSession(c, session, { status: 'finished', bet });
    const { stars, outcome } = await settle(c, {
      userId: req.user.id,
      game: 'race',
      bet,
      payout,
      summary: win
        ? `¡${runner.name} ganó la carrera! (x${runner.odds})`
        : `Ganó ${winnerName} · ${runner.name} llegó de ${position}º`,
      details: { pick: catId, odds: runner.odds, order },
    });
    const next = await createSession(c, req.user.id, 'race', 0, newCard());
    return { order, win, payout, stars, outcome, nextCard: publicCard(next) };
  });

  res.json(result);
});

export default router;
