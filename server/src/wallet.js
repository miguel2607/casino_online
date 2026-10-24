import { HttpError, bad } from './errors.js';

export const GAME_LABELS = {
  blackjack: 'Blackjack',
  roulette: 'Ruleta',
  solitaire: 'Solitario',
  race: 'Carrera de Michis',
  slots: 'Tragamichis',
  hilo: 'Mayor o Menor',
  shell: 'Encuentra al Michi',
  scratch: 'Rasca y Gana',
  // Habilidad (individual)
  sk_g2048: '2048 de Michis',
  sk_mines: 'Buscaminas de Michis',
  sk_sudoku: 'Sudoku de Michis',
  sk_simon: 'Simón Michi',
  sk_wordle: 'Michi-Wordle',
  sk_flappy: 'Flappy Michi',
  sk_runner: 'Michi Runner', // retirado: se conserva para el historial
  sk_kart: 'Michi Kart',
  sk_sprint: 'Sprint de 100 metros',
  // En pareja (tiempo real)
  mp_rps: 'Piedra, papel o tijera',
  mp_connect4: 'Conecta 4 de Michis',
  mp_memory: 'Memoria de Michis',
  mp_solitaire: 'Duelo de Solitario',
  mp_blackjack: 'Blackjack en pareja',
  mp_race: 'Carrera en pareja',
  mp_battleship: 'Batalla Naval de Michis',
  mp_dots: 'Puntos y cajas',
  mp_ultimate: 'Tres en raya gigante',
  mp_tictactoe: 'Tres en raya',
  mp_duel2048: 'Duelo de 2048',
  mp_duelwordle: 'Duelo de Wordle',
  mp_stop: 'Stop / Basta',
  mp_reflex: 'Duelo de reflejos',
  mp_draw: 'Dibuja y adivina',
  mp_memorytime: 'Memoria contra el reloj',
  mp_wordsearch: 'Sopa de letras en equipo',
  mp_simonteam: 'Simón en equipo',
  mp_ghostrace: 'Carrera fantasma',
  mp_relay: 'Relevos',
  mp_sprintlive: 'Sprint en vivo',
  mp_sprintteam: 'Sprint en equipo',
};

export const MAX_BET = 1_000_000;

export function parseBet(value, { min = 1, max = MAX_BET } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) throw bad(`La apuesta mínima es ${min} ⭐`);
  if (n > max) throw bad(`La apuesta máxima es ${max} ⭐`);
  return n;
}

/** Suma (o resta) estrellitas de forma atómica y deja el movimiento en el libro. */
export async function moveStars(client, userId, amount, kind, description, game = null) {
  const { rows } = await client.query(
    'UPDATE users SET stars = stars + $2 WHERE id = $1 AND stars + $2 >= 0 RETURNING stars',
    [userId, amount],
  );
  if (!rows[0]) {
    const exists = await client.query('SELECT 1 FROM users WHERE id = $1', [userId]);
    if (!exists.rowCount) throw new HttpError(404, 'Usuario no encontrado');
    throw bad('No tienes suficientes estrellitas ⭐');
  }
  await client.query(
    `INSERT INTO transactions (user_id, amount, balance_after, kind, description, game)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, amount, rows[0].stars, kind, description, game],
  );
  return rows[0].stars;
}

export function placeBet(client, userId, game, bet) {
  return moveStars(client, userId, -bet, 'bet', `Apuesta en ${GAME_LABELS[game]}`, game);
}

/** Paga el premio (si hay) y guarda el resultado de la partida. */
export async function settle(client, { userId, game, bet, payout, summary, details = {}, outcome: forcedOutcome }) {
  let stars;
  if (payout > 0) {
    const isRefund = payout === bet;
    stars = await moveStars(
      client,
      userId,
      payout,
      isRefund ? 'refund' : 'win',
      `${isRefund ? 'Devolución' : 'Premio'} en ${GAME_LABELS[game]}`,
      game,
    );
  } else {
    stars = (await client.query('SELECT stars FROM users WHERE id = $1', [userId])).rows[0].stars;
  }
  // En partidas amistosas (sin apuesta) el resultado no se puede deducir del pago
  const outcome = forcedOutcome ?? (payout > bet ? 'win' : payout === bet ? 'push' : 'lose');
  await client.query(
    `INSERT INTO game_results (user_id, game, bet, payout, outcome, summary, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, game, bet, payout, outcome, summary, details],
  );
  return { stars, outcome };
}

// ---- Partidas con estado ----

export async function getActiveSession(client, userId, game, { forUpdate = false } = {}) {
  const { rows } = await client.query(
    `SELECT * FROM game_sessions WHERE user_id = $1 AND game = $2 AND status = 'active'
     ${forUpdate ? 'FOR UPDATE' : ''}`,
    [userId, game],
  );
  return rows[0] || null;
}

export async function createSession(client, userId, game, bet, state) {
  try {
    const { rows } = await client.query(
      'INSERT INTO game_sessions (user_id, game, bet, state) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, game, bet, state],
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'Ya tienes una partida en curso');
    throw err;
  }
}

export async function saveSession(client, session, { status = session.status, bet = session.bet } = {}) {
  const { rows } = await client.query(
    `UPDATE game_sessions SET state = $2, status = $3, bet = $4, updated_at = now() WHERE id = $1 RETURNING *`,
    [session.id, session.state, status, bet],
  );
  return rows[0];
}
