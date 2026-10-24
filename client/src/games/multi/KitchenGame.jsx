import { useRef } from 'react';
import { ActionButton, ArenaCanvas, ArenaCountdown, Controls, Joystick, drawCat, ease, emoji, useArena, useArenaHud, useInputSender } from './arena/arena.jsx';

const ING = { fish: '🐟', rice: '🍚', lettuce: '🥬', tomato: '🍅', seaweed: '🟩' };
const STATION = {
  F: { e: '🐟', bg: '#3d6fd8' },
  R: { e: '🍚', bg: '#c9b88a' },
  L: { e: '🥬', bg: '#3f9a4f' },
  T: { e: '🍅', bg: '#c43a5a' },
  A: { e: '🟩', bg: '#1f5f4a' },
  K: { e: '🔪', bg: '#a07444' },
  P: { e: '🍽️', bg: '#e6dccb' },
  S: { e: '🛎️', bg: '#ffcf5a' },
  X: { e: '🗑️', bg: '#5b5470' },
};
const NAME = { fish: 'pescado', rice: 'arroz', lettuce: 'lechuga', tomato: 'tomate', seaweed: 'alga' };

function drawItem(ctx, it, x, y, size) {
  if (!it) return;
  if (it.i === 'plate') {
    ctx.fillStyle = '#f4f1ea';
    ctx.strokeStyle = '#b8ad9a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.5, size * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    it.parts.forEach((p, j) => emoji(ctx, ING[p], x + (j - (it.parts.length - 1) / 2) * size * 0.32, y, size * 0.42));
    return;
  }
  emoji(ctx, ING[it.i], x, y, size * 0.7);
  // Picado: marca verde
  if (it.c) {
    ctx.fillStyle = '#4fe3b0';
    ctx.font = `bold ${Math.round(size * 0.3)}px sans-serif`;
    ctx.fillText('✓', x + size * 0.32, y - size * 0.28);
  }
  if (!it.c && it.p > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - size * 0.4, y + size * 0.36, size * 0.8, 5);
    ctx.fillStyle = '#4fe3b0';
    ctx.fillRect(x - size * 0.4, y + size * 0.36, size * 0.8 * it.p, 5);
  }
}

/** Cocina de michis: preparen los pedidos pasándose ingredientes por el mesón del medio. */
export default function KitchenGame({ match, pulse, onPulse, colors }) {
  const { me, state } = match;
  const L = state.layout;
  const cols = L[0].length;
  const rows = L.length;
  const active = match.status === 'active';
  const arena = useArena(onPulse, state.snap);
  const input = useRef({ x: 0, y: 0, grab: 0, chopHeld: false });
  const shown = useRef([{}, {}]);
  useInputSender(pulse, input, active);

  const hud = useArenaHud(arena, (snap) => ({ sc: snap.sc, tl: snap.tl, o: snap.o, hold: snap.p[me][4], fl: snap.fl }), 200);

  const draw = (ctx, w, h, dt) => {
    const snap = arena.current.snap;
    const c = w / cols;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const ch = L[y][x];
        const px = x * c;
        const py = y * c;
        if (ch === '.') {
          ctx.fillStyle = (x + y) % 2 ? '#efe3cf' : '#e5d6bd';
          ctx.fillRect(px, py, c, c);
        } else if (ch === 'W') {
          ctx.fillStyle = '#4a3b5e';
          ctx.fillRect(px, py, c, c);
        } else {
          ctx.fillStyle = ch === 'C' ? '#8a6a4a' : STATION[ch].bg;
          ctx.fillRect(px, py, c, c);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, c - 2, c - 2);
          if (STATION[ch] && !snap.cells[`${x},${y}`]) {
            ctx.globalAlpha = 0.85;
            emoji(ctx, STATION[ch].e, px + c / 2, py + c / 2, c * 0.55);
            ctx.globalAlpha = 1;
          }
        }
      }
    }
    for (const [key, it] of Object.entries(snap.cells)) {
      const [x, y] = key.split(',').map(Number);
      drawItem(ctx, it, (x + 0.5) * c, (y + 0.5) * c, c);
    }
    snap.p.forEach((p, i) => {
      const d = shown.current[i];
      d.x = ease(d.x, p[0], dt, 18);
      d.y = ease(d.y, p[1], dt, 18);
      // Resalta la estación con la que interactúa (solo la mía)
      if (i === me && p[6]) {
        ctx.strokeStyle = '#ff6fae';
        ctx.lineWidth = 3;
        ctx.strokeRect(p[6][0] * c + 2, p[6][1] * c + 2, c - 4, c - 4);
      }
      const angle = Math.atan2(p[3], p[2]);
      drawCat(ctx, d.x * c, d.y * c, c * 0.34, colors[i], { angle, ring: i === me ? '#e94590' : '#3d6fd8' });
      if (p[4]) drawItem(ctx, p[4], d.x * c + p[2] * c * 0.42, d.y * c + p[3] * c * 0.42, c * 0.75);
      if (p[5]) emoji(ctx, '🔪', d.x * c, d.y * c - c * 0.55, c * 0.4);
    });
  };

  const hold = hud.hold;
  return (
    <div className="arena-game">
      <div className="arena-hud">
        <span className="arena-hud-item">⭐ {hud.sc}</span>
        <span className="arena-hud-item">⏱ {Math.floor(hud.tl / 60)}:{String(hud.tl % 60).padStart(2, '0')}</span>
        <span className="arena-hud-item muted">Meta: {state.table[state.table.length - 1][0]}+ pts</span>
      </div>
      <div className="arena-hud" style={{ justifyContent: 'flex-start' }}>
        {hud.o.length === 0 && <span className="muted">Sin pedidos por ahora…</span>}
        {hud.o.map(([id, r, left, life]) => (
          <span key={id} className="arena-hud-item" title={state.recipes[r].parts.map((p) => NAME[p]).join(' + ')} style={{ color: left < life * 0.3 ? 'var(--red)' : undefined }}>
            {state.recipes[r].e} <small>{state.recipes[r].parts.map((p) => ING[p]).join('')}</small> {left}s
          </span>
        ))}
      </div>
      <ArenaCanvas aspect={rows / cols} maxHeight={520} draw={draw}>
        {active && <ArenaCountdown startAt={state.startAt} serverNow={state.serverNow} />}
        {hud.fl && <div className={`arena-flash ${hud.fl.good ? 'is-good' : 'is-bad'}`}>{hud.fl.text}</div>}
      </ArenaCanvas>
      {active && (
        <Controls>
          <Joystick inputRef={input} />
          <div className="arena-buttons">
            <ActionButton inputRef={input} name="chop" keys={['e', 'shift']} className="is-mint">
              <span className="big">🔪</span>Picar
              <br />
              (mantén)
            </ActionButton>
            <ActionButton inputRef={input} name="grab" keys={[' ']} className="is-pink" size={92}>
              <span className="big">✋</span>
              {hold ? 'Soltar' : 'Agarrar'}
            </ActionButton>
          </div>
        </Controls>
      )}
      <p className="arena-help">
        Pescado, lechuga y tomate se pican en la tabla 🔪. Arma el plato 🍽️ y llévalo a la 🛎️. Pásense las cosas por el mesón del medio. PC: WASD, espacio agarra, E pica.
      </p>
    </div>
  );
}
