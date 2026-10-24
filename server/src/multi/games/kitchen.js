import { randomInt } from '../../games/common.js';
import { arena, presses, round, stick } from './arena.js';
import { coop, tier } from './util.js';

// Cocina de michis (estilo Overcooked): un mesón divide la cocina. A la izquierda están los
// ingredientes; a la derecha los platos y la ventanilla. Hay que pasarse cosas por el mesón.
//  . piso · W pared · C mesón · K tabla de picar · P platos · S ventanilla · X basura
//  F pescado · R arroz · L lechuga · T tomate · A alga
export const LAYOUT = [
  'WFRLWCWKKPW',
  'T....C....S',
  'A....C....S',
  'C....C....W',
  'W....C....X',
  'C....C....C',
  'WCKCWCWCCKW',
];
const COLS = LAYOUT[0].length;
const ROWS = LAYOUT.length;
const BINS = { F: 'fish', R: 'rice', L: 'lettuce', T: 'tomato', A: 'seaweed' };
const NEEDS_CHOP = ['fish', 'lettuce', 'tomato'];
export const RECIPES = {
  sushi: { parts: ['fish', 'rice'], e: '🍣', life: 55 },
  onigiri: { parts: ['rice', 'seaweed'], e: '🍙', life: 50 },
  salad: { parts: ['lettuce', 'tomato'], e: '🥗', life: 55 },
  maki: { parts: ['fish', 'rice', 'seaweed'], e: '🍱', life: 65 },
};
export const KITCHEN = { gameSec: 180, speed: 3.6, radius: 0.32, chopSec: 1.4, maxOrders: 4 };
const TABLE = [
  [200, 3],
  [140, 2],
  [90, 1],
];

const cellAt = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? 'W' : LAYOUT[y][x]);
const solid = (x, y) => cellAt(x, y) !== '.';
const k = (x, y) => `${x},${y}`;
const ready = (it) => it && it.i !== 'plate' && (!NEEDS_CHOP.includes(it.i) || it.c);

const sorted = (a) => [...a].sort().join('+');
function fitsSomeRecipe(parts) {
  return Object.values(RECIPES).some((r) => {
    const left = [...r.parts];
    for (const p of parts) {
      const j = left.indexOf(p);
      if (j === -1) return false;
      left.splice(j, 1);
    }
    return true;
  });
}
const canAdd = (plate, ing) => ready(ing) && fitsSomeRecipe([...plate.parts, ing.i]);
const recipeOf = (plate) => Object.entries(RECIPES).find(([, r]) => sorted(r.parts) === sorted(plate.parts))?.[0] ?? null;

function overlaps(x, y, r) {
  for (let cy = Math.floor(y - r); cy <= Math.floor(y + r); cy++) {
    for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) {
      if (!solid(cx, cy)) continue;
      const nx = Math.max(cx, Math.min(x, cx + 1));
      const ny = Math.max(cy, Math.min(y, cy + 1));
      if ((x - nx) ** 2 + (y - ny) ** 2 < r * r) return true;
    }
  }
  return false;
}

/** Casilla con la que interactúa el michi: la que tiene enfrente, o la estación más cercana. */
function targetOf(p) {
  const fx = Math.floor(p.x + p.fx * 0.85);
  const fy = Math.floor(p.y + p.fy * 0.85);
  if (cellAt(fx, fy) !== '.' && cellAt(fx, fy) !== 'W') return [fx, fy];
  let best = null;
  let bestD = 1.25;
  const cx = Math.floor(p.x);
  const cy = Math.floor(p.y);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = cellAt(cx + dx, cy + dy);
    if (c === '.' || c === 'W') continue;
    const d = Math.hypot(cx + dx + 0.5 - p.x, cy + dy + 0.5 - p.y);
    if (d < bestD) {
      best = [cx + dx, cy + dy];
      bestD = d;
    }
  }
  return best;
}

function newOrder(s, now) {
  const names = Object.keys(RECIPES);
  // Los primeros pedidos son más simples
  const pool = s.served < 2 ? names.filter((n) => n !== 'maki') : names;
  const r = pool[randomInt(pool.length)];
  s.orders.push({ id: s.nextId++, r, at: now, until: now + RECIPES[r].life * 1000 });
}

function flash(s, text, now, good = true) {
  s.flash = { text, at: now, good };
}

