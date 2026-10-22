import { randomUUID } from 'node:crypto';
import { pool, withTx } from '../db.js';
import { HttpError, bad } from '../errors.js';
import { MAX_BET, GAME_LABELS, placeBet, settle } from '../wallet.js';
import { emitTo } from '../bus.js';
import { getPartner } from '../couple.js';
import { MULTI_GAMES } from './games/index.js';

const INVITE_TTL = 3 * 60 * 1000;
const invites = new Map(); // id -> invitación (solo en memoria, caducan solas)
const matches = new Map(); // id -> partida activa en memoria
const locks = new Map();

const gameKey = (game) => `mp_${game}`;
const pub = (u) => ({ id: u.id, displayName: u.display_name || u.username, avatar: u.avatar });

/** Ejecuta las acciones de una misma partida de una en una. */
function withLock(id, fn) {
  const key = String(id);
  const run = (locks.get(key) || Promise.resolve()).then(fn);
  locks.set(key, run.catch(() => {}));
  return run;
}

async function emitStars(...userIds) {
  const { rows } = await pool.query('SELECT id, stars FROM users WHERE id = ANY($1)', [userIds]);
  for (const r of rows) emitTo(r.id, 'stars', { stars: r.stars });
}

export async function activeMatchFor(userId) {
  const { rows } = await pool.query(
    `SELECT id, game FROM matches WHERE status = 'active' AND (player_a = $1 OR player_b = $1)
     ORDER BY id DESC LIMIT 1`,
    [userId],
  );
  return rows[0] ? { id: Number(rows[0].id), game: rows[0].game } : null;
}

// ---------------- Invitaciones ----------------

function purgeInvites() {
  const now = Date.now();
  for (const [id, inv] of invites) if (now - inv.createdAt > INVITE_TTL) invites.delete(id);
}

export function invitesFor(userId) {
  purgeInvites();
  return [...invites.values()].filter((i) => i.from.id === userId || i.to.id === userId);
}

function notifyInvites(...userIds) {
  for (const id of userIds) emitTo(id, 'invites', invitesFor(id));
}

export function dropInvitesBetween(a, b) {
  for (const [id, inv] of invites) {
    if ([a, b].includes(inv.from.id) && [a, b].includes(inv.to.id)) invites.delete(id);
  }
  notifyInvites(a, b);
}

export async function sendInvite(user, { game, stake, options } = {}) {
  const def = MULTI_GAMES[game];
  if (!def) throw bad('Juego inválido');
  const amount = Number(stake ?? 0);
  if (!Number.isInteger(amount) || amount < 0 || amount > MAX_BET) throw bad('Apuesta inválida');

  const partner = await getPartner(pool, user.id);
  if (!partner) throw bad('Primero vincúlate con tu pareja');
  if (await activeMatchFor(user.id)) throw bad('Ya tienen una partida en curso, termínenla primero');
  const { rows } = await pool.query('SELECT stars FROM users WHERE id = $1', [user.id]);
  if (rows[0].stars < amount) throw bad('No tienes suficientes estrellitas para esa apuesta');

  for (const [id, inv] of invites) if (inv.from.id === user.id) invites.delete(id);
  const invite = {
    id: randomUUID(),
    game,
    stake: amount,
    options: def.parseOptions ? def.parseOptions(options) : {},
    from: pub(user),
    to: pub(partner),
    createdAt: Date.now(),
  };
  invites.set(invite.id, invite);
  notifyInvites(user.id, partner.id);
  return { invite };
}

export function cancelInvite(user, { inviteId } = {}) {
  const inv = invites.get(inviteId);
  if (inv && inv.from.id === user.id) {
    invites.delete(inviteId);
    notifyInvites(inv.from.id, inv.to.id);
  }
  return {};
}

export async function respondInvite(user, { inviteId, accept } = {}) {
  purgeInvites();
  const inv = invites.get(inviteId);
  if (!inv || inv.to.id !== user.id) throw bad('Esa invitación ya no está disponible');
  invites.delete(inviteId);

  if (!accept) {
    notifyInvites(inv.from.id, inv.to.id);
    emitTo(inv.from.id, 'invite:declined', { by: inv.to.displayName, game: inv.game });
    return {};
  }
  let match;
  try {
    match = await createMatch(inv);
  } finally {
    notifyInvites(inv.from.id, inv.to.id);
  }
  for (const p of match.players) emitTo(p.id, 'match:start', { matchId: match.id, game: match.game });
  return { matchId: match.id };
}

