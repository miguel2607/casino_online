import { bad } from '../../errors.js';
import { randomInt, shuffle } from '../../games/common.js';
import { DRAW_WORDS } from '../../../../shared/words.js';
import { normalizeWord } from '../../../../shared/rng.js';
import { coop, scheduleAt, tier } from './util.js';

const ROUNDS = 4;
const CHOOSE_MS = 20000;
const DRAW_MS = 80000;
const BETWEEN_MS = 3500;
const MAX_POINTS = 30000;

const multiplier = (s) => tier(s.correct.filter(Boolean).length, [
  [4, 3],
  [3, 2],
  [2, 1],
]);

function startRound(s, ctx) {
  s.phase = 'choosing';
  s.drawer = (s.firstDrawer + s.round - 1) % 2;
  s.options = shuffle([...DRAW_WORDS]).slice(0, 3);
  s.word = null;
  s.strokes = [];
  s.points = 0;
  s.guesses = [];
  s.endsAt = Date.now() + CHOOSE_MS;
  scheduleAt(s, ctx, s.endsAt, (st, c) => beginDrawing(st, c, st.options[0]));
}

function beginDrawing(s, ctx, word) {
  s.word = word;
  s.phase = 'drawing';
  s.endsAt = Date.now() + DRAW_MS;
  scheduleAt(s, ctx, s.endsAt, (st, c) => endRound(st, c, false));
}

function endRound(s, ctx, guessed) {
  s.correct.push(guessed);
  s.phase = 'between';
  s.reveal = s.word;
  if (s.round >= ROUNDS) {
    s.finished = { winner: null, coop: true, success: multiplier(s) > 1 };
    return;
  }
  s.endsAt = Date.now() + BETWEEN_MS;
  scheduleAt(s, ctx, s.endsAt, (st, c) => {
    st.round += 1;
    startRound(st, c);
  });
}

// Dibuja y adivina: uno dibuja y el otro adivina; se turnan durante 4 rondas
export default {
  ...coop(multiplier),

  create: () => ({ round: 1, firstDrawer: randomInt(2), correct: [], phase: 'starting', timer: 0 }),

  resume(s, ctx) {
    if (s.finished) return;
    if (s.phase === 'starting' || s.phase === 'choosing') return startRound(s, ctx);
    if (s.phase === 'drawing') scheduleAt(s, ctx, Math.max(Date.now() + 1000, s.endsAt), (st, c) => endRound(st, c, false));
    if (s.phase === 'between') scheduleAt(s, ctx, Date.now() + 1000, (st, c) => {
      st.round += 1;
      startRound(st, c);
    });
  },

  act(s, idx, action, ctx) {
    if (action?.type === 'choose') {
      if (s.phase !== 'choosing' || idx !== s.drawer) throw bad('No te toca elegir');
      if (!s.options.includes(action.word)) throw bad('Palabra inválida');
      beginDrawing(s, ctx, action.word);
      return;
    }
    if (action?.type === 'guess') {
      if (s.phase !== 'drawing' || idx === s.drawer) throw bad('Ahora no puedes adivinar');
      const text = String(action.text ?? '').trim().slice(0, 40);
      if (!text) return;
      const ok = normalizeWord(text) === normalizeWord(s.word);
      s.guesses.push({ text, ok });
      if (ok) endRound(s, ctx, true);
      return;
    }
    throw bad('Jugada inválida');
  },

  // Los trazos van por pulsos: se guardan en memoria y se reenvían a quien adivina
  pulse(s, idx, data) {
    if (s.phase !== 'drawing' || idx !== s.drawer) return null;
    if (data.type === 'clear') {
      s.strokes = [];
      s.points = 0;
      return { type: 'clear' };
    }
    if (data.type !== 'stroke' || !Array.isArray(data.points)) return null;
    const pts = data.points
      .slice(0, 200)
      .map((p) => [Math.round(Number(p[0]) * 1000) / 1000, Math.round(Number(p[1]) * 1000) / 1000])
      .filter(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1);
    if (!pts.length || s.points + pts.length > MAX_POINTS) return null;
    const stroke = { id: String(data.id).slice(0, 20), color: /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : '#2b2238', size: Math.min(24, Math.max(2, Number(data.size) || 6)), points: pts };
    const existing = s.strokes.find((st) => st.id === stroke.id);
    if (existing) existing.points.push(...pts);
    else s.strokes.push(stroke);
    s.points += pts.length;
    return { type: 'stroke', ...stroke };
  },

  view(s, idx) {
    const drawing = idx === s.drawer;
    return {
      round: s.round,
      rounds: ROUNDS,
      phase: s.phase,
      drawer: s.drawer,
      options: drawing && s.phase === 'choosing' ? s.options : null,
      word: drawing || s.phase === 'between' || s.finished ? s.word : null,
      wordLength: s.word ? [...s.word].length : null,
      lastWord: s.reveal ?? null,
      endsAt: s.endsAt,
      serverNow: Date.now(),
      strokes: s.strokes ?? [],
      guesses: s.guesses ?? [],
      correct: s.correct,
    };
  },

  detail: (s) => `Adivinaron ${s.correct.filter(Boolean).length} de ${ROUNDS} dibujos`,
};
