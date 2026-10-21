import { Router } from 'express';
import { pool, withTx } from '../db.js';
import { HttpError, bad } from '../errors.js';
import { createSession, getActiveSession, parseBet, placeBet, saveSession, settle } from '../wallet.js';
import { randomCard } from './common.js';

const router = Router();

// Mazo infinito: probabilidad de que la siguiente carta sea estrictamente mayor/menor
const chance = { higher: (r) => (13 - r) / 13, lower: (r) => (r - 1) / 13 };
const stepMultiplier = (p) => (p > 0 ? Math.floor((0.96 / p) * 100) / 100 : null);
const round2 = (x) => Math.round(x * 100) / 100;

function view(session) {
  const s = session.state;
  const r = s.current.r;
  return {
    id: session.id,
    bet: session.bet,
    status: session.status,
    current: s.current,
    history: s.history,
    steps: s.steps,
    multiplier: s.multiplier,
    potential: Math.floor(session.bet * s.multiplier),
    odds: { higher: stepMultiplier(chance.higher(r)), lower: stepMultiplier(chance.lower(r)) },
    result: s.result ?? null,
    payout: s.payout ?? 0,
  };
}

async function finish(c, session, userId, result, payout, summary) {
  session.state = { ...session.state, result, payout };
  const saved = await saveSession(c, session, { status: 'finished' });
  const { stars, outcome } = await settle(c, {
    userId,
    game: 'hilo',
    bet: saved.bet,
    payout,
    summary,
    details: { history: saved.state.history, multiplier: saved.state.multiplier, steps: saved.state.steps },
  });
  return { game: view(saved), stars, outcome };
}

router.get('/', async (req, res) => {
  const session = await getActiveSession(pool, req.user.id, 'hilo');
  res.json({ game: session ? view(session) : null });
});

router.post('/start', async (req, res) => {
  const bet = parseBet(req.body?.bet);
  const result = await withTx(async (c) => {
    if (await getActiveSession(c, req.user.id, 'hilo', { forUpdate: true })) {
      throw new HttpError(409, 'Ya tienes una partida en curso');
    }
    const stars = await placeBet(c, req.user.id, 'hilo', bet);
    const current = randomCard();
    const session = await createSession(c, req.user.id, 'hilo', bet, {
      current, history: [current], multiplier: 1, steps: 0,
    });
    return { game: view(session), stars };
  });
  res.json(result);
});

router.post('/guess', async (req, res) => {
  const choice = String(req.body?.choice);
  if (!(choice in chance)) throw bad('Elige mayor o menor');

  const result = await withTx(async (c) => {
    const session = await getActiveSession(c, req.user.id, 'hilo', { forUpdate: true });
    if (!session) throw bad('No tienes una partida en curso');
    const s = session.state;
    const step = stepMultiplier(chance[choice](s.current.r));
    if (!step) throw bad(choice === 'higher' ? 'No hay cartas mayores que esa' : 'No hay cartas menores que esa');

    const next = randomCard();
    const correct = choice === 'higher' ? next.r > s.current.r : next.r < s.current.r;
    s.history = [...s.history, next];
    if (!correct) {
      s.current = next;
      return finish(c, session, req.user.id, 'lose', 0, `Fallaste en la ronda ${s.steps + 1}`);
    }
    s.current = next;
    s.steps += 1;
    s.multiplier = round2(s.multiplier * step);
    const saved = await saveSession(c, session);
    const stars = (await c.query('SELECT stars FROM users WHERE id = $1', [req.user.id])).rows[0].stars;
    return { game: view(saved), stars, correct: true };
  });
  res.json(result);
});

router.post('/cashout', async (req, res) => {
  const result = await withTx(async (c) => {
    const session = await getActiveSession(c, req.user.id, 'hilo', { forUpdate: true });
    if (!session) throw bad('No tienes una partida en curso');
    const s = session.state;
    if (s.steps < 1) throw bad('Acierta al menos una carta antes de cobrar');
    const payout = Math.floor(session.bet * s.multiplier);
    return finish(c, session, req.user.id, 'cashout', payout, `Cobraste x${s.multiplier} tras ${s.steps} aciertos`);
  });
  res.json(result);
});

export default router;
