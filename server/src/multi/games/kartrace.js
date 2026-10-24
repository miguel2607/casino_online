import { randomInt } from '../../games/common.js';
import { FISH_SPOTS, ITEM_SPOTS, LAPS, TRACK, TRACK_N, TRACK_WIDTH, nearestIndex, trackAngle, trackOffset } from '../../../../shared/kartTrack.js';
import { arena, dist, presses, round, stick } from './arena.js';

// Michi Kart Racing: 3 vueltas con joystick, turbo de pescaditos y cajas de poderes.
export const KR = { maxSpeed: 23, offSpeed: 9, accel: 16, brake: 22, turn: 3.4, turbo: 33, turboSec: 1.3, spinSec: 1.3, shieldSec: 7 };
const ITEMS = ['yarn', 'banana', 'shield'];
const RESPAWN_MS = 4500;

function newKart(i) {
  const start = TRACK_N - 4;
  const [x, y] = trackOffset(start, i === 0 ? -3 : 3);
  return {
    x, y, a: trackAngle(start), v: 0,
    idx: start, lap: 0, finishedAt: null,
    sx: 0, sy: 0, item: null, turbos: 1,
    useTaps: 0, turboTaps: 0, wantUse: false, wantTurbo: false,
    turboUntil: 0, spinUntil: 0, shieldUntil: 0,
  };
}

const progress = (k) => k.lap * TRACK_N + k.idx;

function hitKart(s, k, now) {
  if (k.shieldUntil > now) {
    k.shieldUntil = 0;
    return;
  }
  k.spinUntil = now + KR.spinSec * 1000;
  k.v *= 0.15;
}

