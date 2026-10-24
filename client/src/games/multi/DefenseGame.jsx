import { useRef } from 'react';
import { ActionButton, ArenaCanvas, ArenaCountdown, Controls, Joystick, drawCat, ease, emoji, useArena, useArenaHud, useInputSender } from './arena/arena.jsx';

/** Defender la casa: muévanse con el joystick; cada michi araña solo a lo que tenga cerca. */
export default function DefenseGame({ match, pulse, onPulse, colors }) {
  const { me, state } = match;
  const D = state.def;
  const active = match.status === 'active';
  const arena = useArena(onPulse, state.snap);
  const input = useRef({ x: 0, y: 0, meow: 0 });
  const shownCats = useRef([{}, {}]);
  const shownEnemies = useRef(new Map());
  useInputSender(pulse, input, active);

  const hud = useArenaHud(arena, (s) => ({ hp: s.hp, wv: s.wv, left: s.left, cd: s.c[me][2], k: s.k }), 150);

  const draw = (ctx, w, h, dt) => {
    const s = arena.current.snap;
    const k = w / D.W;
    ctx.fillStyle = '#4c9a52';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let x = 0; x < D.W; x++) for (let y = 0; y < D.H; y++) if ((x + y) % 2) ctx.fillRect(x * k, y * k, k, k);

    // Casa con su barra de vida
    const hx = (D.W / 2) * k;
    const hy = (D.H / 2) * k;
    ctx.fillStyle = 'rgba(255,207,90,0.18)';
    ctx.beginPath();
    ctx.arc(hx, hy, D.house * k, 0, Math.PI * 2);
    ctx.fill();
    emoji(ctx, '🏠', hx, hy, D.house * k * 1.5);
    const bw = D.house * k * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(hx - bw / 2, hy + D.house * k + 4, bw, 7);
    ctx.fillStyle = s.hp > D.hp * 0.4 ? '#4fe3b0' : '#ff6b7f';
    ctx.fillRect(hx - bw / 2, hy + D.house * k + 4, (bw * s.hp) / D.hp, 7);

    for (const [x, y] of s.m) {
      ctx.strokeStyle = 'rgba(255,154,203,0.8)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x * k, y * k, D.meowR * k, 0, Math.PI * 2);
      ctx.stroke();
    }

    const seen = new Set();
    for (const [id, e, x, y, stun, hit] of s.e) {
      seen.add(id);
      const d = shownEnemies.current.get(id) || {};
      d.x = ease(d.x, x, dt, 14);
      d.y = ease(d.y, y, dt, 14);
      shownEnemies.current.set(id, d);
      const size = (e === '🤖' ? 1.25 : e === '🐕' ? 1.05 : 0.85) * k;
      if (hit) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(d.x * k, d.y * k, size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      emoji(ctx, e, d.x * k, d.y * k, size);
      if (stun) emoji(ctx, '💫', d.x * k, d.y * k - size * 0.6, size * 0.5);
    }
    for (const id of shownEnemies.current.keys()) if (!seen.has(id)) shownEnemies.current.delete(id);

    s.c.forEach((c, i) => {
      const d = shownCats.current[i];
      d.x = ease(d.x, c[0], dt, 18);
      d.y = ease(d.y, c[1], dt, 18);
      if (c[3]) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(d.x * k, d.y * k);
        ctx.lineTo(c[3][0] * k, c[3][1] * k);
        ctx.stroke();
      }
      drawCat(ctx, d.x * k, d.y * k, 0.42 * k, colors[i], { ring: i === me ? '#e94590' : '#3d6fd8' });
    });
  };

  return (
    <div className="arena-game">
      <div className="arena-hud">
        <span className="arena-hud-item">🏠 {hud.hp}/{D.hp}</span>
        <span className="arena-hud-item">🌊 Oleada {Math.min(hud.wv, state.waves)}/{state.waves}</span>
        <span className="arena-hud-item">👾 {hud.left}</span>
        <span className="arena-hud-item">🐾 {hud.k[me]} · {hud.k[1 - me]}</span>
      </div>
      <ArenaCanvas aspect={D.H / D.W} maxHeight={600} draw={draw}>
        {active && <ArenaCountdown startAt={state.startAt} serverNow={state.serverNow} />}
      </ArenaCanvas>
      {active && (
        <Controls>
          <Joystick inputRef={input} />
          <ActionButton inputRef={input} name="meow" keys={[' ']} className="is-pink" size={96} disabled={hud.cd > 0}>
            <span className="big">😼</span>
            {hud.cd > 0 ? `${hud.cd.toFixed(1)} s` : '¡Miau!'}
          </ActionButton>
        </Controls>
      )}
      <p className="arena-help">Tu michi araña solo a lo que esté cerca. El maullido aturde a todo alrededor. Repártanse los lados: los enemigos llegan por todas partes.</p>
    </div>
  );
}
