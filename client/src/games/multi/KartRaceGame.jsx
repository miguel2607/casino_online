import { useRef } from 'react';
import { FISH_SPOTS, ITEM_SPOTS, TRACK, TRACK_WIDTH, trackAngle } from '@shared/kartTrack.js';
import { ActionButton, ArenaCanvas, ArenaCountdown, Controls, Joystick, catFill, drawCat, ease, easeAngle, emoji, useArena, useArenaHud, useInputSender } from './arena/arena.jsx';

const VIEW_W = 62; // metros visibles a lo ancho
const ITEM_EMOJI = { yarn: '🧶', banana: '🍌', shield: '🛡️' };
const ITEM_NAME = { yarn: 'Ovillo', banana: 'Cáscara', shield: 'Escudo' };

const xs = TRACK.map((p) => p[0]);
const ys = TRACK.map((p) => p[1]);
const BOX = { x0: Math.min(...xs) - 10, x1: Math.max(...xs) + 10, y0: Math.min(...ys) - 10, y1: Math.max(...ys) + 10 };

function trackPath(ctx, tx, ty) {
  ctx.beginPath();
  TRACK.forEach(([x, y], i) => (i ? ctx.lineTo(tx(x), ty(y)) : ctx.moveTo(tx(x), ty(y))));
  ctx.closePath();
}

