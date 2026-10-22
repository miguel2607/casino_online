import { useRef, useState } from 'react';
import Cat from '../../components/Cat.jsx';
import { useElementWidth } from '../../hooks/gameHooks.js';

export default function TicTacToeGame({ match, act, colors }) {
  const { me, state, players } = match;
  const ref = useRef(null);
  const width = useElementWidth(ref);
  const [busy, setBusy] = useState(false);
  const myTurn = match.status === 'active' && state.turn === me;
  const board = Math.min(width || 300, 380);
  const gap = 8;
  const cell = (board - gap * 2) / 3;

  const play = async (i) => {
    if (!myTurn || busy || state.cells[i] !== null) return;
    setBusy(true);
    await act({ type: 'play', cell: i }).catch(() => {});
    setBusy(false);
  };

  return (
    <div className="ttt-wrap" ref={ref}>
      <div className={`turn-banner ${myTurn ? 'is-mine' : ''}`}>
        {match.status !== 'active' ? 'Partida terminada' : myTurn ? '¡Tu turno! Pon tu michi' : `Turno de ${players[1 - me].displayName}…`}
      </div>
      <div className="ttt-board" style={{ width: board, height: board }}>
        {state.cells.map((v, i) => (
          <button
            key={i}
            className={`ttt-cell ${state.line?.includes(i) ? 'is-line' : ''} ${state.last === i ? 'is-last' : ''}`}
            style={{ width: cell, height: cell, marginRight: i % 3 < 2 ? gap : 0, marginBottom: i < 6 ? gap : 0 }}
            onClick={() => play(i)}
            disabled={!myTurn || v !== null}
            aria-label={`Casilla ${i + 1}`}
          >
            {v !== null && <Cat color={colors[v]} mood={state.line?.includes(i) ? 'love' : 'happy'} size={cell * 0.72} />}
          </button>
        ))}
      </div>
      <p className="muted small center">
        Tú juegas con <Cat color={colors[me]} size={18} className="inline-cat" /> · tres en línea gana · si empatan, recuperan la apuesta
      </p>
    </div>
  );
}
