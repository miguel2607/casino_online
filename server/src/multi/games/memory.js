import { bad } from '../../errors.js';
import { randomInt, shuffle } from '../../games/common.js';

const PAIRS = 8;
const FLIP_BACK_MS = 1300;

function hideMismatch(s) {
  s.revealed = [];
  s.pending = false;
  s.turn = 1 - s.turn;
}

// Memoria por turnos: si aciertas una pareja sigues jugando
export default {
  create: () => ({
    cards: shuffle([...Array(PAIRS).keys(), ...Array(PAIRS).keys()]),
    revealed: [],
    matched: Array(PAIRS * 2).fill(null),
    scores: [0, 0],
    turn: randomInt(2),
    pending: false,
  }),

  act(s, idx, action, ctx) {
    if (action?.type !== 'flip') throw bad('Jugada inválida');
    if (s.pending) throw bad('Espera un momento…');
    if (s.turn !== idx) throw bad('Es el turno de tu pareja');
    const i = Number(action.index);
    if (!Number.isInteger(i) || i < 0 || i >= s.cards.length) throw bad('Carta inválida');
    if (s.matched[i] !== null || s.revealed.includes(i)) throw bad('Esa carta ya está volteada');

    s.revealed.push(i);
    if (s.revealed.length < 2) return;

    const [a, b] = s.revealed;
    if (s.cards[a] === s.cards[b]) {
      s.matched[a] = idx;
      s.matched[b] = idx;
      s.scores[idx] += 1;
      s.revealed = [];
      if (s.matched.every((m) => m !== null)) {
        const [x, y] = s.scores;
        s.finished = { winner: x === y ? null : x > y ? 0 : 1 };
      }
    } else {
      s.pending = true;
      ctx.schedule(FLIP_BACK_MS, hideMismatch);
    }
  },

  // Si el servidor se reinició con dos cartas destapadas, las tapamos
  resume(s) {
    if (s.pending) hideMismatch(s);
  },

  view: (s) => ({
    cards: s.cards.map((face, i) => ({
      face: s.revealed.includes(i) || s.matched[i] !== null ? face : null,
      by: s.matched[i],
    })),
    scores: s.scores,
    turn: s.turn,
    pending: s.pending,
  }),

  detail: (s, idx) => `${s.scores[idx]} parejas contra ${s.scores[1 - idx]}`,
};
