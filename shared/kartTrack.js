// Pista del Michi Kart Racing (cliente y servidor la generan igual).
// Puntos de control en metros; se suavizan con Catmull-Rom en una línea central cerrada.

const CONTROL = [
  [0, 0],
  [45, -6],
  [80, 4],
  [96, 32],
  [84, 62],
  [56, 60],
  [44, 40],
  [22, 46],
  [12, 78],
  [-18, 84],
  [-36, 60],
  [-28, 30],
  [-38, 8],
];

export const TRACK_WIDTH = 13;
export const LAPS = 3;

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return [0, 1].map(
    (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3),
  );
}

function build() {
  const n = CONTROL.length;
  const raw = [];
  for (let i = 0; i < n; i++) {
    const p0 = CONTROL[(i - 1 + n) % n];
    const p1 = CONTROL[i];
    const p2 = CONTROL[(i + 1) % n];
    const p3 = CONTROL[(i + 2) % n];
    for (let k = 0; k < 24; k++) raw.push(catmull(p0, p1, p2, p3, k / 24));
  }
  // Re-muestreo cada ~2 m para que el progreso sea parejo
  const pts = [raw[0]];
  let acc = 0;
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1];
    const b = raw[i % raw.length];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    acc += seg;
    if (acc >= 2) {
      pts.push(b);
      acc = 0;
    }
  }
  if (Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]) < 1) pts.pop();
  return pts.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
}

export const TRACK = build();
export const TRACK_N = TRACK.length;

/** Dirección de la pista en el punto i (radianes). */
export function trackAngle(i) {
  const a = TRACK[((i % TRACK_N) + TRACK_N) % TRACK_N];
  const b = TRACK[(((i + 1) % TRACK_N) + TRACK_N) % TRACK_N];
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

/** Punto a `off` metros a la izquierda (−) o derecha (+) de la línea central en el índice i. */
export function trackOffset(i, off) {
  const p = TRACK[((i % TRACK_N) + TRACK_N) % TRACK_N];
  const a = trackAngle(i);
  return [p[0] - Math.sin(a) * off, p[1] + Math.cos(a) * off];
}

/** Índice más cercano buscando solo cerca del anterior (así no se "salta" pista por atajos). */
export function nearestIndex(x, y, from, window = 14) {
  let best = from;
  let bestD = Infinity;
  for (let k = -window; k <= window; k++) {
    const i = (((from + k) % TRACK_N) + TRACK_N) % TRACK_N;
    const p = TRACK[i];
    const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { i: best, d: Math.sqrt(bestD) };
}

/** Cajas de poderes y pescaditos (posiciones fijas sobre la pista). */
export const ITEM_SPOTS = [];
export const FISH_SPOTS = [];
for (let k = 1; k <= 6; k++) {
  const i = Math.floor((TRACK_N * k) / 6.3) + 6;
  for (const off of [-3.5, 0, 3.5]) ITEM_SPOTS.push(trackOffset(i, off));
}
for (let k = 0; k < 9; k++) {
  const i = Math.floor((TRACK_N * (k + 0.5)) / 9);
  FISH_SPOTS.push(trackOffset(i, k % 2 ? 3 : -3));
}