export default arena({
  init: () => ({
    karts: [newKart(0), newKart(1)],
    boxes: ITEM_SPOTS.map(() => 0), // 0 = disponible, si no, hora en que reaparece
    fish: FISH_SPOTS.map(() => 0),
    shots: [],
    peels: [],
    nextId: 1,
  }),

  input(s, idx, data) {
    const k = s.karts[idx];
    const { x, y } = stick(data);
    k.sx = x;
    k.sy = y;
    let n;
    let taps;
    [n, taps] = presses(k.useTaps, data.use);
    k.useTaps = n;
    if (taps) k.wantUse = true;
    [n, taps] = presses(k.turboTaps, data.turbo);
    k.turboTaps = n;
    if (taps) k.wantTurbo = true;
  },

  step(s, dt, now) {
    s.karts.forEach((k, i) => {
      if (k.finishedAt) {
        k.v *= Math.max(0, 1 - 2 * dt);
      } else if (k.spinUntil > now) {
        k.a += 9 * dt;
        k.v *= Math.max(0, 1 - 3 * dt);
      } else {
        // El joystick indica hacia dónde quieres ir: el kart gira hacia allá y acelera
        const mag = Math.hypot(k.sx, k.sy);
        if (mag > 0.15) {
          const want = Math.atan2(k.sy, k.sx);
          let d = want - k.a;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const maxTurn = KR.turn * dt * (0.55 + 0.45 * Math.min(1, k.v / 12));
          k.a += Math.max(-maxTurn, Math.min(maxTurn, d));
          // Si apuntas muy atrás, frena antes de dar la vuelta
          if (Math.abs(d) > 2.2) k.v = Math.max(0, k.v - KR.brake * dt);
          else k.v += KR.accel * mag * dt;
        } else {
          k.v = Math.max(0, k.v - KR.accel * 0.6 * dt);
        }
        if (k.wantTurbo && k.turbos > 0 && k.turboUntil < now) {
          k.turbos -= 1;
          k.turboUntil = now + KR.turboSec * 1000;
        }
        if (k.wantUse && k.item) {
          if (k.item === 'yarn') {
            s.shots.push({ id: s.nextId++, x: k.x + Math.cos(k.a) * 2.5, y: k.y + Math.sin(k.a) * 2.5, a: k.a, owner: i, until: now + 3000 });
          } else if (k.item === 'banana') {
            s.peels.push({ id: s.nextId++, x: k.x - Math.cos(k.a) * 3, y: k.y - Math.sin(k.a) * 3, owner: i, safeUntil: now + 800, until: now + 40000 });
          } else {
            k.shieldUntil = now + KR.shieldSec * 1000;
          }
          k.item = null;
        }
      }
      k.wantUse = false;
      k.wantTurbo = false;

      const near = nearestIndex(k.x, k.y, k.idx);
      const off = near.d > TRACK_WIDTH / 2;
      const cap = k.turboUntil > now ? KR.turbo : off ? KR.offSpeed : KR.maxSpeed;
      if (k.turboUntil > now) k.v = Math.max(k.v, KR.turbo * 0.9);
      if (k.v > cap) k.v = Math.max(cap, k.v - KR.brake * 1.5 * dt);
      k.x += Math.cos(k.a) * k.v * dt;
      k.y += Math.sin(k.a) * k.v * dt;

      // Vueltas: cruzar la meta (índice 0) hacia adelante suma; hacia atrás resta
      const n2 = nearestIndex(k.x, k.y, k.idx);
      const delta = n2.i - k.idx;
      if (delta < -TRACK_N / 2) k.lap += 1;
      else if (delta > TRACK_N / 2) k.lap -= 1;
      k.idx = n2.i;
      // Muy fuera de la pista: vuelve al centro (como si lo rescatara una grúa)
      if (n2.d > TRACK_WIDTH * 1.6) {
        [k.x, k.y] = TRACK[k.idx];
        k.a = trackAngle(k.idx);
        k.v = 4;
      }
      if (!k.finishedAt && k.lap > LAPS) k.finishedAt = now;
    });

    // Choque entre karts
    const [a, b] = s.karts;
    const d = dist(a.x, a.y, b.x, b.y);
    if (d < 2.4 && d > 0) {
      const nx = (b.x - a.x) / d;
      const ny = (b.y - a.y) / d;
      const push = (2.4 - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      a.v *= 0.9;
      b.v *= 0.9;
    }

    // Cajas de poderes y pescaditos
    ITEM_SPOTS.forEach(([x, y], j) => {
      if (s.boxes[j] > now) return;
      for (const k of s.karts) {
        if (!k.item && dist(k.x, k.y, x, y) < 2.4) {
          k.item = ITEMS[randomInt(ITEMS.length)];
          s.boxes[j] = now + RESPAWN_MS;
          break;
        }
      }
    });
    FISH_SPOTS.forEach(([x, y], j) => {
      if (s.fish[j] > now) return;
      for (const k of s.karts) {
        if (k.turbos < 3 && dist(k.x, k.y, x, y) < 2.2) {
          k.turbos += 1;
          s.fish[j] = now + RESPAWN_MS * 1.5;
          break;
        }
      }
    });

    // Ovillos: persiguen un poco al rival
    for (const shot of s.shots) {
      const target = s.karts[1 - shot.owner];
      const want = Math.atan2(target.y - shot.y, target.x - shot.x);
      let dd = want - shot.a;
      while (dd > Math.PI) dd -= Math.PI * 2;
      while (dd < -Math.PI) dd += Math.PI * 2;
      shot.a += Math.max(-1.8 * dt, Math.min(1.8 * dt, dd));
      shot.x += Math.cos(shot.a) * 40 * dt;
      shot.y += Math.sin(shot.a) * 40 * dt;
      if (dist(shot.x, shot.y, target.x, target.y) < 2.2) {
        hitKart(s, target, now);
        shot.until = 0;
      }
    }
    s.shots = s.shots.filter((x) => x.until > now);

    for (const peel of s.peels) {
      for (const k of s.karts) {
        if (peel.until > now && (now > peel.safeUntil || s.karts.indexOf(k) !== peel.owner) && dist(k.x, k.y, peel.x, peel.y) < 1.9) {
          hitKart(s, k, now);
          peel.until = 0;
        }
      }
    }
    s.peels = s.peels.filter((x) => x.until > now);

    // Gana el primero en cruzar la meta en la última vuelta
    const done = s.karts.map((k) => k.finishedAt);
    if (done[0] || done[1]) {
      const winner = done[0] && done[1] ? (done[0] === done[1] ? null : done[0] < done[1] ? 0 : 1) : done[0] ? 0 : 1;
      s.finished = { winner };
    }
  },

  timeout: (s) => {
    const [p0, p1] = s.karts.map(progress);
    return { winner: p0 === p1 ? null : p0 > p1 ? 0 : 1 };
  },
  maxMs: 4 * 60 * 1000,

  snapshot: (s) => {
    const now = Date.now();
    return {
      k: s.karts.map((k) => [
        round(k.x), round(k.y), round(k.a), round(k.v, 10),
        Math.max(1, Math.min(LAPS, k.lap)), k.item, k.turbos,
        k.turboUntil > now ? 1 : 0, k.spinUntil > now ? 1 : 0, k.shieldUntil > now ? 1 : 0,
        progress(k),
      ]),
      bx: s.boxes.map((t) => (t > now ? 0 : 1)),
      fs: s.fish.map((t) => (t > now ? 0 : 1)),
      sh: s.shots.map((x) => [round(x.x), round(x.y)]),
      pe: s.peels.map((x) => [round(x.x), round(x.y)]),
    };
  },

  view: () => ({ laps: LAPS }),

  detail: (s, idx) => {
    const k = s.karts[idx];
    return k.finishedAt ? `Terminó las ${LAPS} vueltas` : `Iba en la vuelta ${Math.max(1, Math.min(LAPS, k.lap))}`;
  },
});
