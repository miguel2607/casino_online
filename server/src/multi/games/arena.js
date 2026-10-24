import { bad } from '../../errors.js';

// Base de los juegos de acción en tiempo real: la física corre en el servidor.
// Cada celular solo manda su joystick y botones (por pulsos); el servidor avanza la simulación
// TICK_MS a TICK_MS y envía a los dos una foto pequeña del mundo (ctx.emit).

export const TICK_MS = 40; // 25 actualizaciones por segundo
export const COUNTDOWN_MS = 4000;
const SAVE_EVERY = 125; // guarda en la base cada ~5 s por si el servidor se reinicia

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const num = (v, lo, hi, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, lo, hi) : def;
};
export const round = (v, k = 100) => Math.round(v * k) / k;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/** Joystick: vector de largo máximo 1. */
export function stick(data) {
  let x = num(data?.x, -1, 1);
  let y = num(data?.y, -1, 1);
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}

/**
 * Los botones llegan como contadores que el celular incrementa en cada toque: así un toque
 * no se pierde aunque llegue entre dos ticks. Devuelve cuántos toques nuevos hubo.
 */
export function presses(prev, value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return [prev, 0];
  if (n < prev) return [n, n > 0 ? 1 : 0]; // el celular recargó la página
  return [n, Math.min(5, n - prev)];
}

/**
 * Crea la definición de un juego de acción.
 *  init({ options }) → mundo inicial (se le agregan startAt, inputs, …)
 *  input(world, idx, data) → guarda las entradas del jugador
 *  step(world, dt, now) → avanza la física; pone world.finished = {…} al terminar
 *  snapshot(world) → foto que se manda en cada tick
 *  view(world, idx) → datos estáticos (pista, colores…) que se mandan al entrar
 */
export function arena({ init, input, step, snapshot, view, detail, maxMs = 5 * 60 * 1000, ...rest }) {
  function loop(s, ctx) {
    if (s.finished) return;
    const now = Date.now();
    if (now < s.startAt) {
      ctx.schedule(Math.min(TICK_MS * 5, s.startAt - now), loop, { persist: false, broadcast: false });
      return;
    }
    const dt = Math.min(0.1, Math.max(0, (now - (s.lastTick || s.startAt)) / 1000));
    s.lastTick = now;
    s.ticks = (s.ticks || 0) + 1;
    step(s, dt, now);
    if (!s.finished && now - s.startAt > maxMs) s.finished = rest.timeout ? rest.timeout(s) : { winner: null };
    ctx.emit({ t: now, ...snapshot(s) });
    if (!s.finished) ctx.schedule(TICK_MS, loop, { persist: s.ticks % SAVE_EVERY === 0, broadcast: false });
  }

  return {
    ...rest,
    create: ({ options } = {}) => ({ ...init({ options }), startAt: Date.now() + COUNTDOWN_MS, lastTick: 0, ticks: 0 }),

    resume(s, ctx) {
      if (s.finished) return;
      // Tras un reinicio el reloj sigue desde ahora (no se "teletransporta" lo que pasó apagado)
      if (s.lastTick) s.lastTick = Date.now();
      ctx.schedule(0, loop, { persist: false, broadcast: false });
    },

    pulse(s, idx, data) {
      if (s.finished) return null;
      input(s, idx, data ?? {});
      return null;
    },

    act() {
      throw bad('En este juego se usa el joystick');
    },

    view: (s, idx) => ({ startAt: s.startAt, serverNow: Date.now(), snap: snapshot(s), ...view(s, idx) }),

    detail,
  };
}
