import { bad } from '../../errors.js';
import { randomInt } from '../../games/common.js';
import { STOP_CATEGORIES, STOP_LETTERS } from '../../../../shared/words.js';
import { normalizeWord } from '../../../../shared/rng.js';
import { scheduleAt } from './util.js';

const ROUNDS = 3;
const WRITE_MS = 120000;
const BASTA_MS = 5000;
const BETWEEN_MS = 6000;

const empty = () => STOP_CATEGORIES.map(() => '');
const startsWith = (word, letter) => normalizeWord(word).startsWith(letter);

function startRound(s, ctx) {
  const left = STOP_LETTERS.filter((l) => !s.usedLetters.includes(l));
  s.letter = left[randomInt(left.length)];
  s.usedLetters.push(s.letter);
  s.phase = 'writing';
  s.answers = [empty(), empty()];
  s.rejected = [STOP_CATEGORIES.map(() => false), STOP_CATEGORIES.map(() => false)];
  s.confirmed = [false, false];
  s.bastaBy = null;
  s.endsAt = Date.now() + WRITE_MS;
  scheduleAt(s, ctx, s.endsAt, (st) => toReview(st));
}

function toReview(s) {
  s.phase = 'review';
  s.endsAt = null;
  s.timer += 1;
}

function score(s, ctx) {
  const valid = [0, 1].map((p) => s.answers[p].map((a, k) => Boolean(a.trim()) && startsWith(a, s.letter) && !s.rejected[p][k]));
  const pts = [0, 1].map((p) =>
    s.answers[p].map((a, k) => {
      if (!valid[p][k]) return 0;
      if (!valid[1 - p][k]) return 20;
      return normalizeWord(a) === normalizeWord(s.answers[1 - p][k]) ? 5 : 10;
    }),
  );
  const totals = pts.map((row) => row.reduce((x, y) => x + y, 0));
  s.scores = s.scores.map((v, p) => v + totals[p]);
  s.history.push({ letter: s.letter, answers: s.answers, valid, points: pts, totals });
  if (s.round >= ROUNDS) {
    const [a, b] = s.scores;
    s.finished = { winner: a === b ? null : a > b ? 0 : 1 };
    return;
  }
  s.phase = 'between';
  s.endsAt = Date.now() + BETWEEN_MS;
  scheduleAt(s, ctx, s.endsAt, (st, c) => {
    st.round += 1;
    startRound(st, c);
  });
}

// Stop / Basta: 3 rondas, una letra por ronda, 6 categorías
export default {
  create: () => ({ round: 1, usedLetters: [], scores: [0, 0], history: [], phase: 'starting', timer: 0 }),

  resume(s, ctx) {
    if (s.finished) return;
    if (s.phase === 'starting') return startRound(s, ctx);
    // Tras un reinicio del servidor, re-programamos la fase actual
    if (s.phase === 'writing') scheduleAt(s, ctx, Math.max(Date.now() + 1000, s.endsAt), (st) => toReview(st));
    if (s.phase === 'basta') scheduleAt(s, ctx, Date.now() + 1000, (st) => toReview(st));
    if (s.phase === 'between') scheduleAt(s, ctx, Date.now() + 1000, (st, c) => {
      st.round += 1;
      startRound(st, c);
    });
  },

  act(s, idx, action, ctx) {
    const type = action?.type;
    if (type === 'answers') {
      if (s.phase !== 'writing' && s.phase !== 'basta') throw bad('Ya no se puede escribir');
      if (!Array.isArray(action.answers)) throw bad('Respuestas inválidas');
      s.answers[idx] = STOP_CATEGORIES.map((_, k) => String(action.answers[k] ?? '').slice(0, 30));
      return;
    }
    if (type === 'basta') {
      if (s.phase !== 'writing') return;
      if (Array.isArray(action.answers)) s.answers[idx] = STOP_CATEGORIES.map((_, k) => String(action.answers[k] ?? '').slice(0, 30));
      if (s.answers[idx].some((a) => !a.trim())) throw bad('Llena todas las categorías antes de decir ¡Basta!');
      s.phase = 'basta';
      s.bastaBy = idx;
      s.endsAt = Date.now() + BASTA_MS;
      scheduleAt(s, ctx, s.endsAt, (st) => toReview(st));
      return;
    }
    if (type === 'review') {
      if (s.phase !== 'review') throw bad('Todavía no es momento de revisar');
      // Cada uno revisa las respuestas de su pareja y marca las que no valen
      const other = 1 - idx;
      s.rejected[other] = STOP_CATEGORIES.map((_, k) => Boolean(action.rejected?.[k]));
      s.confirmed[idx] = true;
      if (s.confirmed[0] && s.confirmed[1]) score(s, ctx);
      return;
    }
    throw bad('Jugada inválida');
  },

  view(s, idx) {
    const reveal = s.phase === 'review' || s.phase === 'between' || Boolean(s.finished);
    return {
      round: s.round,
      rounds: ROUNDS,
      letter: s.letter,
      phase: s.phase,
      endsAt: s.endsAt,
      serverNow: Date.now(),
      categories: STOP_CATEGORIES,
      myAnswers: s.answers?.[idx] ?? empty(),
      opponentFilled: s.answers ? s.answers[1 - idx].filter((a) => a.trim()).length : 0,
      opponentAnswers: reveal ? s.answers[1 - idx] : null,
      myRejectedByOther: reveal ? s.rejected[idx] : null,
      confirmed: s.confirmed ?? [false, false],
      bastaBy: s.bastaBy,
      scores: s.scores,
      history: s.history,
    };
  },

  detail: (s, idx) => `${s.scores[idx]} puntos contra ${s.scores[1 - idx]}`,
};
