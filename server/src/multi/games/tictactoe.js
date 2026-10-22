import { bad } from '../../errors.js';
import { randomInt } from '../../games/common.js';

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

// Tres en raya clásico: 3×3, gana quien ponga tres michis en línea
export default {
  create: () => ({ cells: Array(9).fill(null), turn: randomInt(2), last: null, line: null }),

  act(s, idx, action) {
    if (action?.type !== 'play') throw bad('Jugada inválida');
    if (s.turn !== idx) throw bad('Es el turno de tu pareja');
    const i = Number(action.cell);
    if (!Number.isInteger(i) || i < 0 || i > 8) throw bad('Casilla inválida');
    if (s.cells[i] !== null) throw bad('Esa casilla está ocupada');

    s.cells[i] = idx;
    s.last = i;
    const line = LINES.find((l) => l.every((k) => s.cells[k] === idx));
    if (line) {
      s.line = line;
      s.finished = { winner: idx };
    } else if (s.cells.every((c) => c !== null)) {
      s.finished = { winner: null };
    } else {
      s.turn = 1 - idx;
    }
  },

  view: (s) => ({ cells: s.cells, turn: s.turn, last: s.last, line: s.line }),

  detail: (s) => `${s.cells.filter((c) => c !== null).length} jugadas`,
};
