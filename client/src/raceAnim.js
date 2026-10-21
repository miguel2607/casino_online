// Animación de la carrera de michis. Con la misma semilla, los dos jugadores ven exactamente la misma carrera.

export const RACE_BASE_MS = 6000;
const SEGMENTS = 10;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Trayectoria de cada michi: cada uno cruza la meta en el orden real recibido del servidor. */
export function buildPlan(order, seed = Math.floor(Math.random() * 2 ** 31)) {
  const rnd = mulberry32(seed);
  const plan = {};
  order.forEach((id, rank) => {
    const finish = RACE_BASE_MS + rank * (220 + rnd() * 260);
    const w = Array.from({ length: SEGMENTS }, () => 0.55 + rnd() * 0.9);
    const sum = w.reduce((a, b) => a + b, 0);
    let acc = 0;
    plan[id] = { finish, points: [0, ...w.map((x) => (acc += x / sum))] };
  });
  return plan;
}

export function positionAt(p, t) {
  if (t <= 0) return 0;
  if (t >= p.finish) return 1;
  const f = (t / p.finish) * SEGMENTS;
  const i = Math.floor(f);
  return p.points[i] + (p.points[i + 1] - p.points[i]) * (f - i);
}
