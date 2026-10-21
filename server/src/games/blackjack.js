import { Router } from 'express';
import { pool, withTx } from '../db.js';
import { HttpError, bad } from '../errors.js';
import { createSession, getActiveSession, parseBet, placeBet, saveSession, settle, moveStars } from '../wallet.js';
import { newDeck } from './common.js';

const router = Router();

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.r === 1) {
      aces++;
      total += 11;
    } else total += Math.min(c.r, 10);
  }
  while (total > 21 && aces) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;

function view(session) {
  const s = session.state;
  const done = session.status === 'finished';
  return {
    id: session.id,
    bet: session.bet,
    status: session.status,
    player: s.player,
    dealer: done ? s.dealer : [s.dealer[0], { hidden: true }],
    playerTotal: handValue(s.player).total,
    dealerTotal: handValue(done ? s.dealer : [s.dealer[0]]).total,
    canDouble: !done && s.player.length === 2 && !s.doubled,
    doubled: s.doubled,
    result: s.result ?? null,
    payout: s.payout ?? 0,
  };
}

async function finish(c, session, userId, result, payout, summary) {
  session.state = { ...session.state, result, payout };
  const saved = await saveSession(c, session, { status: 'finished' });
  const s = saved.state;
  const { stars, outcome } = await settle(c, {
    userId,
    game: 'blackjack',
    bet: saved.bet,
    payout,
    summary,
    details: { player: s.player, dealer: s.dealer, doubled: s.doubled, result },
  });
  return { game: view(saved), stars, outcome };
}

/** El crupier roba hasta 17 o más y se compara. */
async function resolveStand(c, session, userId) {
  const s = session.state;
  const p = handValue(s.player).total;
  while (handValue(s.dealer).total < 17) s.dealer.push(s.deck.pop());
  const d = handValue(s.dealer).total;
  const bet = session.bet;
  if (d > 21) return finish(c, session, userId, 'win', bet * 2, `El crupier se pasó con ${d} · tú ${p}`);
  if (p > d) return finish(c, session, userId, 'win', bet * 2, `Ganaste ${p} a ${d}`);
  if (p === d) return finish(c, session, userId, 'push', bet, `Empate a ${p}`);
  return finish(c, session, userId, 'lose', 0, `La casa ganó ${d} a ${p}`);
}

router.get('/', async (req, res) => {
  const session = await getActiveSession(pool, req.user.id, 'blackjack');
  res.json({ game: session ? view(session) : null });
});

router.post('/start', async (req, res) => {
  const bet = parseBet(req.body?.bet);
  const result = await withTx(async (c) => {
    if (await getActiveSession(c, req.user.id, 'blackjack', { forUpdate: true })) {
      throw new HttpError(409, 'Ya tienes una mano en curso');
    }
    const stars = await placeBet(c, req.user.id, 'blackjack', bet);
    const deck = newDeck(6).slice(0, 40);
    const player = [deck.pop()];
    const dealer = [deck.pop()];
    player.push(deck.pop());
    dealer.push(deck.pop());
    const session = await createSession(c, req.user.id, 'blackjack', bet, { deck, player, dealer, doubled: false });

    const pBJ = isBlackjack(player);
    const dBJ = isBlackjack(dealer);
    if (pBJ && dBJ) return finish(c, session, req.user.id, 'push', bet, 'Ambos con blackjack · empate');
    if (pBJ) return finish(c, session, req.user.id, 'blackjack', bet + Math.floor(bet * 1.5), '¡Blackjack natural! 🎉');
    if (dBJ) return finish(c, session, req.user.id, 'lose', 0, 'La casa tuvo blackjack');
    return { game: view(session), stars };
  });
  res.json(result);
});

router.post('/action', async (req, res) => {
  const action = String(req.body?.action);
  if (!['hit', 'stand', 'double'].includes(action)) throw bad('Acción inválida');

  const result = await withTx(async (c) => {
    const session = await getActiveSession(c, req.user.id, 'blackjack', { forUpdate: true });
    if (!session) throw bad('No tienes una mano en curso');
    const s = session.state;
    const uid = req.user.id;

    if (action === 'stand') return resolveStand(c, session, uid);

    if (action === 'double') {
      if (s.player.length !== 2 || s.doubled) throw bad('Solo puedes doblar con tus dos primeras cartas');
      await moveStars(c, uid, -session.bet, 'bet', 'Apuesta doblada en Blackjack', 'blackjack');
      session.bet *= 2;
      s.doubled = true;
      s.player.push(s.deck.pop());
      const total = handValue(s.player).total;
      if (total > 21) return finish(c, session, uid, 'bust', 0, `Te pasaste con ${total} (doblando)`);
      return resolveStand(c, session, uid);
    }

    // hit
    s.player.push(s.deck.pop());
    const total = handValue(s.player).total;
    if (total > 21) return finish(c, session, uid, 'bust', 0, `Te pasaste con ${total}`);
    if (total === 21) return resolveStand(c, session, uid);
    const saved = await saveSession(c, session);
    const stars = (await c.query('SELECT stars FROM users WHERE id = $1', [uid])).rows[0].stars;
    return { game: view(saved), stars };
  });
  res.json(result);
});

export default router;
