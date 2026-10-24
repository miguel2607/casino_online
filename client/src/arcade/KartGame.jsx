import { useEffect, useMemo, useRef, useState } from 'react';
import Cat from '../components/Cat.jsx';
import { useElementWidth, useKeys } from '../hooks/gameHooks.js';
import { KART, buildKartCourse, kartSpeedAt } from './engines.js';

const VIEW_AHEAD = 42; // metros visibles por delante a velocidad normal
const VIEW_SECONDS = 0.8; // a mucha velocidad se ve un poco más lejos, pero con menos tiempo para reaccionar
const BOOST_FLASH_MS = 700;

/** Michi Kart: tres carriles, esquiva obstáculos y recoge pescaditos (cada uno te acelera). */
export default function KartGame({ seed, color = 'orange', onEnd }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const catRef = useRef(null);
  const width = useElementWidth(wrapRef);
  const height = Math.round(Math.max(380, Math.min(540, width * 1.3)));
  const rows = useMemo(() => buildKartCourse(seed), [seed]);
  const sim = useRef({ d: 0, lane: 1, pos: 1, coins: 0, view: VIEW_AHEAD, dash: 0, boostAt: -Infinity, over: false, started: false });
  const [hud, setHud] = useState({ d: 0, coins: 0, speed: KART.startSpeed, phase: 'ready' });
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
    const laneX = (l) => roadX + laneW * (l + 0.5);
    let raf;
    let last = performance.now();
    let lastHud = 0;

    const frame = (ts) => {
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      const v = kartSpeedAt(s.d, s.coins);
      // La cámara se aleja poco a poco al acelerar (sin saltos bruscos)
      s.view += (Math.max(VIEW_AHEAD, v * VIEW_SECONDS) - s.view) * Math.min(1, dt * 3);
      const scale = (kartY - 10) / s.view;
      if (s.started && !s.over) {
        const prev = s.d;
        s.d += v * dt;
        s.dash = (s.dash + v * dt * scale) % 40;
        const step = dt / KART.switchTime;
        s.pos += Math.max(-step, Math.min(step, s.lane - s.pos));
        // Se revisa todo el tramo recorrido en este cuadro: a mucha velocidad se avanzan varios metros
        for (const r of rows) {
          if (r.x > s.d + 0.8) break;
          if (r.x < prev - 0.8) continue;
          if (r.blocked.some((l) => Math.abs(l - s.pos) < 0.55)) {
            s.d = Math.min(s.d, r.x);
            s.over = true;
            navigator.vibrate?.(80);
            onEndRef.current?.({ score: Math.round(s.d + s.coins * 15) });
            break;
          }
          if (r.coin && !r.coin.taken && Math.abs(r.coin.lane - s.pos) < 0.5) {
            r.coin.taken = true;
            s.coins += 1;
            s.boostAt = ts;
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
      for (let l = 1; l < 3; l++) for (let y = -40 + s.dash; y < height; y += 40) ctx.fillRect(roadX + laneW * l - 2, y, 4, 22);
      ctx.fillStyle = '#ffcf5a';
      ctx.fillRect(roadX - 4, 0, 4, height);
      ctx.fillRect(roadX + laneW * 3, 0, 4, height);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const size = Math.min(laneW * 0.62, 56);
      for (const r of rows) {
        if (r.x > s.d + s.view + 2) break;
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

      // Aviso de acelerón al comer un pescadito
      const sinceBoost = ts - s.boostAt;
      if (sinceBoost < BOOST_FLASH_MS) {
        const k = sinceBoost / BOOST_FLASH_MS;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#ffcf5a';
        ctx.font = `bold ${Math.round(18 + 10 * k)}px sans-serif`;
        ctx.fillText('🐟 ¡Más rápido!', kx, kartY - size * 1.3 - 30 * k);
        ctx.globalAlpha = 1;
      }

      if (ts - lastHud > 150) {
        lastHud = ts;
        setHud({ d: s.d, coins: s.coins, speed: v, phase: s.over ? 'over' : s.started ? 'running' : 'ready' });
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
        <span className={hud.speed >= 60 ? 'text-red' : ''}>💨 {Math.round(hud.speed * 3.6)} km/h</span>
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
