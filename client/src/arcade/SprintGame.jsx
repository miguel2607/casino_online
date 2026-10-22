import { useEffect, useRef, useState } from 'react';
import Cat from '../components/Cat.jsx';
import { useKeys } from '../hooks/gameHooks.js';
import { SPRINT } from './engines.js';

const PULSE_MS = 120;

/**
 * Sprint de 100 m: tocar los dos botones alternados lo más rápido posible.
 * - local: la física corre aquí (solo y en vivo); onFinish(tiempo)
 * - teamMode: solo cuenta toques y los envía (el servidor mueve al michi del equipo)
 * - runners: otros corredores a dibujar [{ key, label, color, d }]
 */
export default function SprintGame({ startAt, now, color = 'orange', runners = [], teamMode = false, teamD = 0, limit, onPulse, onFinish, onTaps }) {
  const clock = now || (() => Date.now());
  const startRef = useRef(startAt ?? null);
  const sim = useRef({ d: 0, v: 0, t: 0, lastSide: null, done: false, pendingTaps: 0 });
  const [state, setState] = useState({ d: 0, t: 0, phase: 'countdown', count: 3, side: null });
  const cbs = useRef({ onPulse, onFinish, onTaps });
  cbs.current = { onPulse, onFinish, onTaps };

  useEffect(() => {
    if (startRef.current == null) startRef.current = Date.now() + 3000;
  }, []);

  const tap = (side) => {
    const s = sim.current;
    if (clock() < startRef.current || s.done) return;
    if (s.lastSide === side) s.v *= SPRINT.stumble; // mismo botón dos veces: tropiezo
    else {
      s.v = Math.min(SPRINT.maxSpeed, s.v + SPRINT.impulse);
      s.pendingTaps += 1;
    }
    s.lastSide = side;
    setState((st) => ({ ...st, side }));
  };
  useKeys({ ArrowLeft: () => tap('L'), a: () => tap('L'), z: () => tap('L'), ArrowRight: () => tap('R'), d: () => tap('R'), x: () => tap('R') });

  useEffect(() => {
    let raf;
    let last = performance.now();
    let lastPulse = 0;
    const s = sim.current;
    const frame = (ts) => {
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      const waiting = clock() < startRef.current;
      if (!waiting && !s.done) {
        s.t += dt;
        s.v = Math.max(0, s.v - s.v * SPRINT.drag * dt);
        if (!teamMode) {
          s.d = Math.min(SPRINT.length, s.d + s.v * dt);
          if (s.d >= SPRINT.length) {
            s.done = true;
            cbs.current.onFinish?.(Math.round(s.t * 100) / 100);
          }
        }
        if (ts - lastPulse > PULSE_MS) {
          lastPulse = ts;
          if (teamMode) {
            if (s.pendingTaps) cbs.current.onTaps?.(s.pendingTaps);
          } else cbs.current.onPulse?.({ d: Math.round(s.d * 10) / 10 });
          s.pendingTaps = 0;
        }
      }
      setState((st) => ({ ...st, d: s.d, t: s.t, phase: waiting ? 'countdown' : s.done ? 'done' : 'running', count: Math.ceil((startRef.current - clock()) / 1000) }));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [teamMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const me = teamMode ? null : { key: 'me', label: 'Tú', color, d: state.d };
  const lanes = [...(me ? [me] : []), ...runners];
  const pct = (d) => `${Math.min(100, (d / SPRINT.length) * 100)}%`;

  return (
    <div className="sprint">
      <div className="arcade-hud">
        <span className={limit && state.t > limit ? 'text-red' : ''}>
          ⏱ {state.t.toFixed(2)} s{limit ? ` / meta ${limit.toFixed(2)} s` : ''}
        </span>
        {!teamMode && <span>🏃 {Math.round(state.d)} / 100 m</span>}
        {teamMode && <span>🤝 {Math.round(teamD)} / 100 m</span>}
      </div>
      <div className="sprint-track">
        {lanes.map((r) => (
          <div key={r.key} className={`sprint-lane ${r.key === 'me' ? 'is-me' : ''}`}>
            <span className="sprint-label">{r.label}</span>
            <div className="sprint-runway">
              <div className="sprint-runner" style={{ left: `calc(${pct(r.d)} - ${(Number.parseFloat(pct(r.d)) / 100) * 40}px)` }}>
                <Cat color={r.color} mood={r.d >= SPRINT.length ? 'love' : 'happy'} size={40} />
              </div>
            </div>
            <div className="finish-line" />
          </div>
        ))}
        {state.phase === 'countdown' && <div className="arcade-countdown">{state.count > 0 ? state.count : '¡Ya!'}</div>}
      </div>
      <div className="sprint-buttons">
        {['L', 'R'].map((side) => (
          <button
            key={side}
            className={`sprint-btn ${state.side === side ? 'is-last' : ''}`}
            onPointerDown={(e) => {
              e.preventDefault();
              tap(side);
            }}
            disabled={state.phase === 'done'}
          >
            🐾
            <small>{side === 'L' ? 'Izquierda (←)' : 'Derecha (→)'}</small>
          </button>
        ))}
      </div>
      <p className="muted small center">Alterna los dos botones lo más rápido que puedas. Si tocas el mismo dos veces, tu michi tropieza.</p>
    </div>
  );
}
