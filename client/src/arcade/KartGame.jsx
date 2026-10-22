import { useEffect, useMemo, useRef, useState } from 'react';
import Cat from '../components/Cat.jsx';
import { useElementWidth, useKeys } from '../hooks/gameHooks.js';
import { KART, buildKartCourse, kartSpeedAt } from './engines.js';

const VIEW_AHEAD = 26; // metros visibles por delante

/** Michi Kart: tres carriles, esquiva obstáculos y recoge pescaditos. */
export default function KartGame({ seed, color = 'orange', onEnd }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const catRef = useRef(null);
  const width = useElementWidth(wrapRef);
  const height = Math.round(Math.max(380, Math.min(540, width * 1.3)));
  const rows = useMemo(() => buildKartCourse(seed), [seed]);
  const sim = useRef({ d: 0, lane: 1, pos: 1, coins: 0, over: false, started: false });
  const [hud, setHud] = useState({ d: 0, coins: 0, phase: 'ready' });
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const steer = (dir) => {
    const s = sim.current;
    if (s.over) return;
    s.started = true;
    s.lane = Math.max(0, Math.min(KART.lanes - 1, s.lane + dir));
  };
  useKeys({ ArrowLeft: () => steer(-1), a: () => steer(-1), ArrowRight: () => steer(1), d: () => steer(1) });

  useEffect(() => {
    if (!width) return undefined;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = sim.current;
    const laneW = Math.min(width / 3.4, 130);
    const roadX = (width - laneW * 3) / 2;
    const kartY = height * 0.82;
    const scale = (kartY - 10) / VIEW_AHEAD;
    const laneX = (l) => roadX + laneW * (l + 0.5);
    let raf;
    let last = performance.now();
    let lastHud = 0;

    const frame = (ts) => {
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      if (s.started && !s.over) {
        s.d += kartSpeedAt(s.d) * dt;
        const step = dt / KART.switchTime;
        s.pos += Math.max(-step, Math.min(step, s.lane - s.pos));
        for (const r of rows) {
          if (r.x > s.d + 1) break;
          if (r.x < s.d - 1) continue;
          if (Math.abs(r.x - s.d) < 0.8) {
            if (r.blocked.some((l) => Math.abs(l - s.pos) < 0.55)) {
              s.over = true;
              navigator.vibrate?.(80);
              onEndRef.current?.({ score: Math.round(s.d + s.coins * 15) });
            }
            if (r.coin && !r.coin.taken && Math.abs(r.coin.lane - s.pos) < 0.5) {
              r.coin.taken = true;
              s.coins += 1;
            }
          }
        }
      }

      ctx.fillStyle = '#1c1331';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#2f6b3a';
      ctx.fillRect(0, 0, roadX, height);
      ctx.fillRect(roadX + laneW * 3, 0, width, height);
      ctx.fillStyle = '#3a3347';
      ctx.fillRect(roadX, 0, laneW * 3, height);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const dash = (s.d * scale) % 40;
      for (let l = 1; l < 3; l++) for (let y = -40 + dash; y < height; y += 40) ctx.fillRect(roadX + laneW * l - 2, y, 4, 22);
      ctx.fillStyle = '#ffcf5a';
      ctx.fillRect(roadX - 4, 0, 4, height);
      ctx.fillRect(roadX + laneW * 3, 0, 4, height);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const size = Math.min(laneW * 0.62, 56);
      for (const r of rows) {
        if (r.x > s.d + VIEW_AHEAD + 2) break;
        if (r.x < s.d - 4) continue;
        const y = kartY - (r.x - s.d) * scale;
        ctx.font = `${size}px serif`;
        r.blocked.forEach((l, k) => ctx.fillText(r.emoji[k], laneX(l), y));
        if (r.coin && !r.coin.taken) {
          ctx.font = `${size * 0.7}px serif`;
          ctx.fillText('🐟', laneX(r.coin.lane), y);
        }
      }
      // carro del michi
      const kx = roadX + laneW * (s.pos + 0.5);
      ctx.fillStyle = '#e94590';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(kx - size * 0.45, kartY - size * 0.05, size * 0.9, size * 0.55, 10) : ctx.rect(kx - size * 0.45, kartY - size * 0.05, size * 0.9, size * 0.55);
      ctx.fill();
      if (catRef.current) catRef.current.style.transform = `translate(${kx - size * 0.4}px, ${kartY - size * 0.75}px)`;

      if (ts - lastHud > 150) {
        lastHud = ts;
        setHud({ d: s.d, coins: s.coins, phase: s.over ? 'over' : s.started ? 'running' : 'ready' });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [width, height, rows]);

  const laneSize = Math.min((width || 300) / 3.4, 130) * 0.62;
  return (
    <div className="arcade">
      <div className="arcade-hud">
        <span>🏎 {Math.round(hud.d)} m</span>
        <span>🐟 {hud.coins}</span>
        <span>⭐ {Math.round(hud.d + hud.coins * 15)}</span>
      </div>
      <div
        className="arcade-stage"
        ref={wrapRef}
        style={{ height }}
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          steer(e.clientX - rect.left < rect.width / 2 ? -1 : 1);
        }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height }} />
        <div className="kart-cat" ref={catRef} style={{ width: laneSize * 0.8 }}>
          <Cat color={color} mood={hud.phase === 'over' ? 'shocked' : 'happy'} size={Math.min(laneSize * 0.8, 44)} />
        </div>
        {hud.phase === 'ready' && <div className="arcade-countdown is-small">Toca un lado para arrancar</div>}
      </div>
      <div className="arcade-buttons">
        <button className="btn btn-ghost btn-lg" onPointerDown={(e) => { e.preventDefault(); steer(-1); }}>
          ⬅ Izquierda
        </button>
        <button className="btn btn-ghost btn-lg" onPointerDown={(e) => { e.preventDefault(); steer(1); }}>
          Derecha ➡
        </button>
      </div>
    </div>
  );
}
