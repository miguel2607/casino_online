import { useEffect, useRef, useState } from 'react';
import { useElementWidth, useServerClock } from '../../../hooks/gameHooks.js';

// Piezas comunes de los juegos de acción en pareja: el servidor mueve la física y manda
// "fotos" del mundo ~25 veces por segundo; el celular dibuja, suaviza y manda su joystick.

/** Última foto del mundo que mandó el servidor (en un ref: se lee en cada cuadro sin re-render). */
export function useArena(onPulse, initial) {
  const ref = useRef({ snap: initial, at: performance.now() });
  useEffect(
    () =>
      onPulse((data, from) => {
        if (from !== -1) return;
        ref.current = { snap: data, at: performance.now() };
      }),
    [onPulse],
  );
  return ref;
}

/** Igual que useArena, pero también re-renderiza (para marcadores) como mucho cada `ms`. */
export function useArenaHud(arenaRef, pick, ms = 200) {
  const [hud, setHud] = useState(() => pick(arenaRef.current.snap));
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    const id = setInterval(() => {
      const next = pickRef.current(arenaRef.current.snap);
      setHud((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    }, ms);
    return () => clearInterval(id);
  }, [arenaRef, ms]);
  return hud;
}

/** Manda las entradas del jugador: al cambiar y, como latido, cada 250 ms. */
export function useInputSender(pulse, inputRef, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    let lastJson = '';
    let lastAt = 0;
    const id = setInterval(() => {
      const data = inputRef.current;
      const json = JSON.stringify(data);
      const now = performance.now();
      if (json !== lastJson || now - lastAt > 250) {
        lastJson = json;
        lastAt = now;
        pulse(data);
      }
    }, 50);
    return () => clearInterval(id);
  }, [pulse, inputRef, active]);
}

/** Acerca suavemente un valor mostrado al valor real (los ticks llegan a saltos). */
export const ease = (shown, target, dt, speed = 14) => (shown == null ? target : shown + (target - shown) * Math.min(1, dt * speed));

/** Ángulo suavizado por el camino corto. */
export function easeAngle(shown, target, dt, speed = 14) {
  if (shown == null) return target;
  let d = target - shown;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return shown + d * Math.min(1, dt * speed);
}

/**
 * Lienzo que ocupa el ancho disponible con una proporción fija. `draw(ctx, w, h, dt, now)` se
 * llama en cada cuadro. Devuelve el ancho en px.
 */
