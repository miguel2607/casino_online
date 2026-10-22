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

const winnerOf = (cells) => {
  for (const [a, b, c] of LINES) if (cells[a] !== null && cells[a] !== 'draw' && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
  return null;
};

// Tres en raya gigante: tu jugada decide en qué tablero juega tu pareja
export default {
  create: () => ({ cells: Array(81).fill(null), small: Array(9).fill(null), next: null, turn: randomInt(2), last: null, line: null }),

  act(s, idx, action) {
    if (action?.type !== 'play') throw bad('Jugada inválida');
    if (s.turn !== idx) throw bad('Es el turno de tu pareja');
    const b = Number(action.board);
    const i = Number(action.cell);
    if (![b, i].every((n) => Number.isInteger(n) && n >= 0 && n < 9)) throw bad('Casilla inválida');
    if (s.small[b] !== null) throw bad('Ese tablero ya está decidido');
    if (s.next !== null && s.next !== b) throw bad('Debes jugar en el tablero resaltado');
    if (s.cells[b * 9 + i] !== null) throw bad('Esa casilla está ocupada');

    s.cells[b * 9 + i] = idx;
    s.last = { board: b, cell: i };
    const local = s.cells.slice(b * 9, b * 9 + 9);
    const w = winnerOf(local);
    if (w !== null) s.small[b] = w;
    else if (local.every((v) => v !== null)) s.small[b] = 'draw';

    const big = winnerOf(s.small);
    if (big !== null) {
      s.line = LINES.find(([x, y, z]) => s.small[x] === big && s.small[y] === big && s.small[z] === big);
      s.finished = { winner: big };
      return;
    }
    if (s.small.every((v) => v !== null)) {
      const count = [0, 1].map((p) => s.small.filter((v) => v === p).length);
      s.finished = { winner: count[0] === count[1] ? null : count[0] > count[1] ? 0 : 1 };
      return;
    }
    s.next = s.small[i] === null ? i : null;
    s.turn = 1 - idx;
  },

  view: (s) => ({ cells: s.cells, small: s.small, next: s.next, turn: s.turn, last: s.last, line: s.line }),

  detail: (s, idx) => `${s.small.filter((v) => v === idx).length} tableros ganados`,
};
