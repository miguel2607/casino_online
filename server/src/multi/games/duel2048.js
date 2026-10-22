import { bad } from '../../errors.js';
import * as g2048 from '../../../../shared/g2048.js';
import { newSeed } from './util.js';

const DURATION_MS = 3 * 60 * 1000;

function finish(s) {
  const [a, b] = s.scores;
  s.finished = { winner: a === b ? null : a > b ? 0 : 1 };
}

// Duelo de 2048: el mismo tablero para los dos durante 3 minutos; gana el puntaje más alto
export default {
  create: () => ({ seed: newSeed(), moves: [[], []], scores: [0, 0], maxTiles: [1, 1], over: [false, false], deadline: Date.now() + DURATION_MS + 3000 }),

  resume(s, ctx) {
    if (s.finished) return;
    if (Date.now() >= s.deadline) finish(s);
    else ctx.schedule(s.deadline - Date.now(), finish);
  },

  act(s, idx, action) {
    if (action?.type !== 'sync') throw bad('Jugada inválida');
    if (Date.now() > s.deadline + 2000) throw bad('Se acabó el tiempo');
    if (s.over[idx]) return;
    const game = g2048.replay(s.seed, action.moves);
    if (!game) throw bad('Movimiento inválido');
    s.moves[idx] = action.moves;
    s.scores[idx] = game.score;
    s.maxTiles[idx] = g2048.maxTile(game);
    s.over[idx] = g2048.isOver(game) || Boolean(action.done);
    if (s.over[0] && s.over[1]) finish(s);
  },

  view: (s, idx) => ({
    seed: s.seed,
    myMoves: s.moves[idx],
    scores: s.scores,
    maxTiles: s.maxTiles.map((e) => 2 ** e),
    over: s.over,
    deadline: s.deadline,
    serverNow: Date.now(),
  }),

  detail: (s, idx) => `${s.scores[idx]} puntos contra ${s.scores[1 - idx]}`,
};
