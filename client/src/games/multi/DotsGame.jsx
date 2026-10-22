import { useRef, useState } from 'react';
import Cat from '../../components/Cat.jsx';
import { useElementWidth } from '../../hooks/gameHooks.js';

const PLAYER_COLORS = ['#ff7eb6', '#5ce1b5'];

export default function DotsGame({ match, act, colors }) {
  const { me, state, players } = match;
  const ref = useRef(null);
  const width = useElementWidth(ref);
  const [busy, setBusy] = useState(false);
  const n = state.size;
  const myTurn = match.status === 'active' && state.turn === me;
  const W = Math.min(width || 300, 440);
  const pad = 22;
  const step = (W - pad * 2) / n;
  const hit = Math.max(22, step * 0.32); // zona táctil generosa para el dedo

  const draw = async (id) => {
    if (!myTurn || busy || state.lines[id] !== undefined) return;
    setBusy(true);
    await act({ type: 'line', id }).catch(() => {});
    setBusy(false);
  };

  const lines = [];
  for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) lines.push({ id: `h-${r}-${c}`, x1: c, y1: r, x2: c + 1, y2: r });
  for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) lines.push({ id: `v-${r}-${c}`, x1: c, y1: r, x2: c, y2: r + 1 });
  const P = (v) => pad + v * step;

  return (
    <div className="dots-wrap" ref={ref}>
      <div className="memory-scores">
        {[me, 1 - me].map((i) => (
          <span key={i} className={state.turn === i && match.status === 'active' ? 'is-turn' : ''} style={{ borderColor: state.turn === i ? PLAYER_COLORS[i] : undefined }}>
            <Cat color={colors[i]} size={22} /> {i === me ? 'Tú' : players[i].displayName} · <b>{state.scores[i]}</b>
          </span>
        ))}
      </div>
      <div className={`turn-banner ${myTurn ? 'is-mine' : ''}`}>
        {match.status !== 'active' ? 'Partida terminada' : myTurn ? '¡Tu turno! Toca entre dos puntos' : `Turno de ${players[1 - me].displayName}…`}
      </div>
      <svg className="dots-board" width={W} height={W} viewBox={`0 0 ${W} ${W}`}>
        {state.boxes.map((owner, k) => {
          if (owner === null) return null;
          const r = Math.floor(k / n);
          const c = k % n;
          return (
            <g key={k}>
              <rect x={P(c) + 3} y={P(r) + 3} width={step - 6} height={step - 6} rx="8" fill={PLAYER_COLORS[owner]} opacity="0.25" />
              {/* SVG anidado en vez de foreignObject: Safari viejo dibuja mal foreignObject */}
              <g transform={`translate(${P(c) + step * 0.2} ${P(r) + step * 0.22})`}>
                <Cat color={colors[owner]} mood="happy" size={step * 0.6} />
              </g>
            </g>
          );
        })}
        {lines.map((l) => {
          const owner = state.lines[l.id];
          const isLast = state.last === l.id;
          return (
            <g key={l.id} onClick={() => draw(l.id)} className={owner === undefined && myTurn ? 'dots-line is-free' : 'dots-line'}>
              <line x1={P(l.x1)} y1={P(l.y1)} x2={P(l.x2)} y2={P(l.y2)} stroke="transparent" strokeWidth={hit} />
              <line
                x1={P(l.x1)}
                y1={P(l.y1)}
                x2={P(l.x2)}
                y2={P(l.y2)}
                stroke={owner === undefined ? 'rgba(255,255,255,0.12)' : PLAYER_COLORS[owner]}
                strokeWidth={owner === undefined ? 4 : isLast ? 8 : 6}
                strokeLinecap="round"
                className="dots-visible"
              />
            </g>
          );
        })}
        {Array.from({ length: (n + 1) * (n + 1) }, (_, k) => (
          <circle key={k} cx={P(k % (n + 1))} cy={P(Math.floor(k / (n + 1)))} r="6" fill="#ffe6a6" />
        ))}
      </svg>
      <p className="muted small center">Quien cierra una caja la gana y vuelve a jugar.</p>
    </div>
  );
}
