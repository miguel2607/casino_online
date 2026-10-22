import { bad } from '../../errors.js';
import { shuffle } from '../../games/common.js';
import { coop, scheduleAt, tier } from './util.js';

const PAIRS = 10;
const DURATION_MS = 100000;
const FLIP_BACK_MS = 900;

const pairsFound = (s) => s.matched.filter((m) => m !== null).length / 2;
const multiplier = (s) => tier(pairsFound(s), [
  [PAIRS, 2],
  [8, 1],
]);

// Memoria contra el reloj: los dos voltean cartas a la vez en el mismo tablero
export default {
  ...coop(multiplier),

  create: () => ({
    cards: shuffle([...Array(PAIRS).keys(), ...Array(PAIRS).keys()]),
    revealed: [[], []],
    pending: [false, false],
    matched: Array(PAIRS * 2).fill(null),
    deadline: Date.now() + DURATION_MS + 3000,
    timer: 0,
  }),

  resume(s, ctx) {
    if (s.finished) return;
    s.revealed = s.revealed.map((r, i) => (s.pending[i] ? [] : r));
    s.pending = [false, false];
    const end = (st) => {
      st.finished = { winner: null, coop: true, success: multiplier(st) > 1 };
    };
    if (Date.now() >= s.deadline) end(s);
    else ctx.schedule(s.deadline - Date.now(), end);
  },

  act(s, idx, action, ctx) {
    if (action?.type !== 'flip') throw bad('Jugada inválida');
    if (Date.now() > s.deadline) throw bad('Se acabó el tiempo');
    if (s.pending[idx]) throw bad('Espera un momento…');
    const i = Number(action.index);
    if (!Number.isInteger(i) || i < 0 || i >= s.cards.length) throw bad('Carta inválida');
    if (s.matched[i] !== null || s.revealed.some((r) => r.includes(i))) throw bad('Esa carta ya está volteada');
    const mine = s.revealed[idx];
    mine.push(i);
    if (mine.length < 2) return;
    const [a, b] = mine;
    if (s.cards[a] === s.cards[b]) {
      s.matched[a] = idx;
      s.matched[b] = idx;
      s.revealed[idx] = [];
      if (s.matched.every((m) => m !== null)) s.finished = { winner: null, coop: true, success: true };
    } else {
      s.pending[idx] = true;
      ctx.schedule(FLIP_BACK_MS, (st) => {
        st.revealed[idx] = [];
        st.pending[idx] = false;
      }, { persist: false });
    }
  },

  view: (s) => ({
    cards: s.cards.map((face, i) => {
      const by = s.revealed.findIndex((r) => r.includes(i));
      return { face: by >= 0 || s.matched[i] !== null ? face : null, matchedBy: s.matched[i], revealedBy: by >= 0 ? by : null };
    }),
    pending: s.pending,
    pairs: pairsFound(s),
    total: PAIRS,
    deadline: s.deadline,
    serverNow: Date.now(),
  }),

  detail: (s) => `Encontraron ${pairsFound(s)} de ${PAIRS} parejas`,
};
