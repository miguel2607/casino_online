import { bad } from '../../errors.js';
import { randomInt } from '../../games/common.js';
import { SIMON_PADS } from '../../../../shared/simon.js';
import { coop, tier } from './util.js';

const MAX_ROUNDS = 20;
const STEP_MS = 650;

const completed = (s) => s.round - 1;
const multiplier = (s) => tier(completed(s), [
  [14, 5],
  [11, 3],
  [8, 2],
  [6, 1],
]);

/** Momento en que termina de mostrarse la secuencia de la ronda (para bloquear toques antes). */
const showUntil = (round) => Date.now() + 1200 + round * STEP_MS;

// Simón en equipo: se turnan; cada uno repite la secuencia completa en su ronda
export default {
  ...coop(multiplier),

  create: () => ({
    seq: Array.from({ length: MAX_ROUNDS }, () => randomInt(SIMON_PADS)),
    round: 1,
    first: randomInt(2),
    pos: 0,
    showUntil: showUntil(1),
  }),

  act(s, idx, action) {
    if (action?.type !== 'press') throw bad('Jugada inválida');
    const active = (s.first + s.round - 1) % 2;
    if (idx !== active) throw bad('Es el turno de tu pareja');
    if (Date.now() < s.showUntil - 300) throw bad('Espera a que termine la secuencia');
    const color = Number(action.color);
    if (color !== s.seq[s.pos]) {
      s.fail = { round: s.round, pos: s.pos, pressed: color, expected: s.seq[s.pos] };
      s.finished = { winner: null, coop: true, success: multiplier(s) > 1 };
      return;
    }
    s.pos += 1;
    if (s.pos < s.round) return;
    if (s.round >= MAX_ROUNDS) {
      s.round += 1;
      s.finished = { winner: null, coop: true, success: true };
      return;
    }
    s.round += 1;
    s.pos = 0;
    s.showUntil = showUntil(s.round);
  },

  view: (s) => ({
    round: s.round,
    active: (s.first + s.round - 1) % 2,
    sequence: s.seq.slice(0, s.round),
    pos: s.pos,
    showUntil: s.showUntil,
    stepMs: STEP_MS,
    serverNow: Date.now(),
    completed: completed(s),
    fail: s.fail ?? null,
  }),

  detail: (s) => `Completaron ${completed(s)} rondas`,
};
