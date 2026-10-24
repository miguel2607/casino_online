import { randomInt } from '../../games/common.js';
import { arena, presses, stick } from './arena.js';

// Bomberman de michis: bolas de pelo explosivas en un laberinto. Gana quien se lleve 2 rondas.
export const BOMBER = { cols: 13, rows: 11, fuse: 2.2, flame: 0.55, speed: 4.2, speedUp: 0.9, target: 2, roundSec: 120 };
const ROUND_PAUSE_MS = 2200;
const SPAWNS = [
  [1, 1],
  [BOMBER.cols - 2, BOMBER.rows - 2],
];
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const key = (x, y) => y * BOMBER.cols + x;
const isPillar = (x, y) => x === 0 || y === 0 || x === BOMBER.cols - 1 || y === BOMBER.rows - 1 || (x % 2 === 0 && y % 2 === 0);

function newGrid() {
  // 0 libre · 1 pilar · 2 caja
  const grid = [];
  for (let y = 0; y < BOMBER.rows; y++) {
    for (let x = 0; x < BOMBER.cols; x++) {
      if (isPillar(x, y)) grid.push(1);
      else {
        const nearSpawn = SPAWNS.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) <= 2);
        grid.push(!nearSpawn && randomInt(100) < 62 ? 2 : 0);
      }
    }
  }
  return grid;
}

function resetRound(s, now) {
  s.grid = newGrid();
  s.bombs = [];
  s.flames = [];
  s.items = {};
  s.players = SPAWNS.map(([x, y], i) => ({
    x,
    y,
    tx: x,
    ty: y,
    bombs: 1,
    range: 2,
    speed: BOMBER.speed,
    alive: true,
    sx: 0,
    sy: 0,
    taps: s.players?.[i]?.taps ?? 0,
    wantBomb: false,
    facing: i === 0 ? [1, 0] : [-1, 0],
  }));
  s.roundStart = now + ROUND_PAUSE_MS;
  s.dirty = true;
}

const bombAt = (s, x, y) => s.bombs.find((b) => b.x === x && b.y === y);

function walkable(s, x, y, p) {
  if (x < 0 || y < 0 || x >= BOMBER.cols || y >= BOMBER.rows) return false;
  if (s.grid[key(x, y)] !== 0) return false;
  const b = bombAt(s, x, y);
  // Se puede salir de la bomba que uno acaba de poner, pero no volver a pisar otra
  return !b || (Math.round(p.x) === x && Math.round(p.y) === y);
}

function explode(s, bomb, now) {
  bomb.done = true;
  const cells = [[bomb.x, bomb.y]];
  for (const [dx, dy] of DIRS) {
    for (let r = 1; r <= bomb.range; r++) {
      const x = bomb.x + dx * r;
      const y = bomb.y + dy * r;
      const cell = s.grid[key(x, y)];
      if (cell === 1) break;
      cells.push([x, y]);
      if (cell === 2) {
        s.grid[key(x, y)] = 0;
        const roll = randomInt(100);
        if (roll < 34) s.items[key(x, y)] = roll < 12 ? 'bomb' : roll < 24 ? 'range' : 'speed';
        break;
      }
      if (s.items[key(x, y)]) delete s.items[key(x, y)];
    }
  }
  const owner = s.players[bomb.owner];
  if (owner) owner.active = Math.max(0, (owner.active || 1) - 1);
  for (const [x, y] of cells) {
    s.flames.push({ x, y, until: now + BOMBER.flame * 1000 });
    const chained = bombAt(s, x, y);
    if (chained && !chained.done) chained.at = Math.min(chained.at, now + 60);
  }
}

