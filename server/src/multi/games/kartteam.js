import { randomInt, shuffle } from '../../games/common.js';
import { arena, presses } from './arena.js';
import { coop, tier } from './util.js';

// Kart en equipo: un mismo kart, uno maneja (cambia de carril) y el otro dispara a los obstáculos.
// A mitad de carrera cambian de puesto. Cada pescadito acelera el kart.
export const KT = { lanes: 3, startSpeed: 16, cruise: 30, fishBoost: 1.6, maxSpeed: 52, lives: 3, gameSec: 90, swapSec: 45, fireCd: 0.9, range: 46, switchTime: 0.12 };
const OBSTACLES = ['🚧', '📦', '🐕', '🛢️', '🥒'];
const TABLE = [
  [3800, 3],
  [2900, 2],
  [2100, 1],
];
const scoreOf = (s) => Math.round(s.d + s.fish * 15);
const speedOf = (s) => Math.min(KT.maxSpeed, Math.min(KT.cruise, KT.startSpeed + s.d / 45) + s.fish * KT.fishBoost);

function addRows(s) {
  while (s.lastX < s.d + 120) {
    const v = Math.min(KT.cruise, KT.startSpeed + s.lastX / 45);
    const two = randomInt(100) < Math.min(60, 20 + s.lastX / 60);
    const lanes = shuffle([0, 1, 2]).slice(0, two ? 2 : 1);
    const free = [0, 1, 2].filter((l) => !lanes.includes(l));
    s.rows.push({
      id: s.nextId++,
      x: Math.round(s.lastX),
      obs: lanes.map((l) => ({ l, e: OBSTACLES[randomInt(OBSTACLES.length)], hit: false })),
      fish: randomInt(100) < 45 ? { l: free[randomInt(free.length)], taken: false } : null,
    });
    s.lastX += v * 0.7 + 7 + (randomInt(100) / 100) * v * 0.55;
  }
  s.rows = s.rows.filter((r) => r.x > s.d - 10);
}

const driverOf = (s, now) => ((now - s.startAt) / 1000 < KT.swapSec ? s.firstDriver : 1 - s.firstDriver);

export default arena({
  ...coop((s) => tier(scoreOf(s), TABLE)),
  init: () => {
    const s = { d: 0, lane: 1, pos: 1, fish: 0, lives: KT.lives, invulnUntil: 0, rows: [], lastX: 40, nextId: 1, firstDriver: randomInt(2), taps: [{}, {}], fireReady: 0, blasts: [] };
    addRows(s);
    return s;
  },

  input(s, idx, data) {
    const t = s.taps[idx];
    const now = Date.now();
    const driving = driverOf(s, now) === idx;
    for (const name of ['left', 'right', 'f0', 'f1', 'f2']) {
      const [n, c] = presses(t[name] || 0, data[name]);
      t[name] = n;
      if (!c || now < s.startAt) continue;
      if (driving && name === 'left') s.lane = Math.max(0, s.lane - 1);
      if (driving && name === 'right') s.lane = Math.min(KT.lanes - 1, s.lane + 1);
      if (!driving && name[0] === 'f' && now >= s.fireReady) {
        const lane = Number(name[1]);
        s.fireReady = now + KT.fireCd * 1000;
        // Destruye el primer obstáculo de ese carril que esté al alcance
        const row = s.rows.find((r) => r.x > s.d + 1 && r.x < s.d + KT.range && r.obs.some((o) => o.l === lane && !o.hit));
        if (row) {
          row.obs.find((o) => o.l === lane && !o.hit).hit = true;
          s.blasts.push({ l: lane, x: row.x, at: now });
        } else s.blasts.push({ l: lane, x: s.d + KT.range, at: now, miss: true });
      }
    }
  },

  step(s, dt, now) {
    const v = speedOf(s);
    const prev = s.d;
    s.d += v * dt;
    const stepLane = dt / KT.switchTime;
    s.pos += Math.max(-stepLane, Math.min(stepLane, s.lane - s.pos));
    for (const r of s.rows) {
      if (r.x > s.d + 0.8) break;
      if (r.x < prev - 0.8) continue;
      if (now > s.invulnUntil && r.obs.some((o) => !o.hit && Math.abs(o.l - s.pos) < 0.55)) {
        s.lives -= 1;
        s.invulnUntil = now + 1200;
        r.obs.forEach((o) => {
          if (Math.abs(o.l - s.pos) < 0.55) o.hit = true;
        });
      }
      if (r.fish && !r.fish.taken && Math.abs(r.fish.l - s.pos) < 0.5) {
        r.fish.taken = true;
        s.fish += 1;
      }
    }
    addRows(s);
    s.blasts = s.blasts.filter((b) => now - b.at < 400);
    if (s.lives <= 0 || (now - s.startAt) / 1000 >= KT.gameSec) {
      s.finished = { winner: null, coop: true, success: tier(scoreOf(s), TABLE) > 1 };
    }
  },

  snapshot: (s) => {
    const now = Date.now();
    return {
      d: Math.round(s.d * 10) / 10,
      ln: s.lane,
      pos: Math.round(s.pos * 100) / 100,
      v: Math.round(speedOf(s) * 10) / 10,
      fish: s.fish,
      lives: s.lives,
      inv: now < s.invulnUntil,
      drv: driverOf(s, Math.max(now, s.startAt)),
      fire: Math.max(0, Math.round((s.fireReady - now) / 100) / 10),
      tl: Math.max(0, Math.round(KT.gameSec - (Math.max(now, s.startAt) - s.startAt) / 1000)),
      sc: scoreOf(s),
      rows: s.rows.filter((r) => r.x < s.d + 70).map((r) => [r.x, r.obs.filter((o) => !o.hit).map((o) => [o.l, o.e]), r.fish && !r.fish.taken ? r.fish.l : -1]),
      bl: s.blasts.map((b) => [b.l, Math.round(b.x), b.miss ? 1 : 0]),
    };
  },

  view: () => ({ kt: KT, table: TABLE }),

  detail: (s) => `${scoreOf(s)} puntos · ${s.fish} pescaditos`,
});
