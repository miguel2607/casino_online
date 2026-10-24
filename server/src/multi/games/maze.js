import { bad } from '../../errors.js';
import { randomInt, shuffle } from '../../games/common.js';
import { coop } from './util.js';

// Laberinto a ciegas: uno camina viendo solo lo que tiene al lado; el otro ve el mapa completo
// (con los pepinos trampa) y lo guía con señales. Tres laberintos, cambian de rol en cada uno.
export const MAZE = { size: 7, traps: 6, mazes: 3, totalSec: 180 };
const DIRS = { up: [0, -1, 1], right: [1, 0, 2], down: [0, 1, 4], left: [-1, 0, 8] }; // bits de pared: 1 arriba, 2 der, 4 abajo, 8 izq
const OPP = { 1: 4, 2: 8, 4: 1, 8: 2 };
const SIGNALS = ['up', 'right', 'down', 'left', 'stop', 'yes', 'back'];

function generate() {
  const n = MAZE.size;
  const walls = Array(n * n).fill(15);
  const seen = Array(n * n).fill(false);
  const stack = [0];
  seen[0] = true;
  while (stack.length) {
    const c = stack[stack.length - 1];
    const x = c % n;
    const y = Math.floor(c / n);
    const options = shuffle(Object.values(DIRS)).filter(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < n && ny < n && !seen[ny * n + nx];
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [dx, dy, bit] = options[0];
    const next = (y + dy) * n + x + dx;
    walls[c] &= ~bit;
    walls[next] &= ~OPP[bit];
    seen[next] = true;
    stack.push(next);
  }
  // Abre algunas paredes extra para que haya más de un camino (y las trampas tengan sentido)
  for (let i = 0; i < n * 2; i++) {
    const c = randomInt(n * n);
    const [dx, dy, bit] = Object.values(DIRS)[randomInt(4)];
    const x = (c % n) + dx;
    const y = Math.floor(c / n) + dy;
    if (x < 0 || y < 0 || x >= n || y >= n) continue;
    walls[c] &= ~bit;
    walls[y * n + x] &= ~OPP[bit];
  }
  const goal = n * n - 1;
  // Camino más corto (BFS) para no ponerle trampas encima: siempre se puede llegar sin pisarlas
  const prev = Array(n * n).fill(-1);
  const queue = [0];
  prev[0] = 0;
  while (queue.length) {
    const c = queue.shift();
    for (const [dx, dy, bit] of Object.values(DIRS)) {
      if (walls[c] & bit) continue;
      const nc = c + dy * n + dx;
      if (prev[nc] === -1) {
        prev[nc] = c;
        queue.push(nc);
      }
    }
  }
  const path = new Set();
  for (let c = goal; c !== 0; c = prev[c]) path.add(c);
  path.add(0);
  const free = shuffle([...Array(n * n).keys()].filter((c) => !path.has(c)));
  return { walls, goal, traps: free.slice(0, MAZE.traps), pos: 0, trail: [0] };
}

const multiplierOf = (s) => [0, 0.5, 1.5, 2.5][s.solved] ?? 0;

export default {
  ...coop(multiplierOf),

  create: () => {
    const first = randomInt(2);
    return { maze: generate(), walker: first, first, round: 1, solved: 0, trapsHit: 0, signal: null, endAt: Date.now() + 3000 + MAZE.totalSec * 1000, startAt: Date.now() + 3000, flash: null };
  },

  resume(s, ctx) {
    if (s.finished) return;
    ctx.schedule(Math.max(0, s.endAt - Date.now()), (st) => {
      if (!st.finished) st.finished = { winner: null, coop: true, success: multiplierOf(st) > 1 };
    });
  },

  act(s, idx, action) {
    const now = Date.now();
    if (now < s.startAt) throw bad('Esperen la cuenta regresiva');
    if (action?.type === 'signal') {
      if (idx === s.walker) throw bad('Las señales las da quien ve el mapa');
      if (!SIGNALS.includes(action.signal)) throw bad('Señal inválida');
      s.signal = { s: action.signal, at: now, n: (s.signal?.n || 0) + 1 };
      return;
    }
    if (action?.type !== 'move') throw bad('Jugada inválida');
    if (idx !== s.walker) throw bad('Camina tu pareja; tú le das las señales');
    const d = DIRS[action.dir];
    if (!d) throw bad('Dirección inválida');
    const m = s.maze;
    const n = MAZE.size;
    if (m.walls[m.pos] & d[2]) {
      s.flash = { type: 'wall', at: now };
      return;
    }
    m.pos += d[1] * n + d[0];
    m.trail.push(m.pos);
    if (m.traps.includes(m.pos)) {
      // ¡Pepino! Vuelve al inicio
      s.trapsHit += 1;
      s.flash = { type: 'trap', at: now, cell: m.pos };
      m.pos = 0;
      m.trail = [0];
      return;
    }
    if (m.pos === m.goal) {
      s.solved += 1;
      s.flash = { type: 'goal', at: now };
      if (s.round >= MAZE.mazes) {
        s.finished = { winner: null, coop: true, success: multiplierOf(s) > 1 };
        return;
      }
      s.round += 1;
      s.walker = 1 - s.walker;
      s.maze = generate();
      s.signal = null;
    }
  },

  view: (s, idx) => {
    const m = s.maze;
    const n = MAZE.size;
    const walking = idx === s.walker;
    // Quien camina solo ve las paredes de su casilla y las vecinas, sin trampas
    let walls = m.walls;
    if (walking && !s.finished) {
      const near = new Set([m.pos]);
      const x = m.pos % n;
      const y = Math.floor(m.pos / n);
      for (const [dx, dy] of Object.values(DIRS)) if (x + dx >= 0 && y + dy >= 0 && x + dx < n && y + dy < n) near.add((y + dy) * n + x + dx);
      walls = m.walls.map((w, i) => (near.has(i) ? w : null));
    }
    return {
      size: n,
      walking,
      walls,
      traps: walking && !s.finished ? [] : m.traps,
      goal: m.goal,
      pos: m.pos,
      trail: walking ? [] : m.trail,
      round: s.round,
      mazes: MAZE.mazes,
      solved: s.solved,
      trapsHit: s.trapsHit,
      signal: s.signal,
      flash: s.flash,
      startAt: s.startAt,
      endAt: s.endAt,
      serverNow: Date.now(),
    };
  },

  detail: (s) => `${s.solved} de ${MAZE.mazes} laberintos · ${s.trapsHit} pepinos pisados`,
};
