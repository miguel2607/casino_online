import { bad } from '../../errors.js';
import { randomInt } from '../../games/common.js';

// Pesca rápida: el mismo lago, cada uno con su caña. Cuando pica, hay que tocar a tiempo.
// 🐟 vale 1 · 🐠 dorado vale 3 (pica más rápido) · 👢 bota: si la sacas te resta 1.
const GAME_MS = 60000;
const COUNTDOWN_MS = 4000;
const MIN_HUMAN_MS = 110;
const KINDS = [
  { type: 'fish', weight: 62, window: 950, points: 1 },
  { type: 'gold', weight: 18, window: 620, points: 3 },
  { type: 'boot', weight: 20, window: 1100, points: -1 },
];
const LAG_MS = 1500; // margen para la latencia al validar en el servidor

function pick() {
  let roll = randomInt(100);
  for (const k of KINDS) {
    roll -= k.weight;
    if (roll < 0) return k;
  }
  return KINDS[0];
}

/** Programa la próxima picada de un jugador. Cada programación nueva invalida la anterior. */
function planBite(s, idx, ctx, delay) {
  const token = (s.tokens[idx] += 1);
  const at = Date.now() + delay;
  if (at >= s.endAt) return;
  ctx.schedule(at - Date.now(), (st, c) => {
    if (st.finished || st.tokens[idx] !== token) return;
    const kind = pick();
    st.bites[idx] = { id: `${idx}-${token}`, type: kind.type, window: kind.window, at: Date.now() };
    // Si no reacciona, el pez se va solo
    c.schedule(kind.window + LAG_MS, (st2, c2) => {
      if (st2.finished || st2.tokens[idx] !== token || !st2.bites[idx]) return;
      st2.log[idx].push({ type: st2.bites[idx].type, result: st2.bites[idx].type === 'boot' ? 'ignored' : 'escaped' });
      st2.bites[idx] = null;
      planBite(st2, idx, c2, 900 + randomInt(2600));
    });
  });
}

function endGame(s) {
  const [a, b] = s.scores;
  s.finished = { winner: a === b ? null : a > b ? 0 : 1 };
}

export default {
  create: () => {
    const startAt = Date.now() + COUNTDOWN_MS;
    return { startAt, endAt: startAt + GAME_MS, scores: [0, 0], bites: [null, null], tokens: [0, 0], log: [[], []], scared: [0, 0], started: false };
  },

  resume(s, ctx) {
    if (s.finished) return;
    const now = Date.now();
    if (now >= s.endAt) {
      endGame(s);
      return;
    }
    s.bites = [null, null];
    ctx.schedule(s.endAt - now, endGame);
    for (const idx of [0, 1]) planBite(s, idx, ctx, Math.max(0, s.startAt - now) + 1200 + randomInt(1800));
  },

  act(s, idx, action, ctx) {
    if (action?.type !== 'hook') throw bad('Jugada inválida');
    const now = Date.now();
    if (now < s.startAt || now >= s.endAt) return;
    const bite = s.bites[idx];
    if (!bite || bite.id !== action.id) {
      // Tocar sin picada espanta a los peces: la siguiente tarda más
      s.scared[idx] += 1;
      s.log[idx].push({ type: null, result: 'scared' });
      planBite(s, idx, ctx, 2600 + randomInt(1800));
      return;
    }
    const ms = Number(action.ms);
    const kind = KINDS.find((k) => k.type === bite.type);
    const inTime = Number.isFinite(ms) && ms >= MIN_HUMAN_MS && ms <= kind.window && now - bite.at <= kind.window + LAG_MS;
    let result;
    if (bite.type === 'boot') {
      s.scores[idx] = Math.max(0, s.scores[idx] - 1);
      result = 'boot';
    } else if (inTime) {
      s.scores[idx] += kind.points;
      result = 'caught';
    } else {
      result = 'late';
    }
    s.log[idx].push({ type: bite.type, result, ms: Number.isFinite(ms) ? Math.round(ms) : null });
    s.bites[idx] = null;
    planBite(s, idx, ctx, 900 + randomInt(2600));
  },

  view: (s, idx) => ({
    startAt: s.startAt,
    endAt: s.endAt,
    serverNow: Date.now(),
    scores: s.scores,
    bite: s.bites[idx] ? { id: s.bites[idx].id, type: s.bites[idx].type, window: s.bites[idx].window } : null,
    opponentBiting: Boolean(s.bites[1 - idx]),
    last: s.log[idx][s.log[idx].length - 1] ?? null,
    opponentLast: s.log[1 - idx][s.log[1 - idx].length - 1] ?? null,
    caught: s.log[idx].filter((l) => l.result === 'caught').map((l) => l.type),
  }),

  detail: (s, idx) => `${s.scores[idx]} a ${s.scores[1 - idx]} puntos de pesca`,
};