export function ArenaCanvas({ aspect = 1, maxHeight = 640, draw, children, className = '', ...props }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const width = useElementWidth(wrapRef);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const [viewH, setViewH] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setViewH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // Que el juego y sus controles quepan en la pantalla sin tener que bajar
  const fitH = Math.min(maxHeight, Math.max(300, viewH - 270));
  const w = Math.min(width || 0, fitH / aspect);
  const h = Math.round(w * aspect);

  useEffect(() => {
    if (!w) return undefined;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    let raf;
    let last = performance.now();
    const frame = (ts) => {
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      try {
        drawRef.current(ctx, w, h, dt, ts);
      } catch (err) {
        console.error(err);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [w, h]);

  return (
    <div className={`arena-wrap ${className}`} ref={wrapRef}>
      <div className="arena-stage" style={{ width: w || '100%', height: h || 200 }} {...props}>
        <canvas ref={canvasRef} style={{ width: w || '100%', height: h || 200 }} />
        {children}
      </div>
    </div>
  );
}

/** Cuenta regresiva antes de arrancar (hora del servidor). */
export function ArenaCountdown({ startAt, serverNow }) {
  const now = useServerClock(serverNow);
  const [left, setLeft] = useState(() => startAt - now());
  useEffect(() => {
    const id = setInterval(() => setLeft(startAt - now()), 100);
    return () => clearInterval(id);
  }, [startAt, now]);
  if (left <= -700) return null;
  return <div className="arcade-countdown">{left > 0 ? Math.ceil(left / 1000) : '¡YA!'}</div>;
}

const KEY_DIRS = {
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0],
};

/**
 * Joystick virtual (dedo o mouse) + flechas/WASD en PC. Escribe en `inputRef.current.x/.y`
 * un vector de largo ≤ 1 (x a la derecha, y hacia abajo de la pantalla).
 */
export function Joystick({ inputRef, size = 132, label = 'Mover', keyboard = true }) {
  const baseRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });
  const pointer = useRef(null);
  const keys = useRef(new Set());

  const write = (x, y) => {
    inputRef.current = { ...inputRef.current, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
  };

  const move = (e) => {
    const rect = baseRef.current.getBoundingClientRect();
    const r = rect.width / 2;
    let x = (e.clientX - rect.left - r) / (r * 0.75);
    let y = (e.clientY - rect.top - r) / (r * 0.75);
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    // Zona muerta pequeña para que no se mueva solo al apoyar el dedo
    if (len < 0.12) {
      x = 0;
      y = 0;
    }
    write(x, y);
    setKnob({ x, y, active: true });
  };

  const release = () => {
    pointer.current = null;
    write(0, 0);
    setKnob({ x: 0, y: 0, active: false });
  };

  useEffect(() => {
    if (!keyboard) return undefined;
    const update = () => {
      let x = 0;
      let y = 0;
      for (const k of keys.current) {
        x += KEY_DIRS[k][0];
        y += KEY_DIRS[k][1];
      }
      const len = Math.hypot(x, y) || 1;
      write(x / len, y / len);
      setKnob({ x: x / len, y: y / len, active: keys.current.size > 0 });
    };
    const down = (e) => {
      const k = e.key.toLowerCase();
      if (!KEY_DIRS[k] || e.target.closest?.('input, textarea')) return;
      e.preventDefault();
      if (!keys.current.has(k)) {
        keys.current.add(k);
        update();
      }
    };
    const up = (e) => {
      const k = e.key.toLowerCase();
      if (keys.current.delete(k)) update();
    };
    const blur = () => {
      keys.current.clear();
      update();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [keyboard]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={baseRef}
      className={`joystick ${knob.active ? 'is-active' : ''}`}
      style={{ width: size, height: size }}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && move(e)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div className="joystick-knob" style={{ transform: `translate(${knob.x * size * 0.3}px, ${knob.y * size * 0.3}px)` }} />
      <span className="joystick-label">{label}</span>
    </div>
  );
}

/**
 * Botón de acción: cada toque suma 1 a `inputRef.current[name]` (el servidor cuenta los toques
 * nuevos) y mientras está apretado pone `inputRef.current[name + 'Held'] = true`.
 */
export function ActionButton({ inputRef, name, children, keys = [], className = '', disabled = false, size = 84 }) {
  const [held, setHeld] = useState(false);
  const press = () => {
    if (disabled) return;
    const cur = inputRef.current;
    inputRef.current = { ...cur, [name]: (cur[name] || 0) + 1, [`${name}Held`]: true };
    setHeld(true);
    navigator.vibrate?.(15);
  };
  const release = () => {
    inputRef.current = { ...inputRef.current, [`${name}Held`]: false };
    setHeld(false);
  };
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const pressRef = useRef(press);
  pressRef.current = press;
  const releaseRef = useRef(release);
  releaseRef.current = release;

  useEffect(() => {
    const down = (e) => {
      if (!keysRef.current.includes(e.key.toLowerCase()) || e.target.closest?.('input, textarea')) return;
      e.preventDefault();
      if (!e.repeat) pressRef.current();
    };
    const up = (e) => keysRef.current.includes(e.key.toLowerCase()) && releaseRef.current();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return (
    <button
      type="button"
      className={`action-btn ${held ? 'is-held' : ''} ${className}`}
      style={{ width: size, height: size }}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        press();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

/** Fila de controles: joystick a la izquierda y botones a la derecha. */
export function Controls({ children }) {
  return <div className="arena-controls">{children}</div>;
}

/** Dibuja un emoji centrado. */
export function emoji(ctx, ch, x, y, size) {
  // Chrome aplica la transparencia del color de relleno a los emojis: siempre opaco
  ctx.fillStyle = '#000';
  ctx.font = `${Math.round(size)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, x, y);
}

/** Colores de cada michi para dibujar en el canvas. */
export const CAT_FILL = {
  orange: '#f59e42',
  gray: '#9aa3b5',
  black: '#2b2b38',
  white: '#f4f1ea',
  calico: '#e9b872',
  cream: '#f3d9a4',
};
export const catFill = (color) => CAT_FILL[color] || '#f59e42';

/** Michi simple dibujado en canvas (cuerpo redondo con orejas), mirando hacia `angle`. */
export function drawCat(ctx, x, y, r, color, { angle = -Math.PI / 2, ring = null, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (ring) {
    ctx.strokeStyle = ring;
    ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.rotate(angle + Math.PI / 2);
  const fill = catFill(color);
  ctx.fillStyle = fill;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  // orejas
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * r * 0.75, -r * 0.35);
    ctx.lineTo(s * r * 0.6, -r * 1.15);
    ctx.lineTo(s * r * 0.15, -r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // ojos
  ctx.fillStyle = color === 'black' ? '#ffcf5a' : '#1c1331';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * r * 0.32, -r * 0.15, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff8fb1';
  ctx.beginPath();
  ctx.arc(0, r * 0.12, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
