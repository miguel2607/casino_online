import { bad } from '../../errors.js';
import { newDeck } from '../../games/common.js';
import { handValue } from '../../games/blackjack.js';

const total = (cards) => handValue(cards).total;
const isBlackjack = (cards) => cards.length === 2 && total(cards) === 21;

/** Juega el crupier y calcula el resultado de cada jugador contra él. */
function playDealer(s) {
  const alive = s.status.some((st) => st === 'stand');
  if (alive) while (total(s.dealer) < 17) s.dealer.push(s.deck.pop());
  const d = total(s.dealer);
  const dealerBJ = isBlackjack(s.dealer);
  s.results = s.hands.map((hand, i) => {
    const st = s.status[i];
    if (st === 'bust') return 'lose';
    if (st === 'blackjack') return dealerBJ ? 'push' : 'blackjack';
    if (dealerBJ) return 'lose';
    const p = total(hand);
    if (d > 21 || p > d) return 'win';
    return p === d ? 'push' : 'lose';
  });
  s.turn = 'done';
  s.finished = { winner: null, table: true };
}

function advance(s) {
  const next = [0, 1].find((i) => s.status[i] === 'playing');
  if (next === undefined) playDealer(s);
  else s.turn = next;
}

// Los dos juegan contra el crupier en la misma mesa; cada uno gana o pierde su propia apuesta
export default {
  create() {
    const s = { deck: newDeck(6).slice(0, 60), hands: [[], []], dealer: [], status: [], turn: 0, results: null };
    for (let round = 0; round < 2; round++) {
      s.hands[0].push(s.deck.pop());
      s.hands[1].push(s.deck.pop());
      s.dealer.push(s.deck.pop());
    }
    s.status = s.hands.map((h) => (isBlackjack(h) ? 'blackjack' : 'playing'));
    // Si el crupier tiene blackjack la mano termina de inmediato
    if (isBlackjack(s.dealer)) s.status = s.status.map((st) => (st === 'playing' ? 'stand' : st));
    advance(s);
    return s;
  },

  act(s, idx, action) {
    if (s.turn !== idx) throw bad('Es el turno de tu pareja');
    if (action?.type === 'hit') {
      s.hands[idx].push(s.deck.pop());
      const t = total(s.hands[idx]);
      if (t > 21) s.status[idx] = 'bust';
      else if (t === 21) s.status[idx] = 'stand';
      else return;
    } else if (action?.type === 'stand') {
      s.status[idx] = 'stand';
    } else throw bad('Jugada inválida');
    advance(s);
  },

  // Rendirse en la mesa = perder tu propia mano; la partida sigue para el otro
  forfeit(s, idx) {
    s.status[idx] = 'bust';
    if (s.turn !== 'done') advance(s);
  },

  payouts: (s, stake) =>
    s.results.map((r) => (r === 'blackjack' ? stake + Math.floor(stake * 1.5) : r === 'win' ? stake * 2 : r === 'push' ? stake : 0)),

  outcomes: (s) => s.results.map((r) => (r === 'blackjack' || r === 'win' ? 'win' : r === 'push' ? 'push' : 'lose')),

  view(s) {
    const done = s.turn === 'done';
    return {
      hands: s.hands,
      totals: s.hands.map(total),
      status: s.status,
      dealer: done ? s.dealer : [s.dealer[0], { hidden: true }],
      dealerTotal: total(done ? s.dealer : [s.dealer[0]]),
      turn: s.turn,
      results: s.results,
    };
  },

  detail(s, idx) {
    const text = { blackjack: '¡Blackjack!', win: 'Le ganó al crupier', push: 'Empate con el crupier', lose: 'Perdió contra el crupier' };
    return `${text[s.results[idx]]} (${total(s.hands[idx])} vs ${total(s.dealer)})`;
  },
};
