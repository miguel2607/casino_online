import { useEffect, useRef, useState } from 'react';
import { useElementWidth, useCountdown, useServerClock } from '../../hooks/gameHooks.js';

const COLORS = ['#2b2238', '#e94590', '#3d6fd8', '#13915f', '#f2a52b', '#9c3b16'];
const SIZES = [4, 8, 16];
const SEND_MS = 70;

function drawStroke(ctx, w, h, stroke, from = 0) {
  const pts = stroke.points;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = (stroke.size * w) / 400;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const start = Math.max(0, from - 1);
  ctx.moveTo(pts[start][0] * w, pts[start][1] * h);
  if (pts.length === 1) ctx.lineTo(pts[0][0] * w + 0.1, pts[0][1] * h);
  for (let k = start + 1; k < pts.length; k++) ctx.lineTo(pts[k][0] * w, pts[k][1] * h);
  ctx.stroke();
}

export default function DrawGame({ match, act, pulse, onPulse }) {
  const { me, state, players } = match;
  const other = players[1 - me].displayName;
  const isDrawer = state.drawer === me;
  const now = useServerClock(state.serverNow);
  const left = useCountdown(state.endsAt, now);
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const width = useElementWidth(wrapRef);
  const size = Math.min(width || 300, 480);
  const strokes = useRef([]);
  const drawing = useRef(null);
  const outbox = useRef([]);
  const [color, setColor] = useState(COLORS[0]);
  const [brush, setBrush] = useState(SIZES[1]);
  const [guess, setGuess] = useState('');
  const roundKey = `${state.round}-${state.phase}`;

  const redraw = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fffaf3';
    ctx.fillRect(0, 0, size, size);
    for (const s of strokes.current) drawStroke(ctx, size, size, s);
  };

  // Tamaño del lienzo y trazos que ya existían (al entrar o cambiar de ronda)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !size) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    strokes.current = (state.strokes || []).map((s) => ({ ...s, points: [...s.points] }));
    redraw();
  }, [size, roundKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trazos en vivo de quien dibuja
  useEffect(
    () =>
      onPulse((data) => {
        if (data.type === 'clear') strokes.current = [];
        if (data.type === 'stroke') {
          const existing = strokes.current.find((s) => s.id === data.id);
          if (existing) existing.points.push(...data.points);
          else strokes.current.push({ ...data, points: [...data.points] });
        }
        redraw();
      }),
    [onPulse, size], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Envío de los puntos dibujados en paquetes pequeños
  useEffect(() => {
    if (!isDrawer) return undefined;
    const id = setInterval(() => {
      if (!outbox.current.length) return;
      const batch = outbox.current;
      outbox.current = [];
      const byId = {};
      for (const p of batch) (byId[p.id] ||= { ...p.meta, points: [] }).points.push(p.pt);
      for (const s of Object.values(byId)) pulse({ type: 'stroke', ...s });
    }, SEND_MS);
    return () => clearInterval(id);
  }, [isDrawer, pulse]);

  const pointFrom = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))];
  };
  const canDraw = isDrawer && state.phase === 'drawing' && match.status === 'active';
  const down = (e) => {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const meta = { id, color, size: brush };
    drawing.current = { ...meta, points: [pointFrom(e)] };
    strokes.current.push(drawing.current);
    outbox.current.push({ id, meta, pt: drawing.current.points[0] });
    redraw();
  };
  const move = (e) => {
    const s = drawing.current;
    if (!s) return;
    const pt = pointFrom(e);
    s.points.push(pt);
    outbox.current.push({ id: s.id, meta: { id: s.id, color: s.color, size: s.size }, pt });
    drawStroke(canvasRef.current.getContext('2d'), size, size, s, s.points.length - 1);
  };
  const up = () => {
    drawing.current = null;
  };
  const clear = () => {
    strokes.current = [];
    redraw();
    pulse({ type: 'clear' });
  };

  const sendGuess = async (e) => {
    e.preventDefault();
    if (!guess.trim()) return;
    await act({ type: 'guess', text: guess }).catch(() => {});
    setGuess('');
  };

  const secs = Math.ceil(left / 1000);
  let banner;
  if (state.phase === 'choosing') banner = isDrawer ? 'Elige qué vas a dibujar' : `${other} está eligiendo qué dibujar…`;
  else if (state.phase === 'drawing') banner = isDrawer ? <>Dibuja: <b className="text-pink">{state.word}</b></> : `Adivina el dibujo de ${other} · ${state.wordLength} letras`;
  else if (state.phase === 'between') banner = state.correct[state.correct.length - 1] ? `¡Adivinado! Era «${state.lastWord}» 🎉` : `Se acabó el tiempo: era «${state.lastWord}»`;
  else banner = 'Preparando…';

  return (
    <div className="draw-wrap">
      <div className="draw-top">
        <span>
          Ronda {state.round}/{state.rounds}
        </span>
        <span className="draw-score">{state.correct.map((c, i) => <span key={i}>{c ? '✅' : '❌'}</span>)}</span>
        <span>{state.phase === 'drawing' || state.phase === 'choosing' ? `⏱ ${secs}s` : ''}</span>
      </div>
      <div className={`turn-banner ${isDrawer && state.phase !== 'between' ? 'is-mine' : ''}`}>{banner}</div>

      {state.phase === 'choosing' && isDrawer && state.options && (
        <div className="draw-options">
          {state.options.map((w) => (
            <button key={w} className="btn btn-primary btn-lg" onClick={() => act({ type: 'choose', word: w }).catch(() => {})}>
              {w}
            </button>
          ))}
        </div>
      )}

      <div className="draw-canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className={`draw-canvas ${canDraw ? 'is-drawing' : ''}`}
          style={{ width: size, height: size }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
      </div>

      {canDraw && (
        <div className="draw-tools">
          {COLORS.map((c) => (
            <button key={c} className={`draw-color ${color === c ? 'is-active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label="Color" />
          ))}
          {SIZES.map((s) => (
            <button key={s} className={`draw-size ${brush === s ? 'is-active' : ''}`} onClick={() => setBrush(s)} aria-label={`Grosor ${s}`}>
              <span style={{ width: s + 2, height: s + 2 }} />
            </button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={clear}>
            Borrar todo
          </button>
        </div>
      )}

      {!isDrawer && state.phase === 'drawing' && (
        <form className="draw-guess" onSubmit={sendGuess}>
          <input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="¿Qué es?" maxLength={40} autoComplete="off" />
          <button className="btn btn-primary">Adivinar</button>
        </form>
      )}

      {state.guesses.length > 0 && (
        <div className="draw-guesses">
          {state.guesses.slice(-6).map((g, i) => (
            <span key={i} className={g.ok ? 'is-ok' : ''}>
              {g.text}
            </span>
          ))}
        </div>
      )}
      <p className="muted small center">4 rondas, se turnan para dibujar. 4 aciertos: x3 · 3: x2 · 2: recuperan la apuesta.</p>
    </div>
  );
}
