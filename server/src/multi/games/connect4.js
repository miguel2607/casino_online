import { bad } from '../../errors.js';
import { randomInt } from '../../games/common.js';

const ROWS = 6;
const COLS = 7;
const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function findLine(board, r, c, who) {
  for (const [dr, dc] of DIRS) {
    const cells = [[r, c]];
    for (const sign of [1, -1]) {
      let rr = r + dr * sign;
      let cc = c + dc * sign;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === who) {
        cells.push([rr, cc]);
        rr += dr * sign;
        cc += dc * sign;
      }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

export default {
  create: () => ({
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
    turn: randomInt(2),
    last: null,
    line: null,
    moves: 0,
  }),

  act(s, idx, action) {
    if (action?.type !== 'drop') throw bad('Jugada inválida');
    if (s.turn !== idx) throw bad('Es el turno de tu pareja');
    const col = Number(action.col);
    if (!Number.isInteger(col) || col < 0 || col >= COLS) throw bad('Columna inválida');
    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (s.board[r][col] === null) {
        row = r;
        break;
      }
    }
    if (row === -1) throw bad('Esa columna está llena');

    s.board[row][col] = idx;
    s.moves += 1;
    s.last = { r: row, c: col };
    const line = findLine(s.board, row, col, idx);
    if (line) {
      s.line = line;
      s.finished = { winner: idx };
    } else if (s.moves === ROWS * COLS) {
      s.finished = { winner: null };
    } else {
      s.turn = 1 - idx;
    }
  },

  view: (s) => ({ board: s.board, turn: s.turn, last: s.last, line: s.line }),

  detail: (s) => `${s.moves} fichas jugadas`,
};
