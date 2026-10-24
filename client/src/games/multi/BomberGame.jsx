import { useRef } from 'react';
import Cat from '../../components/Cat.jsx';
import { ActionButton, ArenaCanvas, ArenaCountdown, Controls, Joystick, drawCat, ease, emoji, useArena, useArenaHud, useInputSender } from './arena/arena.jsx';

const ITEM_EMOJI = { bomb: '💣', range: '🔥', speed: '👟' };

/** Bomber Michi: pon bolas de pelo explosivas, rompe cajas y atrapa a tu pareja. */
export default function BomberGame({ match, pulse, onPulse, colors }) {
  const { me, state, players } = match;
  const B = state.bomber;
  const active = match.status === 'active';
  const arena = useArena(onPulse, state.snap);
  const input = useRef({ x: 0, y: 0, bomb: 0 });
  const shown = useRef([{}, {}]);
  useInputSender(pulse, input, active);

  const hud = useArenaHud(arena, (snap) => ({ sc: snap.sc, rd: snap.rd, tl: snap.tl, me: snap.p[me] }), 250);

  const draw = (ctx, w, h, dt) => {
    const snap = arena.current.snap;
    const c = w / B.cols;
    const t = performance.now() / 1000;
    for (let y = 0; y < B.rows; y++) {
      for (let x = 0; x < B.cols; x++) {
        const cell = snap.g[y * B.cols + x];
        const px = x * c;
        const py = y * c;
        if (cell === '1') {
          ctx.fillStyle = '#5b5470';
          ctx.fillRect(px, py, c, c);
          ctx.fillStyle = '#6e6788';
          ctx.fillRect(px + 2, py + 2, c - 4, c * 0.45);
        } else {
          ctx.fillStyle = (x + y) % 2 ? '#3f9a4f' : '#46a657';
          ctx.fillRect(px, py, c, c);
          if (cell === '2') {
            ctx.fillStyle = '#b07a3c';
            ctx.fillRect(px + 2, py + 2, c - 4, c - 4);
            ctx.strokeStyle = '#7a4f22';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 4, py + 4, c - 8, c - 8);
            ctx.beginPath();
            ctx.moveTo(px + 4, py + 4);
            ctx.lineTo(px + c - 4, py + c - 4);
            ctx.stroke();
          }
        }
      }
    }
    for (const [k, item] of Object.entries(snap.it)) {
      const x = Number(k) % B.cols;
      const y = Math.floor(Number(k) / B.cols);
      emoji(ctx, ITEM_EMOJI[item], (x + 0.5) * c, (y + 0.5) * c, c * 0.7);
    }
    for (const [x, y, left] of snap.b) {
      const pulse = 1 + Math.sin(t * (left < 0.8 ? 30 : 10)) * 0.08;
      ctx.fillStyle = '#2b2238';
      ctx.beginPath();
      ctx.arc((x + 0.5) * c, (y + 0.55) * c, c * 0.36 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff9acb';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc((x + 0.5) * c, (y + 0.55) * c, c * 0.22 * pulse, 0.3, 2.6);
      ctx.stroke();
      ctx.fillStyle = left < 0.8 ? '#ff6b7f' : '#ffcf5a';
      ctx.beginPath();
      ctx.arc((x + 0.72) * c, (y + 0.18) * c, c * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [x, y] of snap.f) {
      ctx.fillStyle = 'rgba(255,140,40,0.85)';
      ctx.fillRect(x * c + 1, y * c + 1, c - 2, c - 2);
      ctx.fillStyle = 'rgba(255,230,120,0.9)';
      ctx.fillRect(x * c + c * 0.25, y * c + c * 0.25, c * 0.5, c * 0.5);
    }
    snap.p.forEach((p, i) => {
      const d = shown.current[i];
      d.x = ease(d.x, p[0], dt, 20);
      d.y = ease(d.y, p[1], dt, 20);
      const x = (d.x + 0.5) * c;
      const y = (d.y + 0.5) * c;
      if (!p[2]) {
        emoji(ctx, '😿', x, y, c * 0.8);
        return;
      }
      drawCat(ctx, x, y, c * 0.36, colors[i], { angle: -Math.PI / 2, ring: i === me ? '#e94590' : '#3d6fd8' });
    });

    if (snap.wait) {
      ctx.fillStyle = 'rgba(18,11,32,0.6)';
      ctx.fillRect(0, h / 2 - 34, w, 68);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const last = snap.last;
      const msg = last && last.round === snap.rd - 1 ? (last.winner === null ? 'Ronda empatada' : last.winner === me ? '¡Ganaste la ronda! 🎉' : `Ronda para ${players[last.winner].displayName}`) : `Ronda ${snap.rd}`;
      ctx.fillText(msg, w / 2, h / 2);
    }
  };

  const mine = hud.me;
  return (
    <div className="arena-game">
      <div className="arena-hud">
        {[me, 1 - me].map((i) => (
          <span key={i} className="arena-hud-item">
            <Cat color={colors[i]} size={22} /> {i === me ? 'Tú' : players[i].displayName} · <b>{hud.sc[i]}</b>
          </span>
        ))}
        <span className="arena-hud-item">⏱ {hud.tl}s</span>
        <span className="arena-hud-item">
          💣{mine[3]} 🔥{mine[4]} 👟{Math.round((mine[5] / B.speed) * 10) / 10}x
        </span>
      </div>
      <ArenaCanvas aspect={B.rows / B.cols} maxHeight={560} draw={draw}>
        {active && <ArenaCountdown startAt={state.startAt} serverNow={state.serverNow} />}
      </ArenaCanvas>
      {active && (
        <Controls>
          <Joystick inputRef={input} />
          <ActionButton inputRef={input} name="bomb" keys={[' ']} size={96}>
            <span className="big">💣</span>Bomba
          </ActionButton>
        </Controls>
      )}
      <p className="arena-help">Rompe cajas para encontrar 💣 🔥 👟 y atrapa a tu pareja con la explosión. Gana quien se lleve {B.target} rondas.</p>
    </div>
  );
}
