// Motor del 2048 de Michis. Las fichas guardan el exponente: 1 = 2, 2 = 4, … 11 = 2048.
import { mulberry32, randInt } from './rng.js';

export const SIZE = 4;
export const DIRS = ['up', 'down', 'left', 'right'];

function spawn(game) {
  const empty = [];
  game.grid.forEach((v, i) => v === 0 && empty.push(i));
  if (!empty.length) return;
  const i = empty[randInt(game.rnd, empty.length)];
  game.grid[i] = game.rnd() < 0.9 ? 1 : 2;
}

export function newGame(seed) {
  const game = { grid: Array(SIZE * SIZE).fill(0), score: 0, moves: 0, rnd: mulberry32(seed) };
  spawn(game);
  spawn(game);
  return game;
}

/** Índices de cada línea en el orden en que se "empujan" las fichas. */
function lines(dir) {
  const out = [];
  for (let k = 0; k < SIZE; k++) {
    const line = [];
    for (let j = 0; j < SIZE; j++) {
      if (dir === 'left') line.push(k * SIZE + j);
      if (dir === 'right') line.push(k * SIZE + (SIZE - 1 - j));
      if (dir === 'up') line.push(j * SIZE + k);
      if (dir === 'down') line.push((SIZE - 1 - j) * SIZE + k);
    }
    out.push(line);
  }
  return out;
}

/** Aplica un movimiento. Devuelve false si no cambia nada (movimiento inválido). */
export function move(game, dir) {
  if (!DIRS.includes(dir)) return false;
  let changed = false;
  for (const line of lines(dir)) {
    const vals = line.map((i) => game.grid[i]).filter(Boolean);
    const merged = [];
    for (let k = 0; k < vals.length; k++) {
      if (vals[k] === vals[k + 1]) {
        merged.push(vals[k] + 1);
        game.score += 2 ** (vals[k] + 1);
        k++;
      } else merged.push(vals[k]);
    }
    line.forEach((idx, k) => {
      const v = merged[k] || 0;
      if (game.grid[idx] !== v) changed = true;
      game.grid[idx] = v;
    });
  }
  if (changed) {
    game.moves += 1;
    spawn(game);
  }
  return changed;
}

export function isOver(game) {
  if (game.grid.includes(0)) return false;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = game.grid[r * SIZE + c];
      if (c < SIZE - 1 && v === game.grid[r * SIZE + c + 1]) return false;
      if (r < SIZE - 1 && v === game.grid[(r + 1) * SIZE + c]) return false;
    }
  }
  return true;
}

export const maxTile = (game) => Math.max(...game.grid);

/** Reproduce una partida completa. Devuelve null si algún movimiento es inválido. */
export function replay(seed, moves) {
  if (!Array.isArray(moves) || moves.length > 20000) return null;
  const game = newGame(seed);
  for (const m of moves) if (!move(game, m)) return null;
  return game;
}
