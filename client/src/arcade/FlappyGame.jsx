import { useEffect, useMemo, useRef, useState } from 'react';
import Cat from '../components/Cat.jsx';
import { useElementWidth, useKeys } from '../hooks/gameHooks.js';
import { FLAPPY, buildFlappyPipes, flappyGap, flappySpeed } from './engines.js';

const YARN = ['#ff7eb6', '#7aa2ff', '#5ce1b5', '#ffcf5a', '#c084fc'];

/** Flappy Michi: toca para volar entre columnas de ovillos de lana. */
export default function FlappyGame({ seed, color = 'orange', onEnd }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const catRef = useRef(null);
  const width = useElementWidth(wrapRef);
  const height = Math.round(Math.max(380, Math.min(520, width * 1.25)));
  const pipes = useMemo(() => buildFlappyPipes(seed), [seed]);
  const sim = useRef({ y: 4.5, vy: 0, x: 0, score: 0, started: false, over: false });
  const [hud, setHud] = useState({ score: 0, phase: 'ready' });
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const flap = () => {
    const s = sim.current;
    if (s.over) return;
    s.started = true;
    s.vy = FLAPPY.flap;
  };
  useKeys({ ' ': flap, ArrowUp: flap, w: flap });

  useEffect(() => {
    if (!width) return undefined;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = sim.current;
    const k = height / FLAPPY.height; // px por unidad
    const floor = FLAPPY.height - FLAPPY.ground;
    let raf;
    let last = performance.now();

    const end = () => {
      s.over = true;
      navigator.vibrate?.(80);
      onEndRef.current?.({ score: s.score });
      setHud({ score: s.score, phase: 'over' });
    };

    const frame = (ts) => {
      const dt = Math.min(0.04, (ts - last) / 1000);
      last = ts;
      if (s.started && !s.over) {
        s.vy += FLAPPY.gravity * dt;
        s.y = Math.max(0.3, s.y + s.vy * dt);
        s.x += flappySpeed(s.score) * dt;
        if (s.y + FLAPPY.radius >= floor) end();
        for (const p of pipes) {
          const px = 6 + p.k * FLAPPY.spacing - s.x; // posición en pantalla (unidades)
          if (px > FLAPPY.catX + 2) break;
          if (px + FLAPPY.pipeW < FLAPPY.catX - 2) continue;
          const gap = flappyGap(s.score);
          const inX = FLAPPY.catX + FLAPPY.radius > px && FLAPPY.catX - FLAPPY.radius < px + FLAPPY.pipeW;
          const inGap = s.y - FLAPPY.radius > p.center - gap / 2 && s.y + FLAPPY.radius < p.center + gap / 2;
          if (inX && !inGap && !s.over) end();
          if (!p.passed && px + FLAPPY.pipeW < FLAPPY.catX - FLAPPY.radius) {
            p.passed = true;
            s.score += 1;
            setHud({ score: s.score, phase: 'running' });
          }
        }
      } else if (!s.started) {
        s.y = 4.5 + Math.sin(ts / 300) * 0.25;
      }

      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#2b1c4d');
      sky.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      const viewW = width / k;
      for (const p of pipes) {
        const px = 6 + p.k * FLAPPY.spacing - s.x;
        if (px > viewW) break;
        if (px + FLAPPY.pipeW < -1) continue;
        const gap = flappyGap(p.passed ? s.score - 1 : s.score);
        ctx.fillStyle = YARN[p.k % YARN.length];
        const x = px * k;
        const w = FLAPPY.pipeW * k;
        const topH = (p.center - gap / 2) * k;
        const botY = (p.center + gap / 2) * k;
        ctx.fillRect(x, 0, w, topH);
        ctx.fillRect(x, botY, w, floor * k - botY);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        for (let yy = 8; yy < topH; yy += 14) {
          ctx.beginPath();
          ctx.moveTo(x, yy);
          ctx.lineTo(x + w, yy + 6);
          ctx.stroke();
        }
        for (let yy = botY + 8; yy < floor * k; yy += 14) {
          ctx.beginPath();
          ctx.moveTo(x, yy);
          ctx.lineTo(x + w, yy + 6);
          ctx.stroke();
        }
        ctx.font = `${w}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧶', x + w / 2, topH);
        ctx.fillText('🧶', x + w / 2, botY);
      }
      ctx.fillStyle = '#3b2516';
      ctx.fillRect(0, floor * k, width, height - floor * k);
      if (catRef.current) {
        const size = FLAPPY.radius * 2.4 * k;
        catRef.current.style.transform = `translate(${FLAPPY.catX * k - size / 2}px, ${s.y * k - size / 2}px) rotate(${Math.max(-25, Math.min(60, s.vy * 5))}deg)`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [width, height, pipes]);

  const catSize = (FLAPPY.radius * 2.4 * height) / FLAPPY.height;
  return (
    <div className="arcade">
      <div className="arcade-hud">
        <span>🧶 {hud.score} ovillos</span>
      </div>
      <div className="arcade-stage" ref={wrapRef} style={{ height }} onPointerDown={flap}>
        <canvas ref={canvasRef} style={{ width: '100%', height }} />
        <div className="flappy-cat" ref={catRef} style={{ width: catSize }}>
          <Cat color={color} mood={hud.phase === 'over' ? 'shocked' : 'happy'} size={catSize} />
        </div>
        {hud.phase === 'ready' && <div className="arcade-countdown is-small">Toca para volar</div>}
      </div>
    </div>
  );
}
