import { bad } from '../../errors.js';
import { randomInt } from '../../games/common.js';
import { WORDSEARCH_THEMES } from '../../../../shared/words.js';
import { generate, lineCells, matchSelection } from '../../../../shared/wordsearch.js';
import { coop, newSeed, tier } from './util.js';

const SIZE = 10;
const WORDS = 8;
const DURATION_MS = 180000;

const found = (s) => s.found.filter((f) => f !== null).length;
const multiplier = (s) => tier(found(s), [
  [WORDS, 2],
  [6, 1],
]);

// Sopa de letras en equipo: los dos buscan en la misma sopa contra el reloj
export default {
  ...coop(multiplier),

  create() {
    const keys = Object.keys(WORDSEARCH_THEMES);
    const theme = keys[randomInt(keys.length)];
    const puzzle = generate(newSeed(), WORDSEARCH_THEMES[theme].words, SIZE, WORDS);
    return { theme, ...puzzle, found: puzzle.words.map(() => null), deadline: Date.now() + DURATION_MS + 3000 };
  },

  resume(s, ctx) {
    if (s.finished) return;
    const end = (st) => {
      st.finished = { winner: null, coop: true, success: multiplier(st) > 1 };
    };
    if (Date.now() >= s.deadline) end(s);
    else ctx.schedule(s.deadline - Date.now(), end);
  },

  act(s, idx, action) {
    if (action?.type !== 'select') throw bad('Jugada inválida');
    if (Date.now() > s.deadline) throw bad('Se acabó el tiempo');
    const a = Number(action.from);
    const b = Number(action.to);
    if (![a, b].every((n) => Number.isInteger(n) && n >= 0 && n < SIZE * SIZE)) throw bad('Selección inválida');
    const k = matchSelection(s.words, lineCells(SIZE, a, b));
    if (k === -1) throw bad('Esa no es una de las palabras 🙈');
    if (s.found[k] !== null) throw bad('Esa palabra ya la encontraron');
    s.found[k] = idx;
    if (found(s) === s.words.length) s.finished = { winner: null, coop: true, success: true };
  },

  view: (s) => ({
    theme: WORDSEARCH_THEMES[s.theme].label,
    size: s.size,
    grid: s.grid,
    words: s.words.map((w, k) => ({ word: w.word, foundBy: s.found[k], cells: s.found[k] !== null ? w.cells : null })),
    deadline: s.deadline,
    serverNow: Date.now(),
  }),

  detail: (s) => `Encontraron ${found(s)} de ${s.words.length} palabras`,
};
