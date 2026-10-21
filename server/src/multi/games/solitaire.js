import { bad } from '../../errors.js';
import { randomInt } from '../../games/common.js';
import { DIFFICULTIES, MAX_MOVES, isWon, replay } from '../../../../shared/solitaire.js';

// Duelo: los dos juegan el mismo reparto y gana quien lo termine primero
export default {
  parseOptions: (o) => ({ difficulty: DIFFICULTIES[o?.difficulty] ? o.difficulty : 'easy' }),

  create: ({ options }) => ({
    seed: randomInt(1, 2 ** 31 - 1),
    difficulty: options.difficulty,
    moves: [[], []],
    progress: [0, 0],
  }),

  act(s, idx, action) {
    if (action?.type !== 'sync') throw bad('Jugada inválida');
    const moves = action.moves;
    if (!Array.isArray(moves) || moves.length > MAX_MOVES) throw bad('Movimientos inválidos');
    if (!DIFFICULTIES[s.difficulty].undo && moves.length < s.moves[idx].length) {
      throw bad('En difícil no se puede deshacer');
    }
    const state = replay(s.seed, s.difficulty, moves);
    if (!state) throw bad('Hay un movimiento inválido, recarga la partida');
    s.moves[idx] = moves;
    s.progress[idx] = state.foundations.reduce((n, p) => n + p.length, 0);
    if (isWon(state)) s.finished = { winner: idx };
  },

  view: (s, idx) => ({
    seed: s.seed,
    difficulty: s.difficulty,
    myMoves: s.moves[idx],
    progress: s.progress,
    moveCounts: [s.moves[0].length, s.moves[1].length],
  }),

  detail: (s, idx) => `${s.progress[idx]}/52 cartas en los cimientos`,
};
