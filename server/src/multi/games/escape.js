import { bad } from '../../errors.js';
import { randomInt, shuffle } from '../../games/common.js';
import { coop } from './util.js';

// Escape room por turnos: cada uno ve pistas distintas. Solo combinándolas abren los 3 candados.
//  1) Colores: A ve la secuencia, B la marca.
//  2) Símbolos: B tiene la tabla símbolo → número, A ve los símbolos y escribe el código.
//  3) Cables: A tiene el manual, B ve los cables y corta uno.
export const ESCAPE = { totalSec: 240, penaltySec: 20 };
const COLORS = ['red', 'green', 'blue', 'yellow', 'purple', 'orange'];
const SYMBOLS = ['🐟', '🧶', '🌙', '⭐', '🍀', '🔔', '🎀', '🐾'];
const WIRE_COLORS = ['rojo', 'azul', 'amarillo', 'blanco', 'negro'];

/** Reglas del manual de cables (se muestran tal cual a quien lee). */
export const WIRE_RULES = {
  3: [
    'Si no hay ningún cable rojo → corta el segundo cable.',
    'Si no, si el último cable es blanco → corta el último cable.',
    'Si no, si hay más de un cable azul → corta el último cable azul.',
    'Si no → corta el último cable.',
  ],
  4: [
    'Si hay más de un cable rojo → corta el último cable rojo.',
    'Si no, si el último cable es amarillo y no hay rojos → corta el primer cable.',
    'Si no, si hay exactamente un cable azul → corta el primer cable.',
    'Si no, si hay más de un cable amarillo → corta el último cable.',
    'Si no → corta el segundo cable.',
  ],
  5: [
    'Si el último cable es negro → corta el cuarto cable.',
    'Si no, si hay exactamente un cable rojo y más de un amarillo → corta el primer cable.',
    'Si no, si no hay cables negros → corta el segundo cable.',
    'Si no → corta el primer cable.',
  ],
};

export function wireToCut(wires) {
  const count = (c) => wires.filter((w) => w === c).length;
  const last = wires[wires.length - 1];
  const lastOf = (c) => wires.lastIndexOf(c);
  if (wires.length === 3) {
    if (!count('rojo')) return 1;
    if (last === 'blanco') return 2;
    if (count('azul') > 1) return lastOf('azul');
    return 2;
  }
  if (wires.length === 4) {
    if (count('rojo') > 1) return lastOf('rojo');
    if (last === 'amarillo' && !count('rojo')) return 0;
    if (count('azul') === 1) return 0;
    if (count('amarillo') > 1) return 3;
    return 1;
  }
  if (last === 'negro') return 3;
  if (count('rojo') === 1 && count('amarillo') > 1) return 0;
  if (!count('negro')) return 1;
  return 0;
}

function newPuzzles() {
  const colors = Array.from({ length: 5 }, () => COLORS[randomInt(COLORS.length)]);
  const symbols = shuffle([...SYMBOLS]);
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, SYMBOLS.length);
  const table = Object.fromEntries(symbols.map((sym, i) => [sym, digits[i]]));
  const code = shuffle([...SYMBOLS]).slice(0, 4);
  const n = 3 + randomInt(3);
  const wires = Array.from({ length: n }, () => WIRE_COLORS[randomInt(WIRE_COLORS.length)]);
  return { colors, table, code, wires, cut: [] };
}

const timeLeft = (s, now = Date.now()) => Math.max(0, (s.endAt - now) / 1000);
const multiplierOf = (s) => {
  if (s.lock < 3) return 0;
  const left = s.solvedLeft ?? 0;
  return left >= 120 ? 3 : left >= 60 ? 2 : 1.5;
};

