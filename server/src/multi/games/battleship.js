import { bad } from '../../errors.js';
import { randomInt } from '../../games/common.js';

export const SIZE = 8;
export const FLEET = [4, 3, 3, 2, 2];

function shipCells(ship) {
  return Array.from({ length: ship.len }, (_, k) => (ship.dir === 'h' ? [ship.r, ship.c + k] : [ship.r + k, ship.c]));
}

function validateFleet(raw) {
  if (!Array.isArray(raw) || raw.length !== FLEET.length) throw bad('Tienes que colocar los 5 barcos');
  const lens = raw.map((s) => Number(s?.len)).sort();
  if (lens.join() !== [...FLEET].sort().join()) throw bad('La flota no es correcta');
  const taken = new Set();
  return raw.map((s) => {
    const ship = { r: Number(s.r), c: Number(s.c), len: Number(s.len), dir: s.dir === 'v' ? 'v' : 'h', hits: [] };
    for (const [r, c] of shipCells(ship)) {
      if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= SIZE || c >= SIZE) throw bad('Un barco se sale del tablero');
      if (taken.has(`${r},${c}`)) throw bad('Dos barcos no pueden ocupar la misma casilla');
      taken.add(`${r},${c}`);
    }
    return ship;
  });
}

const isSunk = (ship) => ship.hits.length === ship.len;

export default {
  create: () => ({ phase: 'placing', fleets: [null, null], shots: [[], []], turn: randomInt(2) }),

  act(s, idx, action) {
    if (action?.type === 'place') {
      if (s.phase !== 'placing') throw bad('La batalla ya empezó');
      s.fleets[idx] = validateFleet(action.ships);
      if (s.fleets[0] && s.fleets[1]) s.phase = 'battle';
      return;
    }
    if (action?.type !== 'shoot') throw bad('Jugada inválida');
    if (s.phase !== 'battle') throw bad('Esperen a que los dos coloquen su flota');
    if (s.turn !== idx) throw bad('Es el turno de tu pareja');
    const r = Number(action.r);
    const c = Number(action.c);
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= SIZE || c >= SIZE) throw bad('Casilla inválida');
    if (s.shots[idx].some((x) => x.r === r && x.c === c)) throw bad('Ya disparaste ahí');

    const enemy = s.fleets[1 - idx];
    const ship = enemy.find((sh) => shipCells(sh).some(([rr, cc]) => rr === r && cc === c));
    if (ship) ship.hits.push([r, c]);
    s.shots[idx].push({ r, c, hit: Boolean(ship), sunk: Boolean(ship && isSunk(ship)) });
    s.last = { by: idx, r, c, hit: Boolean(ship), sunk: Boolean(ship && isSunk(ship)) };
    if (enemy.every(isSunk)) s.finished = { winner: idx };
    else s.turn = 1 - idx;
  },

  view(s, idx) {
    const enemy = s.fleets[1 - idx];
    return {
      size: SIZE,
      fleet: FLEET,
      phase: s.phase,
      turn: s.turn,
      myFleet: s.fleets[idx],
      placed: [Boolean(s.fleets[0]), Boolean(s.fleets[1])],
      myShots: s.shots[idx],
      enemyShots: s.shots[1 - idx],
      // Del enemigo solo se ven los barcos ya hundidos
      enemySunk: enemy ? enemy.filter(isSunk).map(({ r, c, len, dir }) => ({ r, c, len, dir })) : [],
      sunkCounts: [0, 1].map((i) => (s.fleets[1 - i] ? s.fleets[1 - i].filter(isSunk).length : 0)),
      last: s.last ?? null,
    };
  },

  detail: (s, idx) => `Hundiste ${s.fleets[1 - idx] ? s.fleets[1 - idx].filter(isSunk).length : 0} de ${FLEET.length} barcos`,
};