export default arena({
  init: () => {
    const s = { scores: [0, 0], round: 1, lastRound: null };
    resetRound(s, Date.now() + 4000 - ROUND_PAUSE_MS);
    return s;
  },

  input(s, idx, data) {
    const p = s.players[idx];
    const { x, y } = stick(data);
    p.sx = x;
    p.sy = y;
    const [n, taps] = presses(p.taps, data.bomb);
    p.taps = n;
    if (taps) p.wantBomb = true;
  },

  step(s, dt, now) {
    if (now < s.roundStart) return;

    for (const p of s.players) {
      if (!p.alive) continue;
      // Movimiento por casillas: al llegar al centro de una, se elige la siguiente según el joystick
      const atTarget = Math.abs(p.x - p.tx) < 1e-6 && Math.abs(p.y - p.ty) < 1e-6;
      if (atTarget && Math.hypot(p.sx, p.sy) > 0.35) {
        const horizontal = Math.abs(p.sx) >= Math.abs(p.sy);
        const tries = horizontal
          ? [[Math.sign(p.sx), 0], [0, Math.sign(p.sy)]]
          : [[0, Math.sign(p.sy)], [Math.sign(p.sx), 0]];
        for (const [dx, dy] of tries) {
          if (!dx && !dy) continue;
          if (walkable(s, p.tx + dx, p.ty + dy, p)) {
            p.tx += dx;
            p.ty += dy;
            p.facing = [dx, dy];
            break;
          }
        }
      }
      const step = p.speed * dt;
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d <= step) {
        p.x = p.tx;
        p.y = p.ty;
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }

      const cx = Math.round(p.x);
      const cy = Math.round(p.y);
      const item = s.items[key(cx, cy)];
      if (item) {
        if (item === 'bomb') p.bombs = Math.min(5, p.bombs + 1);
        else if (item === 'range') p.range = Math.min(6, p.range + 1);
        else p.speed = Math.min(BOMBER.speed + BOMBER.speedUp * 3, p.speed + BOMBER.speedUp);
        delete s.items[key(cx, cy)];
      }
      if (p.wantBomb && (p.active || 0) < p.bombs && !bombAt(s, cx, cy)) {
        s.bombs.push({ x: cx, y: cy, at: now + BOMBER.fuse * 1000, range: p.range, owner: s.players.indexOf(p) });
        p.active = (p.active || 0) + 1;
      }
      p.wantBomb = false;
    }

    // Explosiones (en cadena: una llama adelanta las bombas que toca)
    let again = true;
    while (again) {
      again = false;
      for (const b of s.bombs) {
        if (!b.done && b.at <= now) {
          explode(s, b, now);
          again = true;
        }
      }
    }
    s.bombs = s.bombs.filter((b) => !b.done);
    s.flames = s.flames.filter((f) => f.until > now);

    for (const p of s.players) {
      if (!p.alive) continue;
      const cx = Math.round(p.x);
      const cy = Math.round(p.y);
      if (s.flames.some((f) => f.x === cx && f.y === cy)) p.alive = false;
    }

    const alive = s.players.map((p) => p.alive);
    const overtime = (now - s.roundStart) / 1000 > BOMBER.roundSec;
    if (!alive[0] || !alive[1] || overtime) {
      const winner = alive[0] && !alive[1] ? 0 : alive[1] && !alive[0] ? 1 : null;
      if (winner !== null) s.scores[winner] += 1;
      s.lastRound = { winner, round: s.round };
      if (winner !== null && s.scores[winner] >= BOMBER.target) {
        s.finished = { winner };
        return;
      }
      s.round += 1;
      resetRound(s, now);
    }
  },

  timeout: (s) => ({ winner: s.scores[0] === s.scores[1] ? null : s.scores[0] > s.scores[1] ? 0 : 1 }),
  maxMs: 7 * 60 * 1000,

  snapshot: (s) => ({
    p: s.players.map((p) => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, p.alive ? 1 : 0, p.bombs, p.range, Math.round(p.speed * 10) / 10]),
    b: s.bombs.map((b) => [b.x, b.y, Math.max(0, Math.round((b.at - Date.now()) / 100) / 10)]),
    f: s.flames.map((f) => [f.x, f.y]),
    g: s.grid.join(''),
    it: s.items,
    sc: s.scores,
    rd: s.round,
    wait: Date.now() < s.roundStart,
    tl: Math.max(0, Math.round(BOMBER.roundSec - (Date.now() - s.roundStart) / 1000)),
    last: s.lastRound,
  }),

  view: () => ({ bomber: BOMBER }),

  detail: (s, idx) => `${s.scores[idx]} a ${s.scores[1 - idx]} en rondas`,
});
