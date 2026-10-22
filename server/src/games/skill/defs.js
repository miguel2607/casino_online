import { bad } from '../../errors.js';
import { randomInt } from '../common.js';
import * as g2048 from '../../../../shared/g2048.js';
import { MINE_LEVELS, replay as replayMines } from '../../../../shared/minesweeper.js';
import { SUDOKU_SIZES, generate as generateSudoku, isSolved } from '../../../../shared/sudoku.js';
import { levelReached } from '../../../../shared/simon.js';
import { WORDLE_WORDS } from '../../../../shared/words.js';
import { normalizeWord } from '../../../../shared/rng.js';

/** Multiplicador según tablas de [umbral, multiplicador] ordenadas de mayor a menor. */
const tier = (value, table, higherIsBetter = true) => {
  for (const [limit, mult] of table) if (higherIsBetter ? value >= limit : value <= limit) return mult;
  return 0;
};

const newSeed = () => randomInt(1, 2 ** 31 - 1);
const elapsedSec = (state) => (Date.now() - state.startedAt) / 1000;

// ---------------- Lógica (el servidor reproduce la partida) ----------------

const game2048 = {
  label: '2048 de Michis',
  // El premio depende de la ficha más alta (exponente: 7 = 128, 8 = 256, …), no de los puntos
  table: [
    [11, 15],
    [10, 6],
    [9, 3],
    [8, 1.5],
    [7, 1],
  ],
  start: () => ({ seed: newSeed(), moves: [] }),
  view: (s) => ({ seed: s.seed, moves: s.moves }),
  sync(s, { moves }) {
    if (!g2048.replay(s.seed, moves)) throw bad('Movimiento inválido, recarga la partida');
    s.moves = moves;
  },
  finish(s, { moves }) {
    const game = g2048.replay(s.seed, moves);
    if (!game) throw bad('Movimiento inválido, recarga la partida');
    const top = g2048.maxTile(game);
    return {
      multiplier: tier(top, this.table),
      summary: `Ficha más alta: ${2 ** top}${top < 7 ? ' (el premio empieza al formar la ficha 128)' : ''} · ${game.score} puntos`,
      details: { score: game.score, maxTile: 2 ** top, moves: moves.length },
    };
  },
};

const mines = {
  label: 'Buscaminas de Michis',
  parseOptions: (o) => ({ level: MINE_LEVELS[o?.level] ? o.level : 'easy' }),
  start: ({ options }) => ({ seed: newSeed(), level: options.level, actions: [] }),
  view: (s) => ({ seed: s.seed, level: s.level, actions: s.actions }),
  sync(s, { actions }) {
    if (!replayMines(s.seed, s.level, actions)) throw bad('Jugada inválida, recarga la partida');
    s.actions = actions;
  },
  finish(s, { actions }) {
    const board = replayMines(s.seed, s.level, actions);
    if (!board || (!board.won && !board.lost)) throw bad('La partida no ha terminado');
    const cfg = MINE_LEVELS[s.level];
    return {
      multiplier: board.won ? cfg.multiplier : 0,
      summary: board.won ? `Despejaste el tablero ${cfg.label}` : `Encontraste un pepino 🥒 en ${cfg.label}`,
      details: { level: s.level, won: board.won },
    };
  },
};

