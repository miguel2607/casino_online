import { randomInt } from '../../games/common.js';

export const newSeed = () => randomInt(1, 2 ** 31 - 1);

/** Juegos en equipo: ambos cobran lo mismo según el multiplicador conseguido. */
export function coop(multiplierOf) {
  return {
    payouts: (s, stake) => {
      const p = Math.floor(stake * multiplierOf(s));
      return [p, p];
    },
    outcomes: (s) => {
      const m = multiplierOf(s);
      const o = m > 1 ? 'win' : m === 1 ? 'push' : 'lose';
      return [o, o];
    },
    forfeit(s, idx) {
      s.forfeitedBy = idx;
      s.finished = { winner: null, coop: true, success: false, forfeit: idx };
    },
  };
}

/** Multiplicador según tabla [[umbral, mult], …] de mayor a menor. */
export const tier = (value, table) => {
  for (const [limit, mult] of table) if (value >= limit) return mult;
  return 0;
};

/**
 * Temporizador que se invalida solo si el juego avanza de fase:
 * cada fase nueva cambia s.timer y los temporizadores viejos se ignoran.
 */
export function scheduleAt(s, ctx, at, fn) {
  const token = (s.timer = (s.timer || 0) + 1);
  ctx.schedule(at - Date.now(), (st, c) => {
    if (st.timer === token && !st.finished) fn(st, c);
  });
}
