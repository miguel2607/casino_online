import { arena, clamp, num, round } from './arena.js';

// Air Hockey de michis: cada uno defiende su arco. Mesa de 1 × 1,6; el jugador 0 defiende abajo.
export const AH = { W: 1, H: 1.6, mallet: 0.075, puck: 0.045, goal: 0.38, maxPuck: 3.4, malletSpeed: 4.2, target: 5 };
const FRICTION = 0.35; // pérdida de velocidad por segundo (fracción)
const PAUSE_MS = 1200;

const halfY = (idx) => (idx === 0 ? [AH.H / 2 + AH.mallet, AH.H - AH.mallet] : [AH.mallet, AH.H / 2 - AH.mallet]);

function servePuck(s, toward) {
  // El disco sale del lado de quien recibió el gol
  s.puck = { x: 0.5, y: toward === 0 ? AH.H * 0.62 : AH.H * 0.38, vx: 0, vy: 0 };
  s.pauseUntil = Date.now() + PAUSE_MS;
}

function collideMallet(s, m) {
  const p = s.puck;
  const dx = p.x - m.x;
  const dy = p.y - m.y;
  const d = Math.hypot(dx, dy);
  const min = AH.mallet + AH.puck;
  if (d >= min || d === 0) return;
  const nx = dx / d;
  const ny = dy / d;
  p.x = m.x + nx * min;
  p.y = m.y + ny * min;
  const rvx = p.vx - m.vx;
  const rvy = p.vy - m.vy;
  const along = rvx * nx + rvy * ny;
  if (along < 0) {
    p.vx -= 1.9 * along * nx;
    p.vy -= 1.9 * along * ny;
  }
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > AH.maxPuck) {
    p.vx *= AH.maxPuck / sp;
    p.vy *= AH.maxPuck / sp;
  }
}

export default arena({
  init: () => ({
    mallets: [
      { x: 0.5, y: AH.H * 0.85, vx: 0, vy: 0, tx: 0.5, ty: AH.H * 0.85 },
      { x: 0.5, y: AH.H * 0.15, vx: 0, vy: 0, tx: 0.5, ty: AH.H * 0.15 },
    ],
    // Empieza en el lado de uno de los dos (en la línea del medio nadie lo alcanza bien)
    puck: { x: 0.5, y: Math.random() < 0.5 ? AH.H * 0.62 : AH.H * 0.38, vx: 0, vy: 0 },
    scores: [0, 0],
    pauseUntil: 0,
    lastGoal: null,
  }),

  // El celular manda dónde está su dedo, en su propia vista (su arco siempre abajo)
  input(s, idx, data) {
    let x = num(data.x, 0, AH.W, s.mallets[idx].tx);
    let y = num(data.y, 0, AH.H, s.mallets[idx].ty);
    if (idx === 1) {
      x = AH.W - x;
      y = AH.H - y;
    }
    s.mallets[idx].tx = x;
    s.mallets[idx].ty = y;
  },

  step(s, dt, now) {
    s.mallets.forEach((m, idx) => {
      const [y0, y1] = halfY(idx);
      const tx = clamp(m.tx, AH.mallet, AH.W - AH.mallet);
      const ty = clamp(m.ty, y0, y1);
      const dx = tx - m.x;
      const dy = ty - m.y;
      const d = Math.hypot(dx, dy);
      const maxStep = AH.malletSpeed * dt;
      const k = d > maxStep ? maxStep / d : 1;
      m.vx = dt ? (dx * k) / dt : 0;
      m.vy = dt ? (dy * k) / dt : 0;
      m.x += dx * k;
      m.y += dy * k;
    });

    if (now < s.pauseUntil) {
      s.mallets.forEach((m) => collideMallet(s, m));
      return;
    }

    const p = s.puck;
    const steps = 6;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      p.x += p.vx * h;
      p.y += p.vy * h;
      if (p.x < AH.puck) {
        p.x = AH.puck;
        p.vx = Math.abs(p.vx) * 0.9;
      } else if (p.x > AH.W - AH.puck) {
        p.x = AH.W - AH.puck;
        p.vx = -Math.abs(p.vx) * 0.9;
      }
      const inMouth = Math.abs(p.x - AH.W / 2) < AH.goal / 2;
      if (p.y < AH.puck && !inMouth) {
        p.y = AH.puck;
        p.vy = Math.abs(p.vy) * 0.9;
      } else if (p.y > AH.H - AH.puck && !inMouth) {
        p.y = AH.H - AH.puck;
        p.vy = -Math.abs(p.vy) * 0.9;
      }
      s.mallets.forEach((m) => collideMallet(s, m));
      // Gol: el disco cruzó por completo la línea de fondo
      if (p.y < -AH.puck || p.y > AH.H + AH.puck) {
        const scorer = p.y < 0 ? 0 : 1;
        s.scores[scorer] += 1;
        s.lastGoal = { by: scorer, at: now };
        if (s.scores[scorer] >= AH.target) {
          s.finished = { winner: scorer };
          return;
        }
        servePuck(s, 1 - scorer);
        return;
      }
    }
    const f = Math.max(0, 1 - FRICTION * dt);
    p.vx *= f;
    p.vy *= f;

    // Disco casi quieto mucho rato (p. ej. en la línea del medio): se vuelve a sacar
    if (Math.hypot(p.vx, p.vy) < 0.06) {
      s.stillSince = s.stillSince || now;
      if (now - s.stillSince > 2500) {
        servePuck(s, (s.ticks || 0) % 2);
        s.stillSince = 0;
      }
    } else s.stillSince = 0;
  },

  timeout: (s) => ({ winner: s.scores[0] === s.scores[1] ? null : s.scores[0] > s.scores[1] ? 0 : 1 }),
  maxMs: 4 * 60 * 1000,

  snapshot: (s) => ({
    p: [round(s.puck.x, 1000), round(s.puck.y, 1000)],
    m: s.mallets.map((m) => [round(m.x, 1000), round(m.y, 1000)]),
    sc: s.scores,
    pause: s.pauseUntil > Date.now(),
    goal: s.lastGoal,
  }),

  view: () => ({ table: AH, maxMs: 4 * 60 * 1000 }),

  detail: (s, idx) => `${s.scores[idx]} a ${s.scores[1 - idx]}`,
});
