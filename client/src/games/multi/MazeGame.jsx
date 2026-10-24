import { useRef, useState } from 'react';
import Cat from '../../components/Cat.jsx';
import { mmss, useCountdown, useElementWidth, useKeys, useServerClock } from '../../hooks/gameHooks.js';

const SIGNAL = {
  up: { e: '⬆️', text: 'Arriba' },
  right: { e: '➡️', text: 'Derecha' },
  down: { e: '⬇️', text: 'Abajo' },
  left: { e: '⬅️', text: 'Izquierda' },
  stop: { e: '🛑', text: '¡Alto!' },
  yes: { e: '✅', text: '¡Así!' },
  back: { e: '↩️', text: 'Devuélvete' },
};
const BITS = { up: 1, right: 2, down: 4, left: 8 };

/** Laberinto a ciegas: uno camina sin ver las trampas; el otro ve el mapa y lo guía con señales. */
export default function MazeGame({ match, act, colors }) {
  const { me, state, players } = match;
  const active = match.status === 'active';
  const now = useServerClock(state.serverNow);
  const left = useCountdown(state.endAt, now);
  const toStart = useCountdown(state.startAt, now);
  const ref = useRef(null);
  const width = useElementWidth(ref);
  const [busy, setBusy] = useState(false);
  const n = state.size;
  const walking = state.walking;
  const walkerIdx = walking ? me : 1 - me;
  const other = players[1 - me].displayName;
  const size = Math.min(width || 0, 460);
  const cell = size / n;

  const move = async (dir) => {
    if (!active || !walking || busy || toStart > 0) return;
    setBusy(true);
    await act({ type: 'move', dir }).catch(() => {});
    setBusy(false);
  };
  const signal = (s) => active && !walking && toStart <= 0 && act({ type: 'signal', signal: s }).catch(() => {});
  useKeys(
    walking
      ? { ArrowUp: () => move('up'), w: () => move('up'), ArrowDown: () => move('down'), s: () => move('down'), ArrowLeft: () => move('left'), a: () => move('left'), ArrowRight: () => move('right'), d: () => move('right') }
      : { ArrowUp: () => signal('up'), ArrowDown: () => signal('down'), ArrowLeft: () => signal('left'), ArrowRight: () => signal('right') },
    active,
  );

  const px = (i) => [(i % n) * cell, Math.floor(i / n) * cell];
  const flash = state.flash && now() - state.flash.at < 2500 ? state.flash : null;
  const sig = state.signal && now() - state.signal.at < 6000 ? state.signal : null;

  return (
    <div className="arena-game">
      <div className="arena-hud">
        <span className="arena-hud-item">🗺 Laberinto {state.round}/{state.mazes}</span>
        <span className="arena-hud-item">✅ {state.solved}</span>
        <span className="arena-hud-item">🥒 {state.trapsHit}</span>
        <span className="arena-hud-item">⏱ {mmss(left)}</span>
      </div>
      <div className={`turn-banner ${walking ? 'is-mine' : ''}`}>
        {toStart > 0
          ? `Empiezan en ${Math.ceil(toStart / 1000)}…`
          : walking
            ? `🙈 Caminas a ciegas: sigue las señales de ${other}`
            : `🗺 Ves el mapa: guía a ${other} hasta el 🐟 sin pisar 🥒`}
      </div>
      <div ref={ref} style={{ width: '100%' }}>
        {size > 0 && (
          <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
          <svg className="maze-board" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
            {state.walls.map((w, i) => {
              const [x, y] = px(i);
              if (w === null) return <rect key={i} x={x} y={y} width={cell} height={cell} fill="#0d0818" />;
              return <rect key={i} x={x} y={y} width={cell} height={cell} fill={(i + Math.floor(i / n)) % 2 ? '#2a1f45' : '#251a40'} />;
            })}
            {state.trail.map((i, k) => {
              const [x, y] = px(i);
              return <circle key={`t${k}`} cx={x + cell / 2} cy={y + cell / 2} r={cell * 0.08} fill="rgba(255,154,203,0.45)" />;
            })}
            {state.traps.map((i) => {
              const [x, y] = px(i);
              return (
                <text key={`p${i}`} x={x + cell / 2} y={y + cell / 2} fontSize={cell * 0.55} textAnchor="middle" dominantBaseline="central">
                  🥒
                </text>
              );
            })}
            {(() => {
              const [x, y] = px(state.goal);
              const visible = !walking || state.walls[state.goal] !== null;
              return visible ? (
                <text x={x + cell / 2} y={y + cell / 2} fontSize={cell * 0.6} textAnchor="middle" dominantBaseline="central">
                  🐟
                </text>
              ) : null;
            })()}
            {state.walls.map((w, i) => {
              if (w === null) return null;
              const [x, y] = px(i);
              const lines = [];
              if (w & BITS.up) lines.push([x, y, x + cell, y]);
              if (w & BITS.right) lines.push([x + cell, y, x + cell, y + cell]);
              if (w & BITS.down) lines.push([x, y + cell, x + cell, y + cell]);
              if (w & BITS.left) lines.push([x, y, x, y + cell]);
              return lines.map(([x1, y1, x2, y2], k) => <line key={`${i}-${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ff9acb" strokeWidth={Math.max(3, cell * 0.08)} strokeLinecap="round" />);
            })}
          </svg>
          {(() => {
            // El michi va en una capa encima (foreignObject falla en Safari de iPhone viejos)
            const [x, y] = px(state.pos);
            return (
              <div style={{ position: 'absolute', left: x + cell * 0.1, top: y + cell * 0.1, width: cell * 0.8, height: cell * 0.8, transition: 'left 0.15s, top 0.15s', pointerEvents: 'none' }}>
                <Cat color={colors[walkerIdx]} mood={flash?.type === 'trap' ? 'shocked' : 'happy'} size={cell * 0.8} />
              </div>
            );
          })()}
          </div>
        )}
      </div>
      {flash && (
        <p className="center" style={{ fontWeight: 800, color: flash.type === 'goal' ? 'var(--mint)' : 'var(--red)' }}>
          {flash.type === 'goal' ? '¡Llegaron al pescado! 🐟 Cambian de rol' : flash.type === 'trap' ? '¡Pepino! 🥒 De vuelta al inicio' : '¡Pared! 🧱'}
        </p>
      )}
      {active && walking && (
        <>
          {sig && (
            <div key={sig.n} className="maze-signal">
              {SIGNAL[sig.s].e} {SIGNAL[sig.s].text}
            </div>
          )}
          <div className="maze-pad">
            <span />
            <button className="btn btn-primary" onClick={() => move('up')} disabled={busy}>
              ⬆
            </button>
            <span />
            <button className="btn btn-primary" onClick={() => move('left')} disabled={busy}>
              ⬅
            </button>
            <span />
            <button className="btn btn-primary" onClick={() => move('right')} disabled={busy}>
              ➡
            </button>
            <span />
            <button className="btn btn-primary" onClick={() => move('down')} disabled={busy}>
              ⬇
            </button>
            <span />
          </div>
        </>
      )}
      {active && !walking && (
        <div className="maze-signals">
          {Object.entries(SIGNAL).map(([k, s]) => (
            <button key={k} className={`btn ${sig?.s === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => signal(k)} title={s.text}>
              {s.e}
            </button>
          ))}
        </div>
      )}
      <p className="arena-help">
        {walking ? 'Muévete con los botones o las flechas. Solo ves las casillas de al lado.' : 'Toca una señal para que tu pareja la vea en grande. PC: flechas envían la dirección.'}
      </p>
    </div>
  );
}