function interact(s, p, now) {
  const t = targetOf(p);
  if (!t) return;
  const [tx, ty] = t;
  const cell = cellAt(tx, ty);
  const key = k(tx, ty);
  const onCell = s.cells[key] || null;
  const hold = p.hold;

  if (BINS[cell]) {
    if (!hold) p.hold = { i: BINS[cell], c: 0, p: 0 };
    else if (hold.i === 'plate' && canAdd(hold, { i: BINS[cell], c: 0 })) hold.parts.push(BINS[cell]);
    return;
  }
  if (cell === 'P') {
    if (!hold) p.hold = { i: 'plate', parts: [] };
    else if (hold.i !== 'plate' && ready(hold)) p.hold = { i: 'plate', parts: [hold.i] };
    return;
  }
  if (cell === 'X') {
    if (hold?.i === 'plate') hold.parts = [];
    else p.hold = null;
    return;
  }
  if (cell === 'S') {
    if (hold?.i !== 'plate' || !hold.parts.length) return;
    const r = recipeOf(hold);
    const order = r && s.orders.find((o) => o.r === r);
    if (order) {
      const left = Math.max(0, (order.until - now) / (RECIPES[r].life * 1000));
      const pts = 20 + Math.ceil(left * 10) + (r === 'maki' ? 10 : 0);
      s.score += pts;
      s.served += 1;
      s.orders = s.orders.filter((o) => o !== order);
      flash(s, `${RECIPES[r].e} +${pts}`, now);
    } else {
      flash(s, 'Nadie pidió eso 😿', now, false);
    }
    p.hold = null;
    return;
  }
  // Mesón o tabla
  if (!hold) {
    if (onCell) {
      p.hold = onCell;
      delete s.cells[key];
    }
    return;
  }
  if (!onCell) {
    s.cells[key] = hold;
    p.hold = null;
    return;
  }
  if (onCell.i === 'plate' && hold.i !== 'plate' && canAdd(onCell, hold)) {
    onCell.parts.push(hold.i);
    p.hold = null;
  } else if (hold.i === 'plate' && onCell.i !== 'plate' && canAdd(hold, onCell)) {
    hold.parts.push(onCell.i);
    delete s.cells[key];
  }
}

export default arena({
  ...coop((s) => tier(s.score, TABLE)),
  init: () => ({
    players: [
      { x: 2.5, y: 3.5, fx: 1, fy: 0, sx: 0, sy: 0, hold: null, taps: 0, want: false, chop: false },
      { x: 7.5, y: 3.5, fx: -1, fy: 0, sx: 0, sy: 0, hold: null, taps: 0, want: false, chop: false },
    ],
    cells: {},
    orders: [],
    score: 0,
    served: 0,
    missed: 0,
    nextId: 1,
    nextOrderAt: 0,
    flash: null,
  }),

  input(s, idx, data) {
    const p = s.players[idx];
    const { x, y } = stick(data);
    p.sx = x;
    p.sy = y;
    const [n, taps] = presses(p.taps, data.grab);
    p.taps = n;
    if (taps) p.want = true;
    p.chop = Boolean(data.chopHeld);
  },

  step(s, dt, now) {
    const elapsed = (now - s.startAt) / 1000;
    if (!s.nextOrderAt) {
      newOrder(s, now);
      newOrder(s, now);
      s.nextOrderAt = now + 16000;
    }
    if (now >= s.nextOrderAt && s.orders.length < KITCHEN.maxOrders) {
      newOrder(s, now);
      s.nextOrderAt = now + Math.max(10000, 16000 - elapsed * 40);
    }
    for (const o of s.orders) {
      if (o.until <= now) {
        s.score = Math.max(0, s.score - 5);
        s.missed += 1;
        flash(s, `Se fue un cliente 😿 −5`, now, false);
      }
    }
    s.orders = s.orders.filter((o) => o.until > now);

    for (const p of s.players) {
      const mag = Math.hypot(p.sx, p.sy);
      if (mag > 0.2) {
        // Mirar hacia el eje dominante (así es claro con qué estación interactúas)
        if (Math.abs(p.sx) >= Math.abs(p.sy)) [p.fx, p.fy] = [Math.sign(p.sx), 0];
        else [p.fx, p.fy] = [0, Math.sign(p.sy)];
        const nx = p.x + p.sx * KITCHEN.speed * dt;
        if (!overlaps(nx, p.y, KITCHEN.radius)) p.x = nx;
        const ny = p.y + p.sy * KITCHEN.speed * dt;
        if (!overlaps(p.x, ny, KITCHEN.radius)) p.y = ny;
      }
      if (p.want) interact(s, p, now);
      p.want = false;
      if (p.chop) {
        const t = targetOf(p);
        const it = t && cellAt(t[0], t[1]) === 'K' ? s.cells[k(t[0], t[1])] : null;
        if (it && it.i !== 'plate' && NEEDS_CHOP.includes(it.i) && !it.c) {
          it.p = Math.min(1, (it.p || 0) + dt / KITCHEN.chopSec);
          if (it.p >= 1) it.c = 1;
          p.chopping = true;
        } else p.chopping = false;
      } else p.chopping = false;
    }

    if (elapsed >= KITCHEN.gameSec) s.finished = { winner: null, coop: true, success: tier(s.score, TABLE) > 1 };
  },

  snapshot: (s) => {
    const now = Date.now();
    return {
      p: s.players.map((p) => [round(p.x), round(p.y), p.fx, p.fy, p.hold, p.chopping ? 1 : 0, targetOf(p)]),
      cells: s.cells,
      o: s.orders.map((o) => [o.id, o.r, Math.max(0, Math.round((o.until - now) / 1000)), RECIPES[o.r].life]),
      sc: s.score,
      tl: Math.max(0, Math.round(KITCHEN.gameSec - (Math.max(now, s.startAt) - s.startAt) / 1000)),
      fl: s.flash && now - s.flash.at < 1600 ? s.flash : null,
    };
  },

  view: () => ({ layout: LAYOUT, recipes: RECIPES, table: TABLE, kitchen: KITCHEN }),

  detail: (s) => `${s.score} puntos · ${s.served} pedidos entregados`,
});
