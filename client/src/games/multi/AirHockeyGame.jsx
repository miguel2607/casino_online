import { useRef } from 'react';
import Cat from '../../components/Cat.jsx';
import { ArenaCanvas, ArenaCountdown, catFill, drawCat, ease, useArena, useArenaHud, useInputSender } from './arena/arena.jsx';

/** Air Hockey de michis: arrastra el dedo (o el mouse) para mover tu mazo. Tu arco siempre está abajo. */
export default function AirHockeyGame({ match, pulse, onPulse, colors }) {
  const { me, state, players } = match;
  const T = state.table;
  const active = match.status === 'active';
  const arena = useArena(onPulse, state.snap);
  const input = useRef({ x: 0.5, y: T.H * 0.85 });
  const shown = useRef({ p: null, m: [null, null] });
  useInputSender(pulse, input, active);

  const hud = useArenaHud(arena, (snap) => ({ sc: snap.sc, goal: snap.goal }));

  // Coordenadas de la mesa vistas desde mi lado
  const view = ([x, y]) => (me === 1 ? [T.W - x, T.H - y] : [x, y]);

  const aim = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    input.current = {
      x: Math.round(((e.clientX - rect.left) / rect.width) * T.W * 1000) / 1000,
      // El mazo va un poco arriba del dedo para que el dedo no lo tape
      y: Math.round((((e.clientY - rect.top) / rect.height) * T.H - 0.06) * 1000) / 1000,
    };
  };

  const draw = (ctx, w, h, dt) => {
    const snap = arena.current.snap;
    const k = w / T.W;
    const s = shown.current;
    const [px, py] = view(snap.p);
    s.p = s.p ? [ease(s.p[0], px, dt, 22), ease(s.p[1], py, dt, 22)] : [px, py];
    snap.m.forEach((m, i) => {
      const [x, y] = view(m);
      s.m[i] = s.m[i] ? [ease(s.m[i][0], x, dt, 22), ease(s.m[i][1], y, dt, 22)] : [x, y];
    });

    // Mesa
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#d8f0ff');
    g.addColorStop(1, '#a9d8f5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(233,69,144,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 0.16 * k, 0, Math.PI * 2);
    ctx.stroke();
    // Arcos
    const gw = T.goal * k;
    ctx.fillStyle = '#1c1331';
    ctx.fillRect((w - gw) / 2, 0, gw, 7);
    ctx.fillRect((w - gw) / 2, h - 7, gw, 7);
    ctx.strokeStyle = 'rgba(61,111,216,0.5)';
    for (const y of [0, h]) {
      ctx.beginPath();
      ctx.arc(w / 2, y, gw * 0.75, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Disco (ovillo)
    const pr = T.puck * k;
    ctx.fillStyle = '#e94590';
    ctx.beginPath();
    ctx.arc(s.p[0] * k, s.p[1] * k, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff9acb';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(s.p[0] * k + i * pr * 0.3, s.p[1] * k, pr * 0.75, -1.2, 1.2);
      ctx.stroke();
    }

    // Mazos (michis)
    s.m.forEach(([x, y], i) => {
      const r = T.mallet * k;
      ctx.fillStyle = catFill(colors[i]);
      ctx.strokeStyle = i === me ? '#e94590' : '#3d6fd8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x * k, y * k, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawCat(ctx, x * k, y * k, r * 0.62, colors[i], { angle: i === me ? -Math.PI / 2 : Math.PI / 2 });
    });

    if (snap.pause && snap.goal && Date.now() - snap.goal.at < 2500) {
      ctx.fillStyle = 'rgba(18,11,32,0.55)';
      ctx.fillRect(0, h / 2 - 34, w, 68);
      ctx.fillStyle = snap.goal.by === me ? '#ffcf5a' : '#ff9acb';
      ctx.font = 'bold 30px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(snap.goal.by === me ? '¡GOOOL! 🎉' : `Gol de ${players[snap.goal.by].displayName}`, w / 2, h / 2);
    }
  };

  return (
    <div className="arena-game" style={{ maxWidth: 420 }}>
      <div className="arena-hud">
        {[me, 1 - me].map((i) => (
          <span key={i} className="arena-hud-item">
            <Cat color={colors[i]} size={22} /> {i === me ? 'Tú' : players[i].displayName} · <b>{hud.sc[i]}</b>
          </span>
        ))}
        <span className="arena-hud-item muted">a {T.target}</span>
      </div>
      <ArenaCanvas
        aspect={T.H / T.W}
        maxHeight={640}
        draw={draw}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          aim(e);
        }}
        onPointerMove={aim}
      >
        {active && <ArenaCountdown startAt={state.startAt} serverNow={state.serverNow} />}
      </ArenaCanvas>
      <p className="arena-help">Arrastra el dedo (o mueve el mouse) por tu mitad. Primero en {T.target} goles gana.</p>
    </div>
  );
}
