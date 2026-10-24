import { useRef } from 'react';
import Cat from '../../components/Cat.jsx';
import { ActionButton, ArenaCanvas, ArenaCountdown, Controls, Joystick, drawCat, ease, easeAngle, useArena, useArenaHud, useInputSender } from './arena/arena.jsx';

/** Sumo de michis: empuja a tu pareja fuera de la plataforma (que se encoge). */
export default function SumoGame({ match, pulse, onPulse, colors }) {
  const { me, state, players } = match;
  const S = state.sumo;
  const active = match.status === 'active';
  const arena = useArena(onPulse, state.snap);
  const shown = useRef([{}, {}]);
  // Mi joystick está en mi vista; para el jugador 1 la vista está girada 180°
  const raw = useRef({ x: 0, y: 0, dash: 0 });
  const input = useRef({ x: 0, y: 0, dash: 0 });
  const flip = me === 1 ? -1 : 1;
  const proxy = {
    get current() {
      return raw.current;
    },
    set current(v) {
      raw.current = v;
      input.current = { ...v, x: v.x * flip, y: v.y * flip };
    },
  };
  useInputSender(pulse, input, active);

  const hud = useArenaHud(arena, (snap) => ({ sc: snap.sc, rd: snap.rd, wait: snap.wait, last: snap.last, cd: snap.c[me][3] }), 150);

  const draw = (ctx, w, h, dt) => {
    const snap = arena.current.snap;
    const k = w / ((S.r0 + 1.5) * 2);
    const cx = w / 2;
    const cy = h / 2;
    const v = (x, y) => [cx + x * flip * k, cy + y * flip * k];

    // Agua
    const t = performance.now() / 1000;
    ctx.fillStyle = '#2563b0';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const y = ((i * h) / 8 + t * 12) % h;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) ctx.lineTo(x, y + Math.sin(x / 30 + t * 2 + i) * 4);
      ctx.stroke();
    }

    // Plataforma
    ctx.fillStyle = '#e8c98f';
    ctx.beginPath();
    ctx.arc(cx, cy, snap.r * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9c6b2f';
    ctx.lineWidth = Math.max(3, k * 0.35);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(156,107,47,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, snap.r * k * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    snap.c.forEach((c, i) => {
      const d = shown.current[i];
      d.x = ease(d.x, c[0], dt, 16);
      d.y = ease(d.y, c[1], dt, 16);
      d.a = easeAngle(d.a, c[2], dt, 12);
      const [x, y] = v(d.x, d.y);
      const angle = me === 1 ? d.a + Math.PI : d.a;
      // Sombra
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, y + S.cat * k * 0.7, S.cat * k * 0.9, S.cat * k * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCat(ctx, x, y, S.cat * k, colors[i], { angle, ring: i === me ? '#e94590' : '#3d6fd8' });
    });

    if (snap.wait) {
      ctx.fillStyle = 'rgba(18,11,32,0.55)';
      ctx.fillRect(0, cy - 36, w, 72);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const last = snap.last;
      const msg = last && last.round === snap.rd - 1 ? (last.winner === null ? '¡Los dos al agua! 💦' : last.winner === me ? '¡Ganaste la ronda! 🎉' : `Ronda para ${players[last.winner].displayName}`) : `Ronda ${snap.rd}`;
      ctx.fillText(msg, w / 2, cy);
    }
  };

  return (
    <div className="arena-game">
      <div className="arena-hud">
        {[me, 1 - me].map((i) => (
          <span key={i} className="arena-hud-item">
            <Cat color={colors[i]} size={22} /> {i === me ? 'Tú' : players[i].displayName} · <b>{hud.sc[i]}</b>
          </span>
        ))}
        <span className="arena-hud-item muted">Ronda {hud.rd} · gana quien llegue a {S.target}</span>
      </div>
      <ArenaCanvas aspect={1} maxHeight={560} draw={draw}>
        {active && <ArenaCountdown startAt={state.startAt} serverNow={state.serverNow} />}
      </ArenaCanvas>
      {active && (
        <Controls>
          <Joystick inputRef={proxy} />
          <ActionButton inputRef={proxy} name="dash" keys={[' ']} className="is-pink" size={96}>
            <span className="big">💥</span>
            {hud.cd > 0 ? `${hud.cd.toFixed(1)} s` : 'Embestir'}
          </ActionButton>
        </Controls>
      )}
      <p className="arena-help">Empuja a tu pareja fuera de la plataforma. La embestida empuja triple. PC: flechas/WASD y espacio.</p>
    </div>
  );
}
