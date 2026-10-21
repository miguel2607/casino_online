import { randomInt } from 'node:crypto';

export { randomInt };

/** Número aleatorio criptográfico en [0, 1). */
export function randomFloat() {
  return randomInt(0, 2 ** 47) / 2 ** 47;
}

export const SUITS = ['S', 'H', 'D', 'C'];

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function newDeck(decks = 1) {
  const deck = [];
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) for (let r = 1; r <= 13; r++) deck.push({ r, s });
  }
  return shuffle(deck);
}

export const randomCard = () => ({ r: randomInt(1, 14), s: SUITS[randomInt(4)] });

/** Elige un elemento según pesos enteros. */
export function weightedPick(items, getWeight = (x) => x.weight) {
  const total = items.reduce((s, x) => s + getWeight(x), 0);
  let roll = randomInt(total);
  for (const item of items) {
    roll -= getWeight(item);
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}
