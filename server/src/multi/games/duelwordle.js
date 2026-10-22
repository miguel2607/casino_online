import { bad } from '../../errors.js';
import { checkGuess, pickWord, wordleFeedback } from '../../games/skill/defs.js';

const TRIES = 6;
const DURATION_MS = 5 * 60 * 1000;

function finish(s) {
  const solved = s.guesses.map((g) => g.some((x) => x.word === s.answer));
  const tries = s.guesses.map((g) => g.length);
  let winner = null;
  if (solved[0] && solved[1]) {
    winner = tries[0] !== tries[1] ? (tries[0] < tries[1] ? 0 : 1) : s.solvedAt[0] <= s.solvedAt[1] ? 0 : 1;
  } else if (solved[0] || solved[1]) winner = solved[0] ? 0 : 1;
  s.finished = { winner };
}

// Duelo de Wordle: la misma palabra para los dos; gana quien la adivine en menos intentos
export default {
  create: () => ({ answer: pickWord(), guesses: [[], []], solvedAt: [null, null], deadline: Date.now() + DURATION_MS }),

  resume(s, ctx) {
    if (s.finished) return;
    if (Date.now() >= s.deadline) finish(s);
    else ctx.schedule(s.deadline - Date.now(), finish);
  },

  act(s, idx, action) {
    if (action?.type !== 'guess') throw bad('Jugada inválida');
    const mine = s.guesses[idx];
    if (s.solvedAt[idx] || mine.length >= TRIES) throw bad('Ya terminaste, espera a tu pareja');
    const word = checkGuess(action.word);
    mine.push({ word, feedback: wordleFeedback(s.answer, word) });
    if (word === s.answer) s.solvedAt[idx] = Date.now();
    const done = (i) => Boolean(s.solvedAt[i]) || s.guesses[i].length >= TRIES;
    if (done(0) && done(1)) finish(s);
  },

  view: (s, idx) => ({
    tries: TRIES,
    myGuesses: s.guesses[idx],
    // De la pareja solo se ven los colores, no las letras
    opponentRows: s.guesses[1 - idx].map((g) => g.feedback),
    solved: s.solvedAt.map(Boolean),
    answer: s.finished ? s.answer : undefined,
    deadline: s.deadline,
    serverNow: Date.now(),
  }),

  detail: (s, idx) => {
    const n = s.guesses[idx].length;
    return s.solvedAt[idx] ? `Adivinó ${s.answer} en ${n} intento${n === 1 ? '' : 's'}` : `No adivinó ${s.answer}`;
  },
};
