import { useRef } from 'react';
import { ActionButton, ArenaCanvas, ArenaCountdown, drawCat, ease, emoji, useArena, useArenaHud, useInputSender } from './arena/arena.jsx';

const VIEW_AHEAD = 60;

/** Kart en equipo: uno maneja y el otro dispara a los obstáculos; a mitad de carrera cambian. */
export default function KartTeamGame({ match, pulse, onPulse, colors }) {
  const { me, state, players } = match;
  const K = state.kt;
  const active = match.status === 'active';
  const arena = useArena(onPulse, state.snap);
  const input = useRef({ left: 0, right: 0, f0: 0, f1: 0, f2: 0 });
  const shown = useRef({ pos: 1, d: 0 });
  useInputSender(pulse, input, active);

  const hud = useArenaHud(arena, (s) => ({ drv: s.drv, lives: s.lives, sc: s.sc, tl: s.tl, v: Math.round(s.v * 3.6), fish: s.fish, fire: s.fire }), 150);
  const driving = hud.drv === me;

  const draw = (ctx, w, h, dt) => {
    const s = arena.current.snap;
    const sh = shown.current;
    sh.pos = ease(sh.pos, s.pos, dt, 18);
    // Entre fotos se extrapola con la velocidad (las fotos llegan 25 veces por segundo)
    const since = Math.min(0.12, (performance.now() - arena.current.at) / 1000);
    sh.d = s.d + (active ? s.v * since : 0);
    const laneW = Math.min(w / 3.4, 140);
    const roadX = (w - laneW * 3) / 2;
    const kartY = h * 0.84;
    const sc = (kartY - 10) / VIEW_AHEAD;
    const laneX = (l) => roadX + laneW * (l + 0.5);

    ctx.fillStyle = '#2f6b3a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a3347';
    ctx.fillRect(roadX, 0, laneW * 3, h);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const dash = (sh.d * sc) % 40;
    for (let l = 1; l < 3; l++) for (let y = -40 + dash; y < h; y += 40) ctx.fillRect(roadX + laneW * l - 2, y, 4, 22);
    ctx.fillStyle = '#ffcf5a';
    ctx.fillRect(roadX - 4, 0, 4, h);
    ctx.fillRect(roadX + laneW * 3, 0, 4, h);

    const size = Math.min(laneW * 0.6, 54);
    for (const [x, obs, fishLane] of s.rows) {
      const y = kartY - (x - sh.d) * sc;
      if (y < -size || y > h + size) continue;
      for (const [l, e] of obs) emoji(ctx, e, laneX(l), y, size);
      if (fishLane >= 0) emoji(ctx, '🐟', laneX(fishLane), y, size * 0.7);
    }
    for (const [l, x, miss] of s.bl) {
      const y = kartY - (x - sh.d) * sc;
      ctx.strokeStyle = miss ? 'rgba(255,255,255,0.4)' : 'rgba(255,207,90,0.95)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(laneX(l), kartY - size * 0.6);
      ctx.lineTo(laneX(l), Math.max(0, y));
      ctx.stroke();
      if (!miss) emoji(ctx, '💥', laneX(l), y, size);
    }

    const kx = roadX + laneW * (sh.pos + 0.5);
    const blink = s.inv && Math.floor(performance.now() / 120) % 2;
    ctx.globalAlpha = blink ? 0.4 : 1;
    ctx.fillStyle = '#e94590';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(kx - size * 0.5, kartY - size * 0.1, size, size * 0.6, 10);
    else ctx.rect(kx - size * 0.5, kartY - size * 0.1, size, size * 0.6);
    ctx.fill();
    // Los dos michis en el kart: el que maneja adelante
    drawCat(ctx, kx - size * 0.2, kartY - size * 0.05, size * 0.26, colors[s.drv]);
    drawCat(ctx, kx + size * 0.22, kartY + size * 0.12, size * 0.22, colors[1 - s.drv]);
    ctx.globalAlpha = 1;
  };

  const lanes = [0, 1, 2];
  return (
    <div className="arena-game">
      <div className="arena-hud">
        <span className="arena-hud-item">{'❤️'.repeat(Math.max(0, hud.lives))}{'🖤'.repeat(Math.max(0, K.lives - hud.lives))}</span>
        <span className="arena-hud-item">⭐ {hud.sc}</span>
        <span className="arena-hud-item">💨 {hud.v} km/h</span>
        <span className="arena-hud-item">⏱ {hud.tl}s</span>
      </div>
      <div className={`turn-banner ${driving ? 'is-mine' : ''}`}>
        {driving ? '🏎️ Tú manejas: esquiva lo que tu pareja no alcance a romper' : `🎯 Tú disparas: rompe obstáculos para ${players[1 - me].displayName}`}
        {hud.tl > K.gameSec - K.swapSec && ' · a los 45 s cambian'}
      </div>
      <ArenaCanvas aspect={1.25} maxHeight={560} draw={draw}>
        {active && <ArenaCountdown startAt={state.startAt} serverNow={state.serverNow} />}
      </ArenaCanvas>
      {active &&
        (driving ? (
          <div className="arcade-buttons">
            <ActionButton inputRef={input} name="left" keys={['arrowleft', 'a']} className="is-pink" size={80}>
              <span className="big">⬅</span>
            </ActionButton>
            <span style={{ flex: 1 }} />
            <ActionButton inputRef={input} name="right" keys={['arrowright', 'd']} className="is-pink" size={80}>
              <span className="big">➡</span>
            </ActionButton>
          </div>
        ) : (
          <div className="kt-fire">
            {lanes.map((l) => (
              <ActionButton key={l} inputRef={input} name={`f${l}`} keys={[String(l + 1), ['j', 'k', 'l'][l]]} disabled={hud.fire > 0} size={78}>
                <span className="big">🎯</span>
                {hud.fire > 0 ? `${hud.fire.toFixed(1)}s` : ['Izq.', 'Centro', 'Der.'][l]}
              </ActionButton>
            ))}
          </div>
        ))}
      <p className="arena-help">
        Cada 🐟 acelera el kart. Meta: {state.table[state.table.length - 1][0]} puntos para recuperar la apuesta, {state.table[0][0]} para x{state.table[0][1]}. PC: ← → manejan · 1 2 3 disparan.
      </p>
    </div>
  );
}
