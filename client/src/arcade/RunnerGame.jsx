import { useEffect, useMemo, useRef, useState } from 'react';
import Cat from '../components/Cat.jsx';
import { useElementWidth, useKeys } from '../hooks/gameHooks.js';
import { RUNNER, buildRunnerCourse, runnerSpeedAt } from './engines.js';

const CAT_X = 1.8; // metros desde el borde izquierdo
const PULSE_MS = 120;

/**
 * Michi Runner. modo libre (race=false): hasta chocar. modo carrera (race=true): hasta la meta,
 * los choques solo te frenan un momento.
 * - startAt/now: instante de salida en el reloj del servidor (carreras en pareja)
 * - ghost: { d, y, duck } de tu pareja para dibujarla como fantasma
 */
export default function RunnerGame({ seed, race = false, length = 0, startAt, now, ghost, ghostColor = 'gray', myColor = 'orange', onPulse, onEnd, label }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const catRef = useRef(null);
  const ghostRef = useRef(null);
  const width = useElementWidth(wrapRef);
  const scale = Math.max(36, Math.min(64, width / 9));
  const height = Math.round(Math.max(230, Math.min(360, width * 0.58)));
  const groundY = height - 36;
  const course = useMemo(() => buildRunnerCourse(seed, race ? length + 30 : 9000, race), [seed, race, length]);
  const sim = useRef({ d: 0, y: 0, vy: 0, t: 0, fish: 0, stumbleUntil: -1, invulnUntil: -1, over: false });
  const input = useRef({ jump: false, duck: false });
  const ghostState = useRef(null);
  const [hud, setHud] = useState({ d: 0, fish: 0, t: 0, phase: 'countdown', count: 3 });
  const startRef = useRef(startAt ?? null);
  const cbs = useRef({ onPulse, onEnd });
  cbs.current = { onPulse, onEnd };

  useEffect(() => {
    ghostState.current = ghost || null;
  }, [ghost]);

  useEffect(() => {
    if (startRef.current == null) startRef.current = Date.now() + 3000;
  }, []);

  const jump = () => {
    input.current.jump = true;
  };
  const duck = (on) => {
    input.current.duck = on;
  };
  useKeys({ ' ': jump, ArrowUp: jump, w: jump, ArrowDown: () => duck(true), s: () => duck(true) }, true, { ArrowDown: () => duck(false), s: () => duck(false) });

  useEffect(() => {
    if (!width) return undefined;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const clock = now || (() => Date.now());
    let raf;
    let last = performance.now();
    let lastPulse = 0;
    let lastHud = 0;
    const s = sim.current;

    const frame = (ts) => {
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      const waiting = clock() < startRef.current;

      if (!waiting && !s.over) {
        s.t += dt;
        let v = runnerSpeedAt(s.d, race);
        if (race && s.t < s.stumbleUntil) v = 0;
        else if (race && s.t < s.stumbleUntil + 0.5) v *= (s.t - s.stumbleUntil) / 0.5;
        s.d += v * dt;
        if (input.current.jump && s.y <= 0) s.vy = RUNNER.jumpV;
        input.current.jump = false;
        s.vy -= RUNNER.gravity * dt + (input.current.duck && s.y > 0 ? 40 * dt : 0);
        s.y = Math.max(0, s.y + s.vy * dt);
        if (s.y === 0) s.vy = Math.max(0, s.vy);

        const top = s.y + (input.current.duck && s.y <= 0.05 ? RUNNER.duckH : RUNNER.catH);
        for (const o of course.obstacles) {
          if (o.x > s.d + 1.5) break;
          if (o.x + o.w < s.d - 1.5 || o.hit) continue;
          const overlapX = s.d + RUNNER.catHalfW > o.x && s.d - RUNNER.catHalfW < o.x + o.w;
          const overlapY = s.y < o.y + o.h && top > o.y;
          if (overlapX && overlapY) {
            if (!race) {
              s.over = true;
              cbs.current.onEnd?.({ score: Math.round(s.d + s.fish * 10), distance: Math.round(s.d), fish: s.fish });
            } else if (s.t > s.invulnUntil) {
              o.hit = true;
              s.stumbleUntil = s.t + 0.8;
              s.invulnUntil = s.t + 1.8;
              navigator.vibrate?.(60);
            }
          }
        }
        for (const f of course.fish) {
          if (f.x > s.d + 1) break;
          if (!f.taken && Math.abs(f.x - s.d) < 0.55 && f.y < top + 0.1 && f.y + 0.4 > s.y) {
            f.taken = true;
            s.fish += 1;
          }
        }
        if (race && s.d >= length) {
          s.d = length;
          s.over = true;
          cbs.current.onEnd?.({ time: Math.round(s.t * 100) / 100 });
        }
        if (ts - lastPulse > PULSE_MS) {
          lastPulse = ts;
          cbs.current.onPulse?.({ d: Math.round(s.d * 10) / 10, y: Math.round(s.y * 100) / 100, duck: input.current.duck });
        }
      }

      // ---------- dibujo ----------
      const view = width / scale;
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#2b1c4d');
      sky.addColorStop(1, '#6b3f8f');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let k = 0; k < 6; k++) {
        const hx = ((k * 260 - s.d * scale * 0.25) % (width + 260) + width + 260) % (width + 260) - 130;
        ctx.beginPath();
        ctx.arc(hx, groundY + 20, 120, Math.PI, 0);
        ctx.fill();
      }
      ctx.fillStyle = '#3b2516';
      ctx.fillRect(0, groundY, width, height - groundY);
      ctx.fillStyle = '#5c361d';
      const stripe = (s.d * scale) % 48;
      for (let x = -stripe; x < width; x += 48) ctx.fillRect(x, groundY + 10, 24, 5);

      const toX = (x) => (x - s.d + CAT_X) * scale;
      if (race) {
        const fx = toX(length);
        if (fx < width + 20) {
          for (let k = 0; k < 8; k++) {
            ctx.fillStyle = k % 2 ? '#fff' : '#1e1729';
            ctx.fillRect(fx, groundY - 8 * 14 + k * 14, 10, 14);
            ctx.fillStyle = k % 2 ? '#1e1729' : '#fff';
            ctx.fillRect(fx + 10, groundY - 8 * 14 + k * 14, 10, 14);
          }
        }
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      for (const o of course.obstacles) {
        if (o.x > s.d + view) break;
        if (o.x + o.w < s.d - CAT_X - 1) continue;
        const size = Math.max(o.w, o.h) * scale * 1.3;
        ctx.globalAlpha = o.hit ? 0.35 : 1;
        ctx.font = `${size}px serif`;
        ctx.fillText(o.emoji, toX(o.x + o.w / 2), groundY - o.y * scale + size * 0.08);
      }
      ctx.globalAlpha = 1;
      for (const f of course.fish) {
        if (f.x > s.d + view) break;
        if (f.taken || f.x < s.d - CAT_X - 1) continue;
        const size = scale * 0.6;
        ctx.font = `${size}px serif`;
        ctx.fillText('🐟', toX(f.x), groundY - f.y * scale);
      }

      // michi propio y fantasma (elementos DOM para usar el SVG del michi)
      const ducking = input.current.duck && s.y <= 0.05;
      const blink = race && s.t < s.invulnUntil && Math.floor(s.t * 10) % 2 === 0;
      if (catRef.current) {
        catRef.current.style.transform = `translate(${CAT_X * scale - scale * 0.55}px, ${-s.y * scale}px) scaleY(${ducking ? 0.55 : 1})`;
        catRef.current.style.opacity = blink ? 0.4 : 1;
      }
      const g = ghostState.current;
      if (ghostRef.current) {
        if (g) {
          const gx = (g.d - s.d + CAT_X) * scale - scale * 0.55;
          ghostRef.current.style.display = gx > -scale && gx < width ? 'block' : 'none';
          ghostRef.current.style.transform = `translate(${gx}px, ${-(g.y || 0) * scale}px) scaleY(${g.duck && !g.y ? 0.55 : 1})`;
        } else ghostRef.current.style.display = 'none';
      }

      if (ts - lastHud > 150) {
        lastHud = ts;
        setHud({ d: s.d, fish: s.fish, t: s.t, phase: waiting ? 'countdown' : s.over ? 'over' : 'running', count: Math.ceil((startRef.current - clock()) / 1000) });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [width, height, scale, course, race, length, now, groundY]);

  const g = ghost;
  const diff = g ? g.d - hud.d : 0;
  return (
    <div className="arcade">
      <div className="arcade-hud">
        {race ? (
          <>
            <span>🏁 {Math.round(hud.d)}/{length} m</span>
            <span>⏱ {hud.t.toFixed(1)} s</span>
            {g && <span className={diff > 0 ? 'text-red' : 'text-mint'}>{label || 'Pareja'} {diff > 0 ? `+${Math.round(diff)}` : Math.round(diff)} m</span>}
          </>
        ) : (
          <>
            <span>🏃 {Math.round(hud.d)} m</span>
            <span>🐟 {hud.fish}</span>
            <span>⭐ {Math.round(hud.d + hud.fish * 10)}</span>
          </>
        )}
      </div>
      <div
        className="arcade-stage"
        ref={wrapRef}
        style={{ height }}
        onPointerDown={(e) => {
          if (e.target.closest('button')) return;
          jump();
        }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height }} />
        <div className="runner-cat is-ghost" ref={ghostRef} style={{ bottom: height - groundY, width: scale * 1.1, display: 'none' }}>
          <Cat color={ghostColor} mood="happy" size={scale * 1.1} />
        </div>
        <div className="runner-cat" ref={catRef} style={{ bottom: height - groundY, width: scale * 1.1 }}>
          <Cat color={myColor} mood={hud.phase === 'over' && !race ? 'shocked' : 'happy'} size={scale * 1.1} />
        </div>
        {hud.phase === 'countdown' && <div className="arcade-countdown">{hud.count > 0 ? hud.count : '¡Ya!'}</div>}
      </div>
      <div className="arcade-buttons">
        <button className="btn btn-ghost btn-lg" onPointerDown={(e) => { e.preventDefault(); duck(true); }} onPointerUp={() => duck(false)} onPointerLeave={() => duck(false)} onPointerCancel={() => duck(false)}>
          ⬇ Agacharse
        </button>
        <button className="btn btn-primary btn-lg" onPointerDown={(e) => { e.preventDefault(); jump(); }}>
          ⬆ Saltar
        </button>
      </div>
    </div>
  );
}
