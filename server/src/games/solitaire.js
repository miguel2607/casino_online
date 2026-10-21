import { Router } from 'express';
import { pool, withTx } from '../db.js';
import { HttpError, bad } from '../errors.js';
import { createSession, getActiveSession, parseBet, placeBet, saveSession, settle } from '../wallet.js';
import { randomInt } from './common.js';
import { DIFFICULTIES, MAX_MOVES, isWon, replay } from '../../../shared/solitaire.js';

const router = Router();

const view = (session) => ({
  id: session.id,
  bet: session.bet,
  status: session.status,
  difficulty: session.state.difficulty,
  seed: session.state.seed,
  moves: session.state.moves,
  multiplier: DIFFICULTIES[session.state.difficulty].multiplier,
  startedAt: session.created_at,
});

router.get('/', async (req, res) => {
  const session = await getActiveSession(pool, req.user.id, 'solitaire');
  res.json({ game: session ? view(session) : null });
});

router.post('/start', async (req, res) => {
  const difficulty = String(req.body?.difficulty);
  if (!DIFFICULTIES[difficulty]) throw bad('Elige una dificultad');
  const bet = parseBet(req.body?.bet);

  const result = await withTx(async (c) => {
    if (await getActiveSession(c, req.user.id, 'solitaire', { forUpdate: true })) {
      throw new HttpError(409, 'Ya tienes un solitario en curso');
    }
    const stars = await placeBet(c, req.user.id, 'solitaire', bet);
    const session = await createSession(c, req.user.id, 'solitaire', bet, {
      seed: randomInt(1, 2 ** 31 - 1),
      difficulty,
      moves: [],
    });
    return { game: view(session), stars };
  });
  res.json(result);
});

/** Guarda el progreso; si los movimientos completan el juego, paga el premio. */
router.post('/sync', async (req, res) => {
  const moves = req.body?.moves;
  if (!Array.isArray(moves) || moves.length > MAX_MOVES) throw bad('Movimientos inválidos');

  const result = await withTx(async (c) => {
    const session = await getActiveSession(c, req.user.id, 'solitaire', { forUpdate: true });
    if (!session) throw bad('No tienes un solitario en curso');
    const { seed, difficulty } = session.state;
    const cfg = DIFFICULTIES[difficulty];
    if (!cfg.undo && moves.length < session.state.moves.length) throw bad('En difícil no se puede deshacer');

    const state = replay(seed, difficulty, moves);
    if (!state) throw bad('Hay un movimiento inválido, recarga la partida');

    session.state = { ...session.state, moves };
    if (!isWon(state)) {
      await saveSession(c, session);
      return { won: false };
    }
    await saveSession(c, session, { status: 'finished' });
    const payout = Math.floor(session.bet * cfg.multiplier);
    const { stars, outcome } = await settle(c, {
      userId: req.user.id,
      game: 'solitaire',
      bet: session.bet,
      payout,
      summary: `Ganaste en ${cfg.label} con ${moves.length} movimientos (x${cfg.multiplier})`,
      details: { difficulty, moves: moves.length, seed },
    });
    return { won: true, payout, stars, outcome };
  });
  res.json(result);
});

router.post('/forfeit', async (req, res) => {
  const result = await withTx(async (c) => {
    const session = await getActiveSession(c, req.user.id, 'solitaire', { forUpdate: true });
    if (!session) throw bad('No tienes un solitario en curso');
    await saveSession(c, session, { status: 'finished' });
    const cfg = DIFFICULTIES[session.state.difficulty];
    return settle(c, {
      userId: req.user.id,
      game: 'solitaire',
      bet: session.bet,
      payout: 0,
      summary: `Te rendiste en ${cfg.label} tras ${session.state.moves.length} movimientos`,
      details: { difficulty: session.state.difficulty, moves: session.state.moves.length },
    });
  });
  res.json(result);
});

export default router;
