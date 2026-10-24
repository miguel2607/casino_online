import { arena, presses, round, stick } from './arena.js';

// Sumo de michis: empuja a tu pareja fuera de la plataforma, que se va encogiendo.
export const SUMO = { r0: 10, rMin: 4.2, shrinkSec: 45, cat: 1.1, accel: 26, drag: 2.4, dash: 15, dashCd: 2.2, target: 2 };
const ROUND_PAUSE_MS = 2200;

function resetRound(s, now) {
  s.cats = [
    { x: 0, y: SUMO.r0 * 0.5, vx: 0, vy: 0, a: -Math.PI / 2, dashAt: -99, sx: 0, sy: 0 },
    { x: 0, y: -SUMO.r0 * 0.5, vx: 0, vy: 0, a: Math.PI / 2, dashAt: -99, sx: 0, sy: 0 },
  ].map((c, i) => ({ ...c, taps: s.cats?.[i]?.taps ?? 0 }));
  s.roundStart = now + ROUND_PAUSE_MS;
  s.radius = SUMO.r0;
  s.fallen = null;
}

export default arena({
  init: () => {
    const s = { scores: [0, 0], round: 1, lastRound: null };
    resetRound(s, Date.now() + 4000 - ROUND_PAUSE_MS);
    return s;
  },

  input(s, idx, data) {
    const c = s.cats[idx];
    const { x, y } = stick(data);
    c.sx = x;
    c.sy = y;
    const [n, dashes] = presses(c.taps, data.dash);
    c.taps = n;
    if (dashes) c.wantDash = true;
  },

  step(s, dt, now) {
    if (now < s.roundStart) return;
    const t = (now - s.roundStart) / 1000;
    s.radius = Math.max(SUMO.rMin, SUMO.r0 - ((SUMO.r0 - SUMO.rMin) * t) / SUMO.shrinkSec);

    for (const c of s.cats) {
      c.vx += c.sx * SUMO.accel * dt;
      c.vy += c.sy * SUMO.accel * dt;
      if (Math.hypot(c.sx, c.sy) > 0.2) c.a = Math.atan2(c.sy, c.sx);
      if (c.wantDash && t - c.dashAt >= SUMO.dashCd) {
        c.dashAt = t;
        c.vx += Math.cos(c.a) * SUMO.dash;
        c.vy += Math.sin(c.a) * SUMO.dash;
      }
      c.wantDash = false;
      const f = Math.max(0, 1 - SUMO.drag * dt);
      c.vx *= f;
      c.vy *= f;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
    }

    // Choque: el que viene embistiendo empuja más fuerte
    const [a, b] = s.cats;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    const min = SUMO.cat * 2;
    if (d < min && d > 0) {
      const nx = dx / d;
      const ny = dy / d;
      const overlap = (min - d) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel > 0) {
        const ma = t - a.dashAt < 0.35 ? 3 : 1;
        const mb = t - b.dashAt < 0.35 ? 3 : 1;
        const j = (2.2 * rel) / (1 / ma + 1 / mb);
        a.vx -= (j / ma) * nx;
        a.vy -= (j / ma) * ny;
        b.vx += (j / mb) * nx;
        b.vy += (j / mb) * ny;
      }
    }

    const out = s.cats.map((c) => Math.hypot(c.x, c.y) > s.radius + SUMO.cat * 0.3);
    if (out[0] || out[1]) {
      const winner = out[0] && out[1] ? null : out[0] ? 1 : 0;
      if (winner !== null) s.scores[winner] += 1;
      s.lastRound = { winner, round: s.round };
      if (winner !== null && s.scores[winner] >= SUMO.target) {
        s.finished = { winner };
        return;
      }
      s.round += 1;
      resetRound(s, now);
      s.dirty = true;
    }
  },

  timeout: (s) => ({ winner: s.scores[0] === s.scores[1] ? null : s.scores[0] > s.scores[1] ? 0 : 1 }),
  maxMs: 4 * 60 * 1000,

  snapshot: (s) => {
    const t = (Date.now() - s.roundStart) / 1000;
    return {
      c: s.cats.map((c) => [round(c.x), round(c.y), round(c.a), round(Math.max(0, SUMO.dashCd - (t - c.dashAt)), 10)]),
      r: round(s.radius),
      sc: s.scores,
      rd: s.round,
      wait: Date.now() < s.roundStart,
      last: s.lastRound,
    };
  },

  view: () => ({ sumo: SUMO }),

  detail: (s, idx) => `${s.scores[idx]} a ${s.scores[1 - idx]} en rondas`,
});