/** Michi Kart Racing: joystick para manejar, turbo con pescaditos y poderes de las cajas. */
export default function KartRaceGame({ match, pulse, onPulse, colors }) {
  const { me, state, players } = match;
  const active = match.status === 'active';
  const arena = useArena(onPulse, state.snap);
  const input = useRef({ x: 0, y: 0, use: 0, turbo: 0 });
  const shown = useRef([{}, {}]);
  const cam = useRef(null);
  useInputSender(pulse, input, active);

  const hud = useArenaHud(arena, (snap) => {
    const k = snap.k;
    return { lap: k[me][4], item: k[me][5], turbos: k[me][6], speed: Math.round(k[me][3] * 3.6), first: k[me][10] >= k[1 - me][10] };
  });

  const draw = (ctx, w, h, dt) => {
    const snap = arena.current.snap;
    const sc = w / VIEW_W;
    snap.k.forEach((k, i) => {
      const d = shown.current[i];
      d.x = ease(d.x, k[0], dt, 12);
      d.y = ease(d.y, k[1], dt, 12);
      d.a = easeAngle(d.a, k[2], dt, 14);
    });
    const mine = shown.current[me];
    // Cámara un poco adelantada en la dirección del kart
    const ahead = 8;
    const cx = mine.x + Math.cos(mine.a) * ahead;
    const cy = mine.y + Math.sin(mine.a) * ahead;
    cam.current = cam.current ? { x: ease(cam.current.x, cx, dt, 5), y: ease(cam.current.y, cy, dt, 5) } : { x: cx, y: cy };
    const tx = (x) => (x - cam.current.x) * sc + w / 2;
    const ty = (y) => (y - cam.current.y) * sc + h / 2;

    // Pasto
    ctx.fillStyle = '#2f7a3e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    const grid = 8 * sc;
    const ox = ((-cam.current.x * sc) % grid) + w / 2;
    const oy = ((-cam.current.y * sc) % grid) + h / 2;
    for (let gx = ox - grid * 20; gx < w; gx += grid) for (let gy = oy - grid * 20; gy < h; gy += grid) if (gx > -grid && gy > -grid) ctx.fillRect(gx, gy, 3, 3);

    // Pista: borde (pianos), asfalto y línea central
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    trackPath(ctx, tx, ty);
    ctx.strokeStyle = '#f4f1ea';
    ctx.lineWidth = (TRACK_WIDTH + 1.6) * sc;
    ctx.stroke();
    ctx.setLineDash([2 * sc, 2 * sc]);
    ctx.strokeStyle = '#e9455a';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#4a4458';
    ctx.lineWidth = TRACK_WIDTH * sc;
    ctx.stroke();
    ctx.setLineDash([3 * sc, 4 * sc]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = Math.max(1, 0.35 * sc);
    ctx.stroke();
    ctx.setLineDash([]);

    // Meta (cuadros)
    const [mx, my] = TRACK[0];
    const ma = trackAngle(0);
    ctx.save();
    ctx.translate(tx(mx), ty(my));
    ctx.rotate(ma);
    const sq = TRACK_WIDTH / 8;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff';
        ctx.fillRect(r * sq * sc - sq * sc, (c * sq - TRACK_WIDTH / 2) * sc, sq * sc, sq * sc);
      }
    }
    ctx.restore();

    const visible = (x, y) => Math.abs(tx(x) - w / 2) < w / 2 + 40 && Math.abs(ty(y) - h / 2) < h / 2 + 40;
    ITEM_SPOTS.forEach(([x, y], j) => snap.bx[j] && visible(x, y) && emoji(ctx, '🎁', tx(x), ty(y), 2.4 * sc));
    FISH_SPOTS.forEach(([x, y], j) => snap.fs[j] && visible(x, y) && emoji(ctx, '🐟', tx(x), ty(y), 2.2 * sc));
    snap.pe.forEach(([x, y]) => emoji(ctx, '🍌', tx(x), ty(y), 2.2 * sc));
    snap.sh.forEach(([x, y]) => emoji(ctx, '🧶', tx(x), ty(y), 2 * sc));

    // Karts (el mío encima)
    for (const i of [1 - me, me]) {
      const k = snap.k[i];
      const d = shown.current[i];
      const spin = k[8];
      ctx.save();
      ctx.translate(tx(d.x), ty(d.y));
      ctx.rotate(d.a);
      if (k[7]) {
        // Turbo: llamita atrás
        ctx.fillStyle = 'rgba(255,170,40,0.9)';
        ctx.beginPath();
        ctx.moveTo(-1.6 * sc, -0.6 * sc);
        ctx.lineTo((-3 - Math.random()) * sc, 0);
        ctx.lineTo(-1.6 * sc, 0.6 * sc);
        ctx.fill();
      }
      ctx.fillStyle = i === me ? '#e94590' : '#3d6fd8';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-1.7 * sc, -1 * sc, 3.4 * sc, 2 * sc, 0.6 * sc);
      else ctx.rect(-1.7 * sc, -1 * sc, 3.4 * sc, 2 * sc);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#222';
      for (const [wx, wy] of [[-1.1, -1.15], [1.1, -1.15], [-1.1, 1.15], [1.1, 1.15]]) ctx.fillRect((wx - 0.4) * sc, (wy - 0.2) * sc, 0.8 * sc, 0.4 * sc);
      ctx.restore();
      drawCat(ctx, tx(d.x), ty(d.y), 0.95 * sc, colors[i], { angle: spin ? d.a + performance.now() / 80 : d.a, ring: k[9] ? '#8ff0cf' : null });
      if (i !== me) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(10, sc * 1.2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(players[i].displayName, tx(d.x), ty(d.y) - 2.4 * sc);
      }
    }

    // Minimapa
    const mm = Math.min(110, w * 0.28);
    const ms = mm / Math.max(BOX.x1 - BOX.x0, BOX.y1 - BOX.y0);
    const mx0 = w - mm - 8;
    const my0 = 8;
    ctx.fillStyle = 'rgba(18,11,32,0.6)';
    ctx.fillRect(mx0 - 4, my0 - 4, mm + 8, (BOX.y1 - BOX.y0) * ms + 8);
    trackPath(ctx, (x) => mx0 + (x - BOX.x0) * ms, (y) => my0 + (y - BOX.y0) * ms);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();
    for (const i of [1 - me, me]) {
      const d = shown.current[i];
      ctx.fillStyle = catFill(colors[i]);
      ctx.strokeStyle = i === me ? '#e94590' : '#3d6fd8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx0 + (d.x - BOX.x0) * ms, my0 + (d.y - BOX.y0) * ms, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  };

  return (
    <div className="arena-game">
      <div className="arena-hud">
        <span className="arena-hud-item">🏁 Vuelta {hud.lap}/{state.laps}</span>
        <span className="arena-hud-item" style={{ color: hud.first ? 'var(--gold)' : 'var(--muted)' }}>
          {hud.first ? '🥇 1º' : '🥈 2º'}
        </span>
        <span className="arena-hud-item">💨 {hud.speed} km/h</span>
        <span className="arena-hud-item">🐟×{hud.turbos}</span>
      </div>
      <ArenaCanvas aspect={1.12} maxHeight={620} draw={draw}>
        {active && <ArenaCountdown startAt={state.startAt} serverNow={state.serverNow} />}
      </ArenaCanvas>
      {active && (
        <Controls>
          <Joystick inputRef={input} label="Dirección" />
          <div className="arena-buttons">
            <ActionButton inputRef={input} name="use" keys={[' ']} className="is-violet" disabled={!hud.item}>
              <span className="big">{hud.item ? ITEM_EMOJI[hud.item] : '🎁'}</span>
              {hud.item ? ITEM_NAME[hud.item] : 'Sin poder'}
            </ActionButton>
            <ActionButton inputRef={input} name="turbo" keys={['e', 'shift']} className="is-pink" disabled={!hud.turbos}>
              <span className="big">🔥</span>Turbo
            </ActionButton>
          </div>
        </Controls>
      )}
      <p className="arena-help">
        3 vueltas · 🐟 = turbo · 🎁 = poder (🧶 persigue al rival, 🍌 se deja atrás, 🛡️ te protege) · PC: flechas/WASD, espacio usa, E turbo
      </p>
    </div>
  );
}

