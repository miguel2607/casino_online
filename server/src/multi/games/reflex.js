import { bad } from '../../errors.js';
import { randomInt } from '../../games/common.js';
import { scheduleAt } from './util.js';

const TARGET = 3; // al mejor de 5
const MIN_HUMAN_MS = 100; // más rápido que esto es adivinar, cuenta como salida falsa
const TIMEOUT_MS = 3000;

function newRound(s, ctx, delay = 0) {
  s.phase = 'waiting';
  s.taps = [null, null];
  s.goAt = Date.now() + delay + 2000 + randomInt(3500);
  scheduleAt(s, ctx, s.goAt + TIMEOUT_MS, (st, c) => resolve(st, c));
}

function resolve(s, ctx) {
  const ok = s.taps.map((t) => t && !t.early && Number.isFinite(t.ms));
  let winner = null;
  if (ok[0] && ok[1]) winner = s.taps[0].ms === s.taps[1].ms ? null : s.taps[0].ms < s.taps[1].ms ? 0 : 1;
  else if (ok[0] !== ok[1]) winner = ok[0] ? 0 : 1;
  if (winner !== null) s.scores[winner] += 1;
  s.results.push({ taps: s.taps, winner });
  s.phase = 'result';
  if (winner !== null && s.scores[winner] >= TARGET) {
    s.finished = { winner };
    return;
  }
  s.round += 1;
  newRound(s, ctx, 1800);
}

// Duelo de reflejos: cuando aparece el michi, gana quien toque primero (medido en cada celular)
export default {
  create: () => ({ round: 1, scores: [0, 0], results: [], phase: 'starting', timer: 0 }),

  resume(s, ctx) {
    if (s.finished) return;
    if (s.phase === 'starting') newRound(s, ctx, 1500);
    else scheduleAt(s, ctx, Math.max(Date.now() + 500, s.goAt + TIMEOUT_MS), (st, c) => resolve(st, c));
  },

  act(s, idx, action, ctx) {
    if (action?.type !== 'tap') throw bad('Jugada inválida');
    if (s.phase !== 'waiting' || s.taps[idx]) return;
    const ms = Number(action.ms);
    const early = Boolean(action.early) || Date.now() < s.goAt - 400 || !Number.isFinite(ms) || ms < MIN_HUMAN_MS;
    s.taps[idx] = { early, ms: early ? null : Math.round(ms) };
    if (s.taps[0] && s.taps[1]) resolve(s, ctx);
  },

  view: (s, idx) => ({
    round: s.round,
    target: TARGET,
    scores: s.scores,
    phase: s.phase,
    goAt: s.goAt,
    serverNow: Date.now(),
    myTap: s.taps?.[idx] ?? null,
    opponentTapped: Boolean(s.taps?.[1 - idx]),
    last: s.results[s.results.length - 1] ?? null,
  }),

  detail: (s, idx) => {
    const mine = s.results.map((r) => r.taps[idx]).filter((t) => t && !t.early);
    const best = mine.length ? Math.min(...mine.map((t) => t.ms)) : null;
    return `${s.scores[idx]} a ${s.scores[1 - idx]}${best ? ` · mejor reacción ${best} ms` : ''}`;
  },
};
