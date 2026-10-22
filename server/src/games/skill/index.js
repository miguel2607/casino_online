import { Router } from 'express';
import { pool, withTx } from '../../db.js';
import { HttpError, bad } from '../../errors.js';
import { createSession, getActiveSession, parseBet, placeBet, saveSession, settle } from '../../wallet.js';
import { SKILL_GAMES } from './defs.js';

// Juegos de habilidad individuales: pagas la entrada y cobras según tu desempeño.
const router = Router();
const key = (game) => `sk_${game}`;

function getDef(req) {
  const def = SKILL_GAMES[req.params.game];
  if (!def) throw new HttpError(404, 'Juego no encontrado');
  return def;
}

const view = (def, session) => ({ id: session.id, bet: session.bet, startedAt: session.state.startedAt, ...def.view(session.state) });

async function finishSession(c, req, def, session, result) {
  const payout = Math.floor(session.bet * result.multiplier);
  await saveSession(c, session, { status: 'finished' });
  const { stars, outcome } = await settle(c, {
    userId: req.user.id,
    game: key(req.params.game),
    bet: session.bet,
    payout,
    summary: result.summary,
    details: result.details,
  });
  return { finished: true, payout, multiplier: result.multiplier, summary: result.summary, stars, outcome, game: view(def, session) };
}

router.get('/:game', async (req, res) => {
  const def = getDef(req);
  const session = await getActiveSession(pool, req.user.id, key(req.params.game));
  res.json({ game: session ? view(def, session) : null });
});

router.post('/:game/start', async (req, res) => {
  const def = getDef(req);
  const bet = parseBet(req.body?.bet);
  const options = def.parseOptions ? def.parseOptions(req.body?.options) : {};
  const result = await withTx(async (c) => {
    if (await getActiveSession(c, req.user.id, key(req.params.game), { forUpdate: true })) {
      throw new HttpError(409, 'Ya tienes una partida en curso');
    }
    const stars = await placeBet(c, req.user.id, key(req.params.game), bet);
    const state = { ...def.start({ options }), startedAt: Date.now() };
    const session = await createSession(c, req.user.id, key(req.params.game), bet, state);
    return { game: view(def, session), stars };
  });
  res.json(result);
});

async function withSession(req, fn) {
  const def = getDef(req);
  return withTx(async (c) => {
    const session = await getActiveSession(c, req.user.id, key(req.params.game), { forUpdate: true });
    if (!session) throw bad('No tienes una partida en curso');
    return fn(c, def, session);
  });
}

/** Guarda el progreso (para poder retomar la partida). */
router.post('/:game/sync', async (req, res) => {
  const result = await withSession(req, async (c, def, session) => {
    if (!def.sync) throw bad('Este juego no guarda progreso');
    def.sync(session.state, req.body ?? {});
    await saveSession(c, session);
    return { ok: true };
  });
  res.json(result);
});

/** Acción con respuesta del servidor (p. ej. un intento de Wordle). */
router.post('/:game/action', async (req, res) => {
  const result = await withSession(req, async (c, def, session) => {
    if (!def.action) throw bad('Acción inválida');
    const done = def.action(session.state, req.body ?? {});
    if (done) return finishSession(c, req, def, session, done);
    await saveSession(c, session);
    return { finished: false, game: view(def, session) };
  });
  res.json(result);
});

router.post('/:game/finish', async (req, res) => {
  const result = await withSession(req, async (c, def, session) => {
    if (!def.finish) throw bad('Este juego termina solo');
    return finishSession(c, req, def, session, def.finish(session.state, req.body ?? {}));
  });
  res.json(result);
});

router.post('/:game/forfeit', async (req, res) => {
  const result = await withSession(req, async (c, def, session) =>
    finishSession(c, req, def, session, { multiplier: 0, summary: 'Te retiraste de la partida', details: {} }),
  );
  res.json(result);
});

export default router;
