// Sudoku de Michis: genera tableros con solución única en 4×4, 6×6 y 9×9.
import { mulberry32, shuffleWith } from './rng.js';

export const SUDOKU_SIZES = {
  4: { label: 'Fácil · 4×4', boxRows: 2, boxCols: 2, clues: 7, multiplier: 1.3 },
  6: { label: 'Medio · 6×6', boxRows: 2, boxCols: 3, clues: 16, multiplier: 2 },
  9: { label: 'Difícil · 9×9', boxRows: 3, boxCols: 3, clues: 32, multiplier: 4 },
};

function candidatesOk(grid, size, cfg, i, v) {
  const r = Math.floor(i / size);
  const c = i % size;
  for (let k = 0; k < size; k++) {
    if (grid[r * size + k] === v || grid[k * size + c] === v) return false;
  }
  const br = r - (r % cfg.boxRows);
  const bc = c - (c % cfg.boxCols);
  for (let rr = br; rr < br + cfg.boxRows; rr++) {
    for (let cc = bc; cc < bc + cfg.boxCols; cc++) if (grid[rr * size + cc] === v) return false;
  }
  return true;
}

/** Cuenta soluciones (se detiene al llegar a `limit`). */
function countSolutions(grid, size, cfg, limit = 2) {
  const i = grid.indexOf(0);
  if (i === -1) return 1;
  let count = 0;
  for (let v = 1; v <= size && count < limit; v++) {
    if (candidatesOk(grid, size, cfg, i, v)) {
      grid[i] = v;
      count += countSolutions(grid, size, cfg, limit - count);
      grid[i] = 0;
    }
  }
  return count;
}

function fill(grid, size, cfg, rnd) {
  const i = grid.indexOf(0);
  if (i === -1) return true;
  for (const v of shuffleWith(rnd, Array.from({ length: size }, (_, k) => k + 1))) {
    if (candidatesOk(grid, size, cfg, i, v)) {
      grid[i] = v;
      if (fill(grid, size, cfg, rnd)) return true;
      grid[i] = 0;
    }
  }
  return false;
}

export function generate(seed, size) {
  const cfg = SUDOKU_SIZES[size];
  const rnd = mulberry32(seed);
  const solution = Array(size * size).fill(0);
  fill(solution, size, cfg, rnd);
  const puzzle = [...solution];
  let clues = size * size;
  for (const i of shuffleWith(rnd, [...puzzle.keys()])) {
    if (clues <= cfg.clues) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions([...puzzle], size, cfg) !== 1) puzzle[i] = keep;
    else clues -= 1;
  }
  return { puzzle, solution };
}

/** Un tablero completo es válido si respeta las pistas y las reglas del sudoku. */
export function isSolved(puzzle, grid, size) {
  const cfg = SUDOKU_SIZES[size];
  if (!cfg || !Array.isArray(grid) || grid.length !== size * size) return false;
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (!Number.isInteger(v) || v < 1 || v > size) return false;
    if (puzzle[i] && puzzle[i] !== v) return false;
  }
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    const copy = [...grid];
    copy[i] = 0;
    if (!candidatesOk(copy, size, cfg, i, v)) return false;
  }
  return true;
}

/** Casillas que chocan con otra (para marcarlas en rojo mientras se juega). */
export function conflicts(grid, size) {
  const cfg = SUDOKU_SIZES[size];
  const bad = new Set();
  grid.forEach((v, i) => {
    if (!v) return;
    const copy = [...grid];
    copy[i] = 0;
    if (!candidatesOk(copy, size, cfg, i, v)) bad.add(i);
  });
  return bad;
}
