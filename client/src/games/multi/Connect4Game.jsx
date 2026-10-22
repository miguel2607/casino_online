import { useRef, useState } from 'react';
import Cat from '../../components/Cat.jsx';
import { useElementWidth } from '../../hooks/gameHooks.js';

const COLS = 7;
const ROWS = 6;
const GAP = 4;
const PAD = 10;

export default function Connect4Game({ match, act, colors }) {
  const { me, state, players } = match;
  const ref = useRef(null);
  const width = useElementWidth(ref);
  const [busy, setBusy] = useState(false);
  const active = match.status === 'active';
  const myTurn = active && state.turn === me;
  const inLine = (r, c) => state.line?.some(([lr, lc]) => lr === r && lc === c);

  // Tamaños exactos en píxeles: Safari no estira los botones dentro de un grid, así que no
  // podemos depender de "1fr" ni de aspect-ratio (antes las casillas quedaban en 0×0 en iPhone)
  const boardW = Math.min(width || 0, 520);
  const colW = boardW ? Math.floor((boardW - PAD * 2 - GAP * (COLS - 1)) / COLS) : 0;
  const cell = Math.max(0, colW - 6);

  const drop = async (col) => {
    if (!myTurn || busy) return;
    setBusy(true);
    await act({ type: 'drop', col }).catch(() => {});
    setBusy(false);
  };

  return (
    <div className="c4-wrap" ref={ref}>
      <div className={`turn-banner ${myTurn ? 'is-mine' : ''}`}>
        {!active ? 'Partida terminada' : myTurn ? '¡Tu turno! Toca una columna' : `Turno de ${players[1 - me].displayName}…`}
      </div>
      {colW > 0 && (
        <div className="c4-board" style={{ padding: PAD }}>
          {Array.from({ length: COLS }, (_, c) => (
            <button
              key={c}
              className="c4-col"
              style={{ width: colW, marginRight: c < COLS - 1 ? GAP : 0 }}
              onClick={() => drop(c)}
              disabled={!myTurn || busy || state.board[0][c] !== null}
              aria-label={`Columna ${c + 1}`}
            >
              {state.board.map((row, r) => {
                const who = row[c];
                const isLast = state.last?.r === r && state.last?.c === c;
                return (
                  <span key={r} className={`c4-cell ${inLine(r, c) ? 'is-line' : ''}`} style={{ width: cell, height: cell, marginBottom: r < ROWS - 1 ? GAP : 0 }}>
                    {who !== null && (
                      <span className={`c4-piece ${isLast ? 'is-last' : ''}`} style={{ '--row': r + 1 }}>
                        <Cat color={colors[who]} mood={inLine(r, c) ? 'love' : 'happy'} size={cell * 0.92} />
                      </span>
                    )}
                  </span>
                );
              })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
