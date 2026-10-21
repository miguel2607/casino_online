// Motor de Solitario (Klondike) compartido entre cliente y servidor.
// El servidor reproduce la lista de movimientos para validar la victoria.

export const DIFFICULTIES = {
  easy: {
    label: 'Fácil',
    draw: 1,
    maxPasses: null,
    multiplier: 1.5,
    undo: true,
    description: 'Robas 1 carta, mazo ilimitado y puedes deshacer.',
  },
  medium: {
    label: 'Medio',
    draw: 3,
    maxPasses: null,
    multiplier: 3,
    undo: true,
    description: 'Robas 3 cartas, mazo ilimitado y puedes deshacer.',
  },
  hard: {
    label: 'Difícil',
    draw: 3,
    maxPasses: 3,
    multiplier: 5,
    undo: false,
    description: 'Robas 3 cartas, solo 3 vueltas al mazo y sin deshacer.',
  },
};

export const MAX_MOVES = 5000;
const SUITS = ['S', 'H', 'D', 'C'];

export const isRed = (c) => c.s === 'H' || c.s === 'D';
const top = (arr) => arr[arr.length - 1];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deal(seed, difficulty) {
  const cfg = DIFFICULTIES[difficulty];
  if (!cfg) throw new Error(`Dificultad desconocida: ${difficulty}`);
  const rnd = mulberry32(seed);
  const deck = [];
  for (const s of SUITS) for (let r = 1; r <= 13; r++) deck.push({ r, s, up: false });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const tableau = [];
  for (let i = 0; i < 7; i++) {
    const col = [];
    for (let j = 0; j <= i; j++) col.push(deck.pop());
    col[col.length - 1].up = true;
    tableau.push(col);
  }
  return {
    stock: deck,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    passes: 0,
    draw: cfg.draw,
    maxPasses: cfg.maxPasses,
  };
}

const clone = (s) => ({
  ...s,
  stock: s.stock.map((c) => ({ ...c })),
  waste: s.waste.map((c) => ({ ...c })),
  foundations: s.foundations.map((p) => p.map((c) => ({ ...c }))),
  tableau: s.tableau.map((p) => p.map((c) => ({ ...c }))),
});

export const canRecycle = (s) =>
  s.stock.length === 0 && s.waste.length > 0 && (s.maxPasses == null || s.passes + 1 < s.maxPasses);

export function canPlaceOnFoundation(card, pile) {
  const t = top(pile);
  return t ? t.s === card.s && card.r === t.r + 1 : card.r === 1;
}

export function canPlaceOnTableau(card, pile) {
  const t = top(pile);
  return t ? t.up && isRed(t) !== isRed(card) && card.r === t.r - 1 : card.r === 13;
}

/** Cartas que se moverían desde `from` = { p: 'w'|'t'|'f', i, c }. */
export function getCards(s, from) {
  if (!from) return null;
  if (from.p === 'w') return s.waste.length ? [top(s.waste)] : null;
  if (from.p === 'f') {
    const pile = s.foundations[from.i];
    return pile?.length ? [top(pile)] : null;
  }
  if (from.p === 't') {
    const col = s.tableau[from.i];
    const c = from.c;
    if (!col || !Number.isInteger(c) || c < 0 || c >= col.length || !col[c].up) return null;
    return col.slice(c);
  }
  return null;
}

function validTarget(s, cards, to) {
  if (!to || !Number.isInteger(to.i)) return false;
  if (to.p === 'f') {
    const pile = s.foundations[to.i];
    return !!pile && cards.length === 1 && canPlaceOnFoundation(cards[0], pile);
  }
  if (to.p === 't') {
    const pile = s.tableau[to.i];
    return !!pile && canPlaceOnTableau(cards[0], pile);
  }
  return false;
}

/** Devuelve el nuevo estado o null si el movimiento es ilegal. */
export function applyMove(state, move) {
  if (!move || typeof move !== 'object') return null;

  if (move.t === 'd') {
    const s = clone(state);
    if (s.stock.length) {
      const n = Math.min(s.draw, s.stock.length);
      for (let k = 0; k < n; k++) {
        const c = s.stock.pop();
        c.up = true;
        s.waste.push(c);
      }
    } else if (canRecycle(s)) {
      s.stock = s.waste.reverse().map((c) => ({ ...c, up: false }));
      s.waste = [];
      s.passes += 1;
    } else return null;
    return s;
  }

  if (move.t === 'm') {
    const { f, to } = move;
    const cards = getCards(state, f);
    if (!cards) return null;
    if (f.p === to?.p && f.i === to?.i) return null;
    if (!validTarget(state, cards, to)) return null;

    const s = clone(state);
    if (f.p === 'w') s.waste.pop();
    else if (f.p === 'f') s.foundations[f.i].pop();
    else {
      const col = s.tableau[f.i];
      col.splice(f.c);
      if (col.length && !top(col).up) top(col).up = true;
    }
    const dest = to.p === 'f' ? s.foundations[to.i] : s.tableau[to.i];
    dest.push(...cards.map((c) => ({ ...c, up: true })));
    return s;
  }

  return null;
}

export function replay(seed, difficulty, moves) {
  if (!Array.isArray(moves) || moves.length > MAX_MOVES) return null;
  let s = deal(seed, difficulty);
  for (const m of moves) {
    s = applyMove(s, m);
    if (!s) return null;
  }
  return s;
}

export const isWon = (s) => s.foundations.every((p) => p.length === 13);

/** Destinos legales para las cartas en `from`, cimientos primero. */
export function legalTargets(s, from) {
  const cards = getCards(s, from);
  if (!cards) return [];
  const out = [];
  if (cards.length === 1) {
    // Primero un cimiento del mismo palo, luego uno vacío
    const order = [0, 1, 2, 3].sort((a, b) => (s.foundations[b].length > 0) - (s.foundations[a].length > 0));
    for (const i of order) {
      if (from.p === 'f' && from.i === i) continue;
      if (canPlaceOnFoundation(cards[0], s.foundations[i])) {
        out.push({ p: 'f', i });
        break;
      }
    }
  }
  for (let i = 0; i < 7; i++) {
    if (from.p === 't' && from.i === i) continue;
    if (canPlaceOnTableau(cards[0], s.tableau[i])) out.push({ p: 't', i });
  }
  return out;
}

export const canAutoComplete = (s) =>
  !isWon(s) && s.stock.length === 0 && s.waste.length === 0 && s.tableau.every((col) => col.every((c) => c.up));

/** Movimientos para mandar todo a los cimientos (cuando ya no hay cartas ocultas). */
export function autoCompleteMoves(state) {
  const moves = [];
  let s = state;
  for (let guard = 0; guard < 60 && !isWon(s); guard++) {
    let moved = false;
    for (let i = 0; i < 7 && !moved; i++) {
      const col = s.tableau[i];
      if (!col.length) continue;
      const from = { p: 't', i, c: col.length - 1 };
      const target = legalTargets(s, from).find((t) => t.p === 'f');
      if (target) {
        const move = { t: 'm', f: from, to: target };
        s = applyMove(s, move);
        moves.push(move);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return moves;
}
