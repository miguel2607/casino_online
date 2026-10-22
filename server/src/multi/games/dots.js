import { bad } from '../../errors.js';
import { randomInt } from '../../games/common.js';

const N = 4; // cajas por lado (5×5 puntos)

function boxComplete(lines, r, c) {
  return [`h-${r}-${c}`, `h-${r + 1}-${c}`, `v-${r}-${c}`, `v-${r}-${c + 1}`].every((id) => lines[id] !== undefined);
}

function adjacentBoxes(id) {
  const [kind, r, c] = [id[0], ...id.slice(2).split('-').map(Number)];
  const out = kind === 'h' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
  return out.filter(([rr, cc]) => rr >= 0 && cc >= 0 && rr < N && cc < N);
}

function validLine(id) {
  const m = /^([hv])-(\d+)-(\d+)$/.exec(String(id));
  if (!m) return false;
  const r = Number(m[2]);
  const c = Number(m[3]);
  return m[1] === 'h' ? r <= N && c < N : r < N && c <= N;
}

// Puntos y cajas: quien cierra una caja la gana y vuelve a jugar
export default {
  create: () => ({ size: N, lines: {}, boxes: Array(N * N).fill(null), scores: [0, 0], turn: randomInt(2), last: null }),

  act(s, idx, action) {
    if (action?.type !== 'line') throw bad('Jugada inválida');
    if (s.turn !== idx) throw bad('Es el turno de tu pareja');
    const id = String(action.id);
    if (!validLine(id)) throw bad('Línea inválida');
    if (s.lines[id] !== undefined) throw bad('Esa línea ya está marcada');
    s.lines[id] = idx;
    s.last = id;
    let closed = 0;
    for (const [r, c] of adjacentBoxes(id)) {
      if (s.boxes[r * N + c] === null && boxComplete(s.lines, r, c)) {
        s.boxes[r * N + c] = idx;
        s.scores[idx] += 1;
        closed += 1;
      }
    }
    if (s.boxes.every((b) => b !== null)) {
      const [a, b] = s.scores;
      s.finished = { winner: a === b ? null : a > b ? 0 : 1 };
    } else if (!closed) s.turn = 1 - idx;
  },

  view: (s) => ({ size: s.size, lines: s.lines, boxes: s.boxes, scores: s.scores, turn: s.turn, last: s.last }),

  detail: (s, idx) => `${s.scores[idx]} cajas contra ${s.scores[1 - idx]}`,
};
