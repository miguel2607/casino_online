import { bad } from '../../errors.js';

const CHOICES = ['rock', 'paper', 'scissors'];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

// Piedra, papel o tijera al mejor de 3 (gana quien llegue a 2)
export default {
  create: () => ({ target: 2, scores: [0, 0], choices: [null, null], rounds: [] }),

  act(s, idx, action) {
    if (action?.type !== 'choose' || !CHOICES.includes(action.choice)) throw bad('Jugada inválida');
    if (s.choices[idx]) throw bad('Ya elegiste, espera a tu pareja');
    s.choices[idx] = action.choice;
    if (!s.choices[0] || !s.choices[1]) return;

    const [a, b] = s.choices;
    const winner = a === b ? null : BEATS[a] === b ? 0 : 1;
    if (winner !== null) s.scores[winner] += 1;
    s.rounds.push({ choices: [a, b], winner });
    s.choices = [null, null];
    if (winner !== null && s.scores[winner] >= s.target) s.finished = { winner };
  },

  view: (s, idx) => ({
    target: s.target,
    scores: s.scores,
    myChoice: s.choices[idx],
    opponentChose: Boolean(s.choices[1 - idx]),
    rounds: s.rounds,
  }),

  detail: (s, idx) => `${s.scores[idx]} a ${s.scores[1 - idx]}`,
};
