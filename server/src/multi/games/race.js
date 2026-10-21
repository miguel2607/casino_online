import { bad } from '../../errors.js';
import { randomInt } from '../../games/common.js';
import { newCard, raceOrder } from '../../games/race.js';

const COUNTDOWN_MS = 1500;
const RACE_MS = 9000; // la animación más larga dura ~8.4 s

function finish(s) {
  const [a, b] = s.picks.map((id) => s.order.indexOf(id));
  s.finished = { winner: a < b ? 0 : 1 };
}

// Cada uno elige un michi distinto: gana aquel cuyo michi llegue antes
export default {
  create: () => ({ runners: newCard().runners, picks: [null, null], order: null, seed: null, startAt: null, endAt: null }),

  act(s, idx, action, ctx) {
    if (action?.type !== 'pick') throw bad('Jugada inválida');
    if (s.order) throw bad('La carrera ya empezó');
    if (!s.runners.some((r) => r.id === action.cat)) throw bad('Elige un michi');
    if (s.picks[1 - idx] === action.cat) throw bad('Ese michi ya lo eligió tu pareja');
    s.picks[idx] = action.cat;
    if (!s.picks[0] || !s.picks[1]) return;

    s.order = raceOrder(s.runners);
    s.seed = randomInt(1, 2 ** 31 - 1);
    s.startAt = Date.now() + COUNTDOWN_MS;
    s.endAt = s.startAt + RACE_MS;
    ctx.schedule(s.endAt - Date.now(), finish);
  },

  resume(s, ctx) {
    if (!s.order || s.finished) return;
    const left = s.endAt - Date.now();
    if (left <= 0) finish(s);
    else ctx.schedule(left, finish);
  },

  view: (s) => ({
    runners: s.runners.map(({ p, ...r }) => ({ ...r, chance: Math.round(p * 100) })),
    picks: s.picks,
    order: s.order,
    seed: s.seed,
    startAt: s.startAt,
    serverNow: Date.now(),
  }),

  detail(s, idx) {
    const name = s.runners.find((r) => r.id === s.picks[idx])?.name;
    return `${name} llegó de ${s.order.indexOf(s.picks[idx]) + 1}º`;
  },
};