// ---------------- Partidas ----------------

async function createMatch(inv) {
  const def = MULTI_GAMES[inv.game];
  const [a, b] = [inv.from, inv.to];
  const row = await withTx(async (c) => {
    const busy = await c.query(
      `SELECT 1 FROM matches WHERE status = 'active' AND (player_a = ANY($1) OR player_b = ANY($1))`,
      [[a.id, b.id]],
    );
    if (busy.rowCount) throw bad('Ya tienen una partida en curso');
    if (inv.stake > 0) {
      for (const p of [a, b]) {
        try {
          await placeBet(c, p.id, gameKey(inv.game), inv.stake);
        } catch {
          throw bad(`${p.displayName} no tiene suficientes estrellitas para esta apuesta`);
        }
      }
    }
    const state = def.create({ options: inv.options });
    const { rows } = await c.query(
      `INSERT INTO matches (game, player_a, player_b, stake, state) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [inv.game, a.id, b.id, inv.stake, state],
    );
    return rows[0];
  });
  const m = { id: Number(row.id), game: row.game, stake: row.stake, status: 'active', state: row.state, result: null, players: [a, b] };
  matches.set(m.id, m);
  // Juegos con cuenta regresiva o tiempo límite programan sus temporizadores al empezar
  def.resume?.(m.state, ctxFor(m));
  await emitStars(a.id, b.id);
  // El blackjack puede terminar al repartir (blackjack del crupier o de ambos)
  if (m.state.finished) await finalize(m);
  return m;
}

async function loadMatch(id) {
  if (matches.has(id)) return matches.get(id);
  const { rows } = await pool.query('SELECT * FROM matches WHERE id = $1', [id]);
  const row = rows[0];
  if (!row) throw new HttpError(404, 'Partida no encontrada');
  const { rows: users } = await pool.query('SELECT * FROM users WHERE id = ANY($1)', [[row.player_a, row.player_b]]);
  const byId = Object.fromEntries(users.map((u) => [u.id, pub(u)]));
  const m = {
    id: Number(row.id),
    game: row.game,
    stake: row.stake,
    status: row.status,
    state: row.state,
    result: row.result,
    players: [byId[row.player_a], byId[row.player_b]],
  };
  if (m.status === 'active') {
    matches.set(m.id, m);
    // Tras un reinicio: re-programa temporizadores y cierra lo que ya debía terminar
    MULTI_GAMES[m.game].resume?.(m.state, ctxFor(m));
    if (m.state.finished) {
      await persist(m);
      await finalize(m);
    }
  }
  return m;
}

function ctxFor(m) {
  return {
    /** Envía un pulso a los dos jugadores (p. ej. posiciones calculadas por el servidor). */
    emit(data) {
      for (const p of m.players) emitTo(p.id, 'match:pulse', { matchId: m.id, from: -1, data });
    },
    /** Reenvía el estado completo a los dos (útil tras un temporizador sin guardar). */
    broadcast: () => broadcast(m),
    // persist: false para bucles rápidos (p. ej. la física de una carrera) que no necesitan guardarse siempre
    schedule(ms, fn, { persist: save = true } = {}) {
      setTimeout(() => {
        withLock(m.id, async () => {
          if (m.status !== 'active') return;
          fn(m.state, ctxFor(m));
          if (save || m.state.finished) await persist(m);
          if (m.state.finished) await finalize(m);
          broadcast(m);
        }).catch((err) => console.error('Error en temporizador de partida', err));
      }, Math.max(0, ms));
    },
  };
}

const persist = (m) => pool.query('UPDATE matches SET state = $2, updated_at = now() WHERE id = $1', [m.id, m.state]);

function summaryFor(m, idx, outcome) {
  const def = MULTI_GAMES[m.game];
  const other = m.players[1 - idx].displayName;
  const fin = m.state.finished;
  if (fin.forfeit === idx) return `Te rendiste contra ${other}`;
  if (fin.forfeit === 1 - idx) return `${other} se rindió, ¡ganaste!`;
  const head = fin.coop
    ? `En equipo con ${other}`
    : fin.table
    ? `Mesa con ${other}`
    : outcome === 'win' ? `Le ganaste a ${other}` : outcome === 'lose' ? `Ganó ${other}` : `Empate con ${other}`;
  return `${head} · ${def.detail(m.state, idx)}`;
}

async function finalize(m) {
  const def = MULTI_GAMES[m.game];
  const fin = m.state.finished;
  const stake = m.stake;
  const payouts = def.payouts
    ? def.payouts(m.state, stake)
    : fin.winner === null ? [stake, stake] : [0, 1].map((i) => (i === fin.winner ? stake * 2 : 0));
  const outcomes = def.outcomes
    ? def.outcomes(m.state)
    : [0, 1].map((i) => (fin.winner === null ? 'push' : i === fin.winner ? 'win' : 'lose'));

  await withTx(async (c) => {
    for (const i of [0, 1]) {
      await settle(c, {
        userId: m.players[i].id,
        game: gameKey(m.game),
        bet: stake,
        payout: payouts[i],
        outcome: outcomes[i],
        summary: summaryFor(m, i, outcomes[i]),
        details: { matchId: m.id, vs: m.players[1 - i].id },
      });
    }
    m.result = {
      winner: fin.winner,
      payouts,
      outcomes,
      forfeit: fin.forfeit ?? null,
      table: Boolean(fin.table),
      coop: Boolean(fin.coop),
      success: fin.success ?? null,
    };
    await c.query(`UPDATE matches SET status = 'finished', result = $2, state = $3, updated_at = now() WHERE id = $1`, [
      m.id,
      m.result,
      m.state,
    ]);
  });
  m.status = 'finished';
  matches.delete(m.id);
  await emitStars(m.players[0].id, m.players[1].id);
}

function view(m, idx) {
  return {
    id: m.id,
    game: m.game,
    label: GAME_LABELS[gameKey(m.game)],
    stake: m.stake,
    status: m.status,
    me: idx,
    players: m.players,
    state: MULTI_GAMES[m.game].view(m.state, idx),
    result: m.result,
  };
}

function broadcast(m) {
  m.players.forEach((p, i) => emitTo(p.id, 'match:update', view(m, i)));
}

function playerIndex(m, userId) {
  const idx = m.players.findIndex((p) => p.id === userId);
  if (idx === -1) throw new HttpError(403, 'No participas en esta partida');
  return idx;
}

export async function getMatchView(user, { matchId } = {}) {
  const m = await loadMatch(Number(matchId));
  return { match: view(m, playerIndex(m, user.id)) };
}

export function act(user, { matchId, action } = {}) {
  const id = Number(matchId);
  return withLock(id, async () => {
    const m = await loadMatch(id);
    const idx = playerIndex(m, user.id);
    if (m.status !== 'active') throw bad('La partida ya terminó');
    await MULTI_GAMES[m.game].act(m.state, idx, action, ctxFor(m));
    await persist(m);
    if (m.state.finished) await finalize(m);
    broadcast(m);
    return {};
  });
}

export function forfeit(user, { matchId } = {}) {
  const id = Number(matchId);
  return withLock(id, async () => {
    const m = await loadMatch(id);
    const idx = playerIndex(m, user.id);
    if (m.status !== 'active') throw bad('La partida ya terminó');
    const def = MULTI_GAMES[m.game];
    if (def.forfeit) def.forfeit(m.state, idx, ctxFor(m));
    else m.state.finished = { winner: 1 - idx, forfeit: idx };
    await persist(m);
    if (m.state.finished) await finalize(m);
    broadcast(m);
    return {};
  });
}

/**
 * Pulso en tiempo real (posición en carreras, trazos de dibujo…). No se guarda en la base en cada envío:
 * el juego actualiza su estado en memoria y decide qué reenviar a la pareja.
 */
export function pulse(user, { matchId, data } = {}) {
  const id = Number(matchId);
  return withLock(id, async () => {
    const m = await loadMatch(id);
    const idx = playerIndex(m, user.id);
    const def = MULTI_GAMES[m.game];
    if (m.status !== 'active' || !def.pulse) return {};
    const out = def.pulse(m.state, idx, data ?? {}, ctxFor(m));
    if (out != null) emitTo(m.players[1 - idx].id, 'match:pulse', { matchId: m.id, from: idx, data: out });
    if (m.state.finished) {
      await persist(m);
      await finalize(m);
      broadcast(m);
    }
    return {};
  });
}
