// Motores de los juegos de acción. Corren en el celular con una semilla del servidor,
// así en las carreras en pareja los dos tienen exactamente la misma pista.
import { mulberry32, shuffleWith } from '@shared/rng.js';

// ---------------- Michi Runner ----------------
export const RUNNER = {
  gravity: 30,
  jumpV: 10.5,
  catH: 0.85,
  duckH: 0.42,
  catHalfW: 0.3,
  startSpeed: 8,
  maxSpeed: 16,
  raceSpeed: 10, // igual que RUN_SPEED en el servidor
};

const OBSTACLES = {
  cucumber: { w: 0.55, h: 0.55, y: 0, emoji: '🥒' },
  dog: { w: 0.95, h: 0.85, y: 0, emoji: '🐕' },
  bird: { w: 0.8, h: 0.55, y: 0.62, emoji: '🐦' },
};

// Michi Runner individual: contra el reloj. Sin choques se llega en ~9,5 s; cada choque cuesta ~1,5 s.
// Debe coincidir con la tabla del servidor (server/src/games/skill/defs.js).
export const RUNNER_SOLO = {
  speed: 11,
  length: 105,
  maxTime: 25,
  stumble: 1.2, // segundos parado tras chocar: correr sin saltar no debe dar premio
  table: [
    [10, 10],
    [11.2, 5],
    [12.6, 3],
    [14, 2],
    [15, 1],
  ],
};
export const runnerMultiplier = (t) => RUNNER_SOLO.table.find(([limit]) => t <= limit)?.[1] ?? 0;

export const runnerSpeedAt = (d, race, speed = RUNNER.raceSpeed) =>
  race ? speed : Math.min(RUNNER.maxSpeed, RUNNER.startSpeed + d / 120);

export function buildRunnerCourse(seed, length, race, speed = RUNNER.raceSpeed, firstAt = 18) {
  const rnd = mulberry32(seed);
  const obstacles = [];
  const fish = [];
  let x = firstAt;
  while (x < length - 6) {
    const v = runnerSpeedAt(x, race, speed);
    const roll = rnd();
    const type = x < 120 ? (roll < 0.6 ? 'cucumber' : 'dog') : roll < 0.42 ? 'cucumber' : roll < 0.72 ? 'dog' : 'bird';
    obstacles.push({ x, type, ...OBSTACLES[type] });
    const gap = v * 0.95 + 5 + rnd() * v * 1.1;
    if (rnd() < 0.65) fish.push({ x: x + gap / 2, y: rnd() < 0.5 ? 0.2 : 1.45, taken: false });
    x += gap;
  }
  return { obstacles, fish, length };
}

// ---------------- Michi Kart ----------------
export const KART = { lanes: 3, startSpeed: 18, maxSpeed: 38, switchTime: 0.11 };
const KART_OBSTACLES = ['🚧', '📦', '🐕', '🛢️'];
export const kartSpeedAt = (d) => Math.min(KART.maxSpeed, KART.startSpeed + d / 50);

export function buildKartCourse(seed, length = 12000) {
  const rnd = mulberry32(seed);
  const rows = [];
  let x = 30;
  while (x < length) {
    const v = kartSpeedAt(x);
    const two = rnd() < Math.min(0.55, 0.15 + x / 4000);
    const lanes = shuffleWith(rnd, [0, 1, 2]).slice(0, two ? 2 : 1);
    const free = [0, 1, 2].filter((l) => !lanes.includes(l));
    rows.push({
      x,
      blocked: lanes,
      emoji: lanes.map(() => KART_OBSTACLES[Math.floor(rnd() * KART_OBSTACLES.length)]),
      coin: rnd() < 0.5 ? { lane: free[Math.floor(rnd() * free.length)], taken: false } : null,
    });
    x += v * 0.75 + 6 + rnd() * v * 0.6;
  }
  return rows;
}

// ---------------- Flappy Michi ----------------
export const FLAPPY = { height: 10, ground: 0.8, gravity: 26, flap: -8.6, catX: 2.6, radius: 0.42, pipeW: 1.15, spacing: 4.2 };
export const flappySpeed = (score) => Math.min(4.6, 3.6 + score * 0.04);
export const flappyGap = (score) => Math.max(2.75, 3.5 - score * 0.025);

export function buildFlappyPipes(seed, count = 400) {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, (_, k) => ({ k, center: 2.7 + rnd() * 4.4, passed: false }));
}

// ---------------- Sprint ----------------
// Con ~10 toques/s se llega en unos 9 s; el tope de 16 m/s permite bajar de 8 s tocando muy rápido
export const SPRINT = { length: 100, impulse: 1.25, drag: 1.0, maxSpeed: 16, stumble: 0.7, limit: 9 };
