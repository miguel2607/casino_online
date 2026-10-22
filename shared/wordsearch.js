// Generador de sopas de letras.
import { mulberry32, randInt, shuffleWith } from './rng.js';

const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
];
const FILL = 'ABCDEFGHIJLMNOPRSTUVZ';

export function generate(seed, words, size = 10, count = 8) {
  const rnd = mulberry32(seed);
  const grid = Array(size * size).fill('');
  const placed = [];
  for (const word of shuffleWith(rnd, [...words])) {
    if (placed.length >= count) break;
    const letters = [...word];
    if (letters.length > size) continue;
    for (let attempt = 0; attempt < 200; attempt++) {
      const [dr, dc] = DIRS[randInt(rnd, DIRS.length)];
      const r0 = randInt(rnd, size);
      const c0 = randInt(rnd, size);
      const r1 = r0 + dr * (letters.length - 1);
      const c1 = c0 + dc * (letters.length - 1);
      if (r1 < 0 || r1 >= size || c1 < 0 || c1 >= size) continue;
      const cells = letters.map((_, k) => (r0 + dr * k) * size + (c0 + dc * k));
      if (cells.some((cell, k) => grid[cell] && grid[cell] !== letters[k])) continue;
      cells.forEach((cell, k) => (grid[cell] = letters[k]));
      placed.push({ word, cells });
      break;
    }
  }
  for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = FILL[randInt(rnd, FILL.length)];
  return { size, grid, words: placed };
}

/** Celdas en línea recta entre dos casillas (horizontal, vertical o diagonal), o null. */
export function lineCells(size, a, b) {
  const r0 = Math.floor(a / size);
  const c0 = a % size;
  const r1 = Math.floor(b / size);
  const c1 = b % size;
  const dr = Math.sign(r1 - r0);
  const dc = Math.sign(c1 - c0);
  const len = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)) + 1;
  if (r0 !== r1 && c0 !== c1 && Math.abs(r1 - r0) !== Math.abs(c1 - c0)) return null;
  return Array.from({ length: len }, (_, k) => (r0 + dr * k) * size + (c0 + dc * k));
}

/** Busca qué palabra coincide con la selección (en cualquiera de los dos sentidos). */
export function matchSelection(placedWords, cells) {
  if (!cells) return -1;
  const key = cells.join(',');
  const rev = [...cells].reverse().join(',');
  return placedWords.findIndex((w) => {
    const k = w.cells.join(',');
    return k === key || k === rev;
  });
}