export default {
  ...coop(multiplierOf),

  create: () => {
    const a = randomInt(2);
    const startAt = Date.now() + 3000;
    return { roles: [a, 1 - a], puzzles: newPuzzles(), lock: 0, strikes: 0, startAt, endAt: startAt + ESCAPE.totalSec * 1000, flash: null };
  },

  resume(s, ctx) {
    if (s.finished) return;
    const check = (st, c) => {
      if (st.finished) return;
      if (Date.now() >= st.endAt) st.finished = { winner: null, coop: true, success: false };
      else c.schedule(Math.min(5000, st.endAt - Date.now()), check);
    };
    ctx.schedule(Math.max(0, s.endAt - Date.now()), check);
  },

  act(s, idx, action) {
    const now = Date.now();
    // Mensajes cortos para darse las pistas (por si no están en el mismo lugar)
    if (action?.type === 'say') {
      const text = String(action.text ?? '').trim().slice(0, 60);
      if (!text) return;
      s.chat = [...(s.chat || []), { from: idx, text, at: now }].slice(-8);
      return;
    }
    if (now < s.startAt) throw bad('Esperen la cuenta regresiva');
    if (now >= s.endAt) throw bad('Se acabó el tiempo');
    const [A, B] = s.roles;
    const p = s.puzzles;
    const fail = (msg) => {
      s.strikes += 1;
      s.endAt -= ESCAPE.penaltySec * 1000;
      s.flash = { ok: false, text: msg, at: now };
      if (now >= s.endAt) s.finished = { winner: null, coop: true, success: false };
    };
    const pass = (text) => {
      s.lock += 1;
      s.flash = { ok: true, text, at: now };
      if (s.lock >= 3) {
        s.solvedLeft = Math.round(timeLeft(s, now));
        s.finished = { winner: null, coop: true, success: true };
      }
    };

    if (s.lock === 0) {
      if (action?.type !== 'colors' || idx !== B) throw bad('Este candado lo abre tu pareja');
      const seq = Array.isArray(action.colors) ? action.colors.map(String) : [];
      if (seq.length !== p.colors.length) throw bad('Marca los 5 colores');
      if (seq.every((c, i) => c === p.colors[i])) pass('¡Candado de colores abierto! 🔓');
      else fail(`Colores equivocados · −${ESCAPE.penaltySec} s`);
      return;
    }
    if (s.lock === 1) {
      if (action?.type !== 'code' || idx !== A) throw bad('Este candado lo abre tu pareja');
      const code = String(action.code ?? '').replace(/\D/g, '');
      if (code.length !== 4) throw bad('El código tiene 4 números');
      if (code === p.code.map((sym) => p.table[sym]).join('')) pass('¡Candado de símbolos abierto! 🔓');
      else fail(`Código incorrecto · −${ESCAPE.penaltySec} s`);
      return;
    }
    if (s.lock === 2) {
      if (action?.type !== 'cut' || idx !== B) throw bad('Los cables los corta tu pareja');
      const w = Number(action.wire);
      if (!Number.isInteger(w) || w < 0 || w >= p.wires.length || p.cut.includes(w)) throw bad('Elige un cable');
      p.cut.push(w);
      if (w === wireToCut(p.wires)) pass('¡Cable correcto! La puerta se abre 🚪');
      else fail(`¡Chispas! Ese no era · −${ESCAPE.penaltySec} s`);
      return;
    }
    throw bad('Ya escaparon');
  },

  view: (s, idx) => {
    const [A] = s.roles;
    const p = s.puzzles;
    const isA = idx === A;
    return {
      role: isA ? 'A' : 'B',
      lock: s.lock,
      strikes: s.strikes,
      startAt: s.startAt,
      endAt: s.endAt,
      serverNow: Date.now(),
      flash: s.flash,
      penalty: ESCAPE.penaltySec,
      colorOptions: COLORS,
      // Pistas: cada uno ve solo lo suyo
      colors: isA || s.finished ? p.colors : null,
      table: !isA || s.finished ? p.table : null,
      code: isA || s.finished ? p.code : null,
      rules: isA || s.finished ? WIRE_RULES[p.wires.length] : null,
      wires: !isA || s.finished ? p.wires : null,
      wireCount: p.wires.length,
      cut: p.cut,
      chat: (s.chat || []).map((m) => ({ mine: m.from === idx, text: m.text, at: m.at })),
    };
  },

  detail: (s) => (s.lock >= 3 ? `Escaparon con ${s.solvedLeft} s de sobra` : `Abrieron ${s.lock} de 3 candados`),
};
