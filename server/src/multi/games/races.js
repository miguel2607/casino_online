import { bad } from '../../errors.js';
import { randomInt } from '../../games/common.js';
import { coop, newSeed, tier } from './util.js';

// Constantes compartidas con el cliente (client/src/arcade/runner.js y sprint.js)
export const RUN_SPEED = 10; // m/s en modo carrera
export const GHOST_LENGTH = 500;
export const RELAY_LEG = 300;
export const SPRINT_LENGTH = 100;
const COUNTDOWN_MS = 4000;
const GRACE_MS = 30000;

const minTime = (meters) => meters / (RUN_SPEED * 1.15);

/** Carrera uno contra el otro: gana el menor tiempo; si uno no termina, gana el que sí. */
function versusRace({ length, minSeconds, maxMs }) {
  const decide = (s) => {
    const [a, b] = s.times;
    if (a == null && b == null) {
      const [pa, pb] = s.positions;
      s.finished = { winner: pa === pb ? null : pa > pb ? 0 : 1 };
    } else if (a == null || b == null) s.finished = { winner: a == null ? 1 : 0 };
    else s.finished = { winner: a === b ? null : a < b ? 0 : 1 };
  };
  return {
    create: () => ({ seed: newSeed(), length, startAt: Date.now() + COUNTDOWN_MS, positions: [0, 0], times: [null, null] }),

    resume(s, ctx) {
      if (s.finished) return;
      const end = s.startAt + maxMs;
      if (Date.now() >= end) decide(s);
      else ctx.schedule(end - Date.now(), decide);
    },

    pulse(s, idx, data) {
      const d = Number(data.d);
      if (!Number.isFinite(d)) return null;
      s.positions[idx] = Math.max(0, Math.min(length, d));
      return { d: s.positions[idx], y: Number(data.y) || 0, duck: Boolean(data.duck) };
    },

    act(s, idx, action, ctx) {
      if (action?.type !== 'finish') throw bad('Jugada inválida');
      if (s.times[idx] != null) return;
      const t = Number(action.time);
      const elapsed = (Date.now() - s.startAt) / 1000;
      if (!Number.isFinite(t) || t < minSeconds || t > elapsed + 2) throw bad('Ese tiempo no parece posible 🤨');
      s.times[idx] = Math.round(t * 100) / 100;
      s.positions[idx] = length;
      if (s.times[0] != null && s.times[1] != null) decide(s);
      else ctx.schedule(GRACE_MS, decide);
    },

    view: (s) => ({ seed: s.seed, length: s.length, startAt: s.startAt, serverNow: Date.now(), positions: s.positions, times: s.times }),

    detail: (s, idx) => (s.times[idx] != null ? `Llegó en ${s.times[idx].toFixed(2)} s` : 'No llegó a la meta'),
  };
}

export const ghostrace = versusRace({ length: GHOST_LENGTH, minSeconds: minTime(GHOST_LENGTH), maxMs: 180000 });
export const sprintlive = versusRace({ length: SPRINT_LENGTH, minSeconds: 5, maxMs: 60000 });

// ---------------- Relevos (en equipo) ----------------

const RELAY_TARGET = ((RELAY_LEG * 2) / RUN_SPEED) * 1.15; // segundos: deja margen para un par de tropiezos

const relayMultiplier = (s) => {
  if (s.times.some((t) => t == null)) return 0;
  const total = s.times[0] + s.times[1];
  if (total <= RELAY_TARGET * 0.92) return 3;
  if (total <= RELAY_TARGET) return 2;
  if (total <= RELAY_TARGET * 1.15) return 1;
  return 0;
};

