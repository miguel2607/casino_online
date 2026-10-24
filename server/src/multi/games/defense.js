import { randomInt } from '../../games/common.js';
import { arena, dist, presses, round, stick } from './arena.js';
import { coop } from './util.js';

// Defender la casa: llegan oleadas de pepinos, perros y aspiradoras. Cada michi ataca solo a lo
// que tenga cerca; el maullido aturde a todos alrededor. Si la casa aguanta las 6 oleadas, ganan.
export const DEF = { W: 10, H: 14, house: 1.2, hp: 12, catSpeed: 5, reach: 1.55, hitEvery: 0.34, meowR: 3.4, meowCd: 6, waves: 6 };
const ENEMIES = {
  cucumber: { hp: 2, speed: 1.15, dmg: 1, r: 0.38, e: '🥒' },
  dog: { hp: 4, speed: 1.75, dmg: 2, r: 0.48, e: '🐕' },
  vacuum: { hp: 6, speed: 0.7, dmg: 3, r: 0.6, e: '🤖' },
};
const WAVES = [
  { cucumber: 6 },
  { cucumber: 8, dog: 2 },
  { cucumber: 8, dog: 4 },
  { cucumber: 8, dog: 4, vacuum: 1 },
  { cucumber: 10, dog: 6, vacuum: 2 },
  { cucumber: 12, dog: 7, vacuum: 3 },
];
const HOUSE = { x: DEF.W / 2, y: DEF.H / 2 };

const multiplierOf = (s) => {
  if (!s.won) return 0;
  return s.hp >= 9 ? 2.5 : s.hp >= 5 ? 2 : 1.3;
};