const sudoku = {
  label: 'Sudoku de Michis',
  parseOptions: (o) => ({ size: SUDOKU_SIZES[o?.size] ? Number(o.size) : 4 }),
  start({ options }) {
    const { puzzle } = generateSudoku(newSeed(), options.size);
    return { size: options.size, puzzle, grid: [...puzzle] };
  },
  view: (s) => ({ size: s.size, puzzle: s.puzzle, grid: s.grid, ...SUDOKU_SIZES[s.size] }),
  sync(s, { grid }) {
    if (!Array.isArray(grid) || grid.length !== s.puzzle.length) throw bad('Tablero inválido');
    s.grid = grid.map((v, i) => (s.puzzle[i] ? s.puzzle[i] : Number(v) || 0));
  },
  finish(s, { grid }) {
    if (!isSolved(s.puzzle, grid, s.size)) throw bad('El sudoku todavía no está bien resuelto');
    const cfg = SUDOKU_SIZES[s.size];
    const secs = Math.round(elapsedSec(s));
    return { multiplier: cfg.multiplier, summary: `Resolviste el ${cfg.label} en ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, details: { size: s.size, secs } };
  },
};

const simon = {
  label: 'Simón Michi',
  table: [
    [15, 8],
    [11, 4],
    [8, 2],
    [5, 1],
  ],
  start: () => ({ seed: newSeed() }),
  view: (s) => ({ seed: s.seed }),
  finish(s, { inputs }) {
    const level = levelReached(s.seed, inputs);
    return { multiplier: tier(level, this.table), summary: `Repetiste ${level} nivel${level === 1 ? '' : 'es'}`, details: { level } };
  },
};

// Wordle: la palabra solo la conoce el servidor
const WORDLE_TRIES = 6;
const wordleTable = { 1: 8, 2: 6, 3: 4, 4: 2.5, 5: 1.6, 6: 1.2 };

export function wordleFeedback(answer, guess) {
  const a = [...answer];
  const g = [...guess];
  const res = Array(5).fill('absent');
  const left = {};
  a.forEach((ch, i) => {
    if (g[i] === ch) res[i] = 'correct';
    else left[ch] = (left[ch] || 0) + 1;
  });
  g.forEach((ch, i) => {
    if (res[i] !== 'correct' && left[ch]) {
      res[i] = 'present';
      left[ch] -= 1;
    }
  });
  return res;
}

export function checkGuess(word) {
  const guess = normalizeWord(word);
  if ([...guess].length !== 5) throw bad('La palabra debe tener 5 letras');
  return guess;
}

export const pickWord = () => WORDLE_WORDS[randomInt(WORDLE_WORDS.length)];

const wordle = {
  label: 'Michi-Wordle',
  start: () => ({ answer: pickWord(), guesses: [] }),
  view: (s) => ({
    tries: WORDLE_TRIES,
    guesses: s.guesses,
    answer: s.done ? s.answer : undefined,
  }),
  action(s, { word }) {
    if (s.done) throw bad('La partida ya terminó');
    const guess = checkGuess(word);
    const solved = guess === s.answer;
    s.guesses.push({ word: guess, feedback: wordleFeedback(s.answer, guess) });
    if (solved || s.guesses.length >= WORDLE_TRIES) {
      s.done = true;
      const n = s.guesses.length;
      return {
        multiplier: solved ? wordleTable[n] : 0,
        summary: solved ? `Adivinaste ${s.answer} en ${n} intento${n === 1 ? '' : 's'}` : `La palabra era ${s.answer}`,
        details: { answer: s.answer, tries: n, solved },
      };
    }
    return null;
  },
};

// ---------------- Arcade (corren en el celular; el servidor solo revisa que el puntaje sea posible) ----------------

function arcade({ label, table, higherIsBetter = true, plausible, summary }) {
  return {
    label,
    table,
    start: () => ({ seed: newSeed() }),
    view: (s) => ({ seed: s.seed }),
    finish(s, { score }) {
      const value = Number(score);
      if (!Number.isFinite(value) || value < 0) throw bad('Puntaje inválido');
      if (!plausible(value, elapsedSec(s))) throw bad('Ese puntaje no parece posible 🤨');
      return { multiplier: tier(value, table, higherIsBetter), summary: summary(value), details: { score: value } };
    },
  };
}

const flappy = arcade({
  label: 'Flappy Michi',
  table: [
    [35, 8],
    [20, 4],
    [10, 2],
    [5, 1],
  ],
  plausible: (v, secs) => v <= secs / 0.85 + 2,
  summary: (v) => `Pasaste ${v} ovillos`,
});

// Contrarreloj: 105 m a 11 m/s (~9,5 s sin choques). Igual que RUNNER_SOLO en client/src/arcade/engines.js
const RUNNER_MIN_SECONDS = 105 / 11 - 0.3;
const runner = arcade({
  label: 'Michi Runner',
  table: [
    [10, 10],
    [11.2, 5],
    [12.6, 3],
    [14, 2],
    [15, 1],
  ],
  higherIsBetter: false,
  plausible: (v, secs) => v >= RUNNER_MIN_SECONDS && v <= secs + 2,
  summary: (v) => `Llegó a la meta en ${v.toFixed(2)} s${v > 17 ? ' (el premio llega hasta 15 s)' : ''}`,
});

const kart = arcade({
  label: 'Michi Kart',
  // Más rápido que antes (18 → 38 m/s): se recorre más distancia, así que las metas también suben
  table: [
    [5500, 8],
    [3500, 4],
    [2000, 2],
    [1000, 1],
  ],
  plausible: (v, secs) => v <= secs * 55 + 80,
  summary: (v) => `${Math.round(v)} puntos en la pista`,
});

const sprint = arcade({
  label: 'Sprint de 100 metros',
  // Tiempo máximo para ganar: 9 s; más lento pierde la entrada
  table: [
    [7.5, 10],
    [8, 5],
    [8.5, 3],
    [9, 2],
  ],
  higherIsBetter: false,
  plausible: (v, secs) => v >= 5 && v <= secs + 2,
  summary: (v) => `100 metros en ${v.toFixed(2)} s${v > 9 ? ' (el máximo para ganar es 9 s)' : ''}`,
});

export const SKILL_GAMES = { g2048: game2048, mines, sudoku, simon, wordle, flappy, runner, kart, sprint };