export const relay = {
  ...coop(relayMultiplier),

  create: () => {
    const first = randomInt(2);
    return {
      seeds: [newSeed(), newSeed()],
      legLength: RELAY_LEG,
      order: [first, 1 - first],
      leg: 0,
      startAt: Date.now() + COUNTDOWN_MS,
      times: [null, null],
      position: 0,
      target: Math.round(RELAY_TARGET * 10) / 10,
    };
  },

  resume(s, ctx) {
    if (s.finished) return;
    // Si una posta no termina en 3 minutos (desconexión), la carrera se pierde
    const end = s.startAt + 180000;
    const leg = s.leg;
    ctx.schedule(Math.max(0, end - Date.now()), (st) => {
      if (st.leg === leg && st.times[leg] == null) st.finished = { winner: null, coop: true, success: false };
    });
  },

  pulse(s, idx, data) {
    if (idx !== s.order[s.leg]) return null;
    s.position = Math.max(0, Math.min(RELAY_LEG, Number(data.d) || 0));
    return { d: s.position, y: Number(data.y) || 0, duck: Boolean(data.duck) };
  },

  act(s, idx, action, ctx) {
    if (action?.type !== 'finish') throw bad('Jugada inválida');
    if (idx !== s.order[s.leg]) throw bad('No es tu posta');
    const t = Number(action.time);
    const elapsed = (Date.now() - s.startAt) / 1000;
    if (!Number.isFinite(t) || t < minTime(RELAY_LEG) || t > elapsed + 2) throw bad('Ese tiempo no parece posible 🤨');
    s.times[s.leg] = Math.round(t * 100) / 100;
    if (s.leg === 1) {
      s.finished = { winner: null, coop: true, success: relayMultiplier(s) > 1 };
      return;
    }
    s.leg = 1;
    s.position = 0;
    s.startAt = Date.now() + 3500;
    relay.resume(s, ctx);
  },

  view: (s, idx) => ({
    seed: s.seeds[s.leg],
    legLength: s.legLength,
    order: s.order,
    leg: s.leg,
    myLeg: s.order.indexOf(idx),
    startAt: s.startAt,
    serverNow: Date.now(),
    times: s.times,
    position: s.position,
    target: s.target,
  }),

  detail: (s) => (s.times.every((t) => t != null) ? `Relevo en ${(s.times[0] + s.times[1]).toFixed(2)} s (meta ${s.target} s)` : 'No completaron el relevo'),
};

// ---------------- Sprint en equipo contra el crupier ----------------
// La física corre en el servidor: los toques de los dos empujan al mismo michi.

const TAP_IMPULSE = 0.7; // m/s por toque
const DRAG = 1.0; // frenado por segundo
const DEALER_SPEED = 7.2; // m/s: uno solo no le gana, los dos juntos sí
const TICK_MS = 100;

function tick(s, ctx) {
  const now = Date.now();
  if (now < s.startAt) {
    ctx.schedule(s.startAt - now, tick, { persist: false });
    return;
  }
  const dt = (now - s.lastTick) / 1000;
  s.lastTick = now;
  s.v += s.pendingTaps * TAP_IMPULSE;
  s.pendingTaps = 0;
  s.v = Math.max(0, s.v - s.v * DRAG * dt);
  s.d = Math.min(SPRINT_LENGTH, s.d + s.v * dt);
  s.dealer = Math.min(SPRINT_LENGTH, ((now - s.startAt) / 1000) * DEALER_SPEED);
  ctx.emit({ d: s.d, dealer: s.dealer, v: s.v, taps: s.taps });
  if (s.d >= SPRINT_LENGTH || s.dealer >= SPRINT_LENGTH) {
    s.time = Math.round(((now - s.startAt) / 1000) * 100) / 100;
    s.finished = { winner: null, coop: true, success: s.d >= SPRINT_LENGTH };
    return;
  }
  ctx.schedule(TICK_MS, tick, { persist: false });
}

export const sprintteam = {
  ...coop((s) => (s.finished?.success ? 2 : 0)),

  create: () => ({ startAt: Date.now() + COUNTDOWN_MS, d: 0, v: 0, dealer: 0, pendingTaps: 0, taps: [0, 0], lastTick: Date.now() + COUNTDOWN_MS }),

  resume(s, ctx) {
    if (s.finished) return;
    s.lastTick = Math.max(Date.now(), s.startAt);
    ctx.schedule(Math.max(0, s.startAt - Date.now()), tick, { persist: false });
  },

  pulse(s, idx, data) {
    if (Date.now() < s.startAt) return null;
    const n = Math.max(0, Math.min(6, Math.floor(Number(data.taps) || 0)));
    s.pendingTaps += n;
    s.taps[idx] += n;
    return null;
  },

  act() {
    throw bad('En este juego solo se toca la pantalla');
  },

  view: (s) => ({ startAt: s.startAt, serverNow: Date.now(), d: s.d, dealer: s.dealer, length: SPRINT_LENGTH, dealerSpeed: DEALER_SPEED, taps: s.taps, time: s.time ?? null }),

  detail: (s, idx) => `${s.finished?.success ? 'Le ganaron al crupier' : 'El crupier ganó'} · ${s.taps[idx]} toques tuyos`,
};