function startWave(s, now) {
  const list = [];
  for (const [type, n] of Object.entries(WAVES[s.wave])) for (let i = 0; i < n; i++) list.push(type);
  // Orden al azar; aparecen cada ~0,9 s por un borde al azar
  for (let i = list.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  s.queue = list.map((type, i) => ({ type, at: now + (s.wave ? 3500 : 1500) + i * Math.max(520, 1000 - s.wave * 80) }));
  s.dirty = true;
}

function spawn(s, type) {
  const side = randomInt(4);
  const t = randomInt(1000) / 1000;
  const [x, y] = side === 0 ? [t * DEF.W, -0.5] : side === 1 ? [t * DEF.W, DEF.H + 0.5] : side === 2 ? [-0.5, t * DEF.H] : [DEF.W + 0.5, t * DEF.H];
  s.enemies.push({ id: s.nextId++, type, x, y, hp: ENEMIES[type].hp, stunUntil: 0, hitAt: 0 });
}

export default arena({
  ...coop(multiplierOf),
  init: () => {
    const s = {
      hp: DEF.hp,
      wave: 0,
      queue: [],
      enemies: [],
      nextId: 1,
      won: false,
      cats: [
        { x: DEF.W / 2 - 2, y: DEF.H / 2 + 2.5, sx: 0, sy: 0, attackAt: 0, meowAt: -99, taps: 0, wantMeow: false, swipe: null },
        { x: DEF.W / 2 + 2, y: DEF.H / 2 - 2.5, sx: 0, sy: 0, attackAt: 0, meowAt: -99, taps: 0, wantMeow: false, swipe: null },
      ],
      meows: [],
      kills: [0, 0],
    };
    startWave(s, Date.now() + 4000);
    return s;
  },

  input(s, idx, data) {
    const c = s.cats[idx];
    const { x, y } = stick(data);
    c.sx = x;
    c.sy = y;
    const [n, taps] = presses(c.taps, data.meow);
    c.taps = n;
    if (taps) c.wantMeow = true;
  },

  step(s, dt, now) {
    const t = (now - s.startAt) / 1000;
    while (s.queue.length && s.queue[0].at <= now) spawn(s, s.queue.shift().type);

    s.cats.forEach((c, i) => {
      c.x = Math.max(0.3, Math.min(DEF.W - 0.3, c.x + c.sx * DEF.catSpeed * dt));
      c.y = Math.max(0.3, Math.min(DEF.H - 0.3, c.y + c.sy * DEF.catSpeed * dt));
      // No atravesar la casa
      const dh = dist(c.x, c.y, HOUSE.x, HOUSE.y);
      if (dh < DEF.house + 0.35 && dh > 0) {
        c.x = HOUSE.x + ((c.x - HOUSE.x) / dh) * (DEF.house + 0.35);
        c.y = HOUSE.y + ((c.y - HOUSE.y) / dh) * (DEF.house + 0.35);
      }
      if (c.wantMeow && t - c.meowAt >= DEF.meowCd) {
        c.meowAt = t;
        s.meows.push({ x: c.x, y: c.y, at: now });
        for (const e of s.enemies) {
          if (dist(e.x, e.y, c.x, c.y) <= DEF.meowR) {
            e.stunUntil = now + 1800;
            e.hp -= 1;
            e.hitAt = now;
          }
        }
      }
      c.wantMeow = false;
      if (now >= c.attackAt) {
        let best = null;
        let bestD = DEF.reach;
        for (const e of s.enemies) {
          const d = dist(e.x, e.y, c.x, c.y) - ENEMIES[e.type].r;
          if (e.hp > 0 && d < bestD) {
            best = e;
            bestD = d;
          }
        }
        if (best) {
          best.hp -= 1;
          best.hitAt = now;
          c.attackAt = now + DEF.hitEvery * 1000;
          c.swipe = { x: best.x, y: best.y, at: now };
          if (best.hp <= 0) s.kills[i] += 1;
        }
      }
    });
    s.meows = s.meows.filter((m) => now - m.at < 500);

    for (const e of s.enemies) {
      if (e.hp <= 0 || now < e.stunUntil) continue;
      const def = ENEMIES[e.type];
      const d = dist(e.x, e.y, HOUSE.x, HOUSE.y);
      if (d <= DEF.house + def.r) {
        s.hp -= def.dmg;
        e.hp = 0;
        e.reached = true;
        continue;
      }
      e.x += ((HOUSE.x - e.x) / d) * def.speed * dt;
      e.y += ((HOUSE.y - e.y) / d) * def.speed * dt;
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0);

    if (s.hp <= 0) {
      s.hp = 0;
      s.finished = { winner: null, coop: true, success: false };
      return;
    }
    if (!s.queue.length && !s.enemies.length) {
      if (s.wave >= WAVES.length - 1) {
        s.won = true;
        s.finished = { winner: null, coop: true, success: true };
        return;
      }
      s.wave += 1;
      startWave(s, now);
    }
  },

  timeout: (s) => ({ winner: null, coop: true, success: false }),
  maxMs: 6 * 60 * 1000,

  snapshot: (s) => {
    const now = Date.now();
    const t = (now - s.startAt) / 1000;
    return {
      c: s.cats.map((c) => [round(c.x), round(c.y), round(Math.max(0, DEF.meowCd - (t - c.meowAt)), 10), c.swipe && now - c.swipe.at < 200 ? [round(c.swipe.x), round(c.swipe.y)] : null]),
      e: s.enemies.map((e) => [e.id, ENEMIES[e.type].e, round(e.x), round(e.y), now < e.stunUntil ? 1 : 0, now - e.hitAt < 150 ? 1 : 0]),
      m: s.meows.map((m) => [round(m.x), round(m.y)]),
      hp: s.hp,
      wv: s.wave + 1,
      left: s.queue.length + s.enemies.length,
      k: s.kills,
    };
  },

  view: () => ({ def: DEF, waves: WAVES.length }),

  detail: (s, idx) => `${s.won ? `Salvaron la casa con ${s.hp}/${DEF.hp} ❤️` : `Llegaron a la oleada ${s.wave + 1}`} · ${s.kills[idx]} enemigos tuyos`,
});
