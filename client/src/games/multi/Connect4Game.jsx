import { useState } from 'react';
import Cat from '../../components/Cat.jsx';

export default function Connect4Game({ match, act, colors }) {
  const { me, state, players } = match;
  const [busy, setBusy] = useState(false);
  const active = match.status === 'active';
  const myTurn = active && state.turn === me;
  const inLine = (r, c) => state.line?.some(([lr, lc]) => lr === r && lc === c);

  const drop = async (col) => {
    if (!myTurn || busy) return;
    setBusy(true);
    await act({ type: 'drop', col }).catch(() => {});
    setBusy(false);
  };

  return (
    <div className="c4-wrap">
      <div className={`turn-banner ${myTurn ? 'is-mine' : ''}`}>
        {!active ? 'Partida terminada' : myTurn ? '¡Tu turno! Toca una columna' : `Turno de ${players[1 - me].displayName}…`}
      </div>
      <div className="c4-board" style={{ '--cols': 7 }}>
        {[...Array(7).keys()].map((c) => (
          <button key={c} className="c4-col" onClick={() => drop(c)} disabled={!myTurn || busy || state.board[0][c] !== null} aria-label={`Columna ${c + 1}`}>
            {state.board.map((row, r) => {
              const who = row[c];
              const isLast = state.last?.r === r && state.last?.c === c;
              return (
                <span key={r} className={`c4-cell ${inLine(r, c) ? 'is-line' : ''}`}>
                  {who !== null && (
                    <span className={`c4-piece ${isLast ? 'is-last' : ''}`} style={{ '--row': r + 1 }}>
                      <Cat color={colors[who]} mood={inLine(r, c) ? 'love' : 'happy'} size="100%" />
                    </span>
                  )}
                </span>
              );
            })}
          </button>
        ))}
      </div>
    </div>
  );
}
