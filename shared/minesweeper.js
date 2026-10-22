// Buscaminas de Michis: hay que destapar todas las cajas sin pepino 🥒.
import { mulberry32, shuffleWith } from './rng.js';

export const MINE_LEVELS = {
  easy: { label: 'Fácil', rows: 8, cols: 8, mines: 10, multiplier: 1.5 },
  medium: { label: 'Medio', rows: 10, cols: 10, mines: 16, multiplier: 2.5 },
  hard: { label: 'Difícil', rows: 14, cols: 10, mines: 28, multiplier: 5 },
};

export function neighbors(cfg, i) {
  const r = Math.floor(i / cfg.cols);
  const c = i % cfg.cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < cfg.rows && cc >= 0 && cc < cfg.cols) out.push(rr * cfg.cols + cc);
    }
  }
  return out;
}

/** Las minas se colocan tras el primer toque, nunca en esa casilla ni a su alrededor. */
function placeMines(seed, cfg, safe) {
  const forbidden = new Set([safe, ...neighbors(cfg, safe)]);
  const cells = [];
  for (let i = 0; i < cfg.rows * cfg.cols; i++) if (!forbidden.has(i)) cells.push(i);
  return new Set(shuffleWith(mulberry32(seed), cells).slice(0, cfg.mines));
}

export function newBoard(level) {
  const cfg = MINE_LEVELS[level];
  const n = cfg.rows * cfg.cols;
  return { level, cfg, mines: null, counts: null, revealed: Array(n).fill(false), flagged: Array(n).fill(false), lost: false, won: false, exploded: null };
}

function reveal(seed, b, i) {
  if (b.lost || b.won || b.revealed[i] || b.flagged[i]) return false;
  if (!b.mines) {
    b.mines = placeMines(seed, b.cfg, i);
    b.counts = b.revealed.map((_, k) => neighbors(b.cfg, k).filter((x) => b.mines.has(x)).length);
  }
  if (b.mines.has(i)) {
    b.lost = true;
    b.exploded = i;
    return true;
  }
  // Destapa en cascada las zonas sin pepinos alrededor
  const stack = [i];
  while (stack.length) {
    const k = stack.pop();
    if (b.revealed[k]) continue;
    b.revealed[k] = true;
    b.flagged[k] = false;
    if (b.counts[k] === 0) for (const nb of neighbors(b.cfg, k)) if (!b.revealed[nb] && !b.mines.has(nb)) stack.push(nb);
  }
  const safeCells = b.revealed.length - b.cfg.mines;
  if (b.revealed.filter(Boolean).length === safeCells) b.won = true;
  return true;
}

/**
 * Acciones: { t: 'r', i } destapar, { t: 'c', i } destapar alrededor de un número con sus banderas,
 * { t: 'f', i } poner/quitar bandera. Devuelve true si la acción hizo algo.
 */
export function apply(seed, b, action) {
  const i = Number(action?.i);
  if (!Number.isInteger(i) || i < 0 || i >= b.revealed.length) return false;
  if (action.t === 'f') {
    if (b.revealed[i] || b.lost || b.won) return false;
    b.flagged[i] = !b.flagged[i];
    return true;
  }
  if (action.t === 'r') return reveal(seed, b, i);
  if (action.t === 'c') {
    if (!b.revealed[i] || !b.counts) return false;
    const nbs = neighbors(b.cfg, i);
    if (nbs.filter((x) => b.flagged[x]).length !== b.counts[i]) return false;
    let any = false;
    for (const nb of nbs) if (!b.revealed[nb] && !b.flagged[nb]) any = reveal(seed, b, nb) || any;
    return any;
  }
  return false;
}

export function replay(seed, level, actions) {
  if (!MINE_LEVELS[level] || !Array.isArray(actions) || actions.length > 5000) return null;
  const b = newBoard(level);
  for (const a of actions) {
    if (b.lost || b.won) return null;
    if (!apply(seed, b, a)) return null;
  }
  return b;
}
