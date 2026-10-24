import { useEffect, useRef, useState } from 'react';
import Cat from '../../components/Cat.jsx';
import { CAT_FILL } from './arena/arena.jsx';

const COLS = 7;
const ROWS = 6;
const CELL = 100;
const PAD = 12;
const TOP = CELL; // fila de vista previa encima del tablero
const W = COLS * CELL + PAD * 2;
const H = TOP + ROWS * CELL + PAD * 2;
const DROP_MS = 420;

const cx = (c) => PAD + c * CELL + CELL / 2;
const cy = (r) => TOP + PAD + r * CELL + CELL / 2;

/** Ficha: círculo del color del michi con su carita encima (todo SVG, sin foreignObject). */
function Piece({ x, y, color, mood = 'happy', ghost = false, glow = false }) {
  const r = CELL * 0.42;
  const cat = CELL * 0.62;
  return (
    <g transform={`translate(${x} ${y})`} opacity={ghost ? 0.45 : 1}>
      {glow && <circle r={r + 7} fill="none" stroke="#ffcf5a" strokeWidth="7" className="c4-line-piece" />}
      <circle r={r} fill={CAT_FILL[color] || '#f59e42'} stroke="rgba(0,0,0,0.35)" strokeWidth="4" />
      <g transform={`translate(${-cat / 2} ${-cat * 0.46})`}>
        <Cat color={color} mood={mood} size={cat} />
      </g>
    </g>
  );
}

/** Conecta 4 de michis: un solo SVG que escala con la pantalla (funciona igual en Safari/iPhone). */
export default function Connect4Game({ match, act, colors }) {
  const { me, state, players } = match;
  const active = match.status === 'active';
  const myTurn = active && state.turn === me;
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(null);
  const [anim, setAnim] = useState(null); // { r, c, t } ficha cayendo (t de 0 a 1)
  const lastKey = useRef(state.last ? `${state.last.r},${state.last.c}` : null);
  const inLine = (r, c) => Boolean(state.line?.some(([lr, lc]) => lr === r && lc === c));
  const full = (c) => state.board[0][c] !== null;

  // Animación de caída de la última ficha (con JS: las animaciones CSS en SVG fallan en Safari viejo)
  useEffect(() => {
    const key = state.last ? `${state.last.r},${state.last.c}` : null;
    if (!key || key === lastKey.current) return undefined;
    lastKey.current = key;
    const { r, c } = state.last;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DROP_MS);
      setAnim(t < 1 ? { r, c, t } : null);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state.last]);

  const drop = async (col) => {
    if (!myTurn || busy || full(col)) return;
    setBusy(true);
    setHover(null);
    try {
      await act({ type: 'drop', col });
    } catch {
      // el error ya se muestra como aviso
    } finally {
      setBusy(false);
    }
  };

  // Rebote al final de la caída
  const fallY = (r, t) => {
    const from = TOP / 2;
    const to = cy(r);
    const e = t < 0.8 ? (t / 0.8) ** 2 : 1 - Math.sin(((t - 0.8) / 0.2) * Math.PI) * 0.06;
    return from + (to - from) * e;
  };

  const winner = state.line ? state.board[state.line[0][0]][state.line[0][1]] : null;
  let banner;
  if (!active) banner = winner === null ? '¡Empate! Tablero lleno' : winner === me ? '¡Conectaste 4! 🎉' : `${players[1 - me].displayName} conectó 4`;
  else if (myTurn) banner = busy ? 'Soltando…' : '¡Tu turno! Toca una columna';
  else banner = `Turno de ${players[1 - me].displayName}…`;

  return (
    <div className="c4-svg-wrap">
      <div className={`turn-banner ${myTurn ? 'is-mine' : ''}`}>{banner}</div>
      <div className="small muted" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, margin: '-4px 0 8px' }}>
        <Cat color={colors[me]} size={20} />
        <span>tus fichas ·</span>
        <Cat color={colors[1 - me]} size={20} />
        <span>{players[1 - me].displayName}</span>
      </div>
      <svg className="c4-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tablero de Conecta 4" onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="c4-board" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4a7de6" />
            <stop offset="1" stopColor="#23408a" />
          </linearGradient>
        </defs>

        {/* Vista previa de la ficha en la columna elegida */}
        {myTurn && !busy && hover !== null && !full(hover) && <Piece x={cx(hover)} y={TOP / 2} color={colors[me]} ghost />}

        <rect x="2" y={TOP + 2} width={W - 4} height={H - TOP - 4} rx="26" fill="url(#c4-board)" stroke="#1c3370" strokeWidth="6" />
        {state.board.map((row, r) =>
          row.map((who, c) => (
            <circle key={`h${r}-${c}`} cx={cx(c)} cy={cy(r)} r={CELL * 0.42} fill={hover === c && myTurn ? '#1a2d63' : '#0f1d44'} stroke="rgba(0,0,0,0.4)" strokeWidth="3" />
          )),
        )}

        {state.board.map((row, r) =>
          row.map((who, c) => {
            if (who === null) return null;
            const falling = anim && anim.r === r && anim.c === c;
            return (
              <Piece
                key={`p${r}-${c}`}
                x={cx(c)}
                y={falling ? fallY(r, anim.t) : cy(r)}
                color={colors[who]}
                mood={inLine(r, c) ? 'love' : 'happy'}
                glow={!falling && inLine(r, c)}
              />
            );
          }),
        )}

        {/* Zonas táctiles: una por columna, de arriba a abajo */}
        {Array.from({ length: COLS }, (_, c) => (
          <rect
            key={`z${c}`}
            className="c4-hit"
            x={PAD + c * CELL}
            y="0"
            width={CELL}
            height={H}
            fill="transparent"
            style={{ cursor: myTurn && !full(c) ? 'pointer' : 'default' }}
            onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(c)}
            onClick={() => drop(c)}
            role="button"
            aria-label={`Columna ${c + 1}${full(c) ? ' (llena)' : ''}`}
          />
        ))}
      </svg>
    </div>
  );
}
