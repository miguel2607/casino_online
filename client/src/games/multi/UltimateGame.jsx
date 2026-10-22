import { useRef, useState } from 'react';
import Cat from '../../components/Cat.jsx';
import { useElementWidth } from '../../hooks/gameHooks.js';

export default function UltimateGame({ match, act, colors }) {
  const { me, state, players } = match;
  const ref = useRef(null);
  const width = useElementWidth(ref);
  const [busy, setBusy] = useState(false);
  const myTurn = match.status === 'active' && state.turn === me;
  const boardPx = Math.min(width || 300, 460);
  const gap = 6;
  const small = (boardPx - gap * 2) / 3;
  const cell = (small - 8) / 3;

  const allowed = (b) => match.status === 'active' && state.small[b] === null && (state.next === null || state.next === b);

  const play = async (board, cellIdx) => {
    if (!myTurn || busy || !allowed(board) || state.cells[board * 9 + cellIdx] !== null) return;
    setBusy(true);
    await act({ type: 'play', board, cell: cellIdx }).catch(() => {});
    setBusy(false);
  };

  return (
    <div className="ut-wrap" ref={ref}>
      <div className={`turn-banner ${myTurn ? 'is-mine' : ''}`}>
        {match.status !== 'active'
          ? 'Partida terminada'
          : myTurn
            ? state.next === null
              ? '¡Tu turno! Puedes jugar en cualquier tablero libre'
              : '¡Tu turno! Juega en el tablero resaltado'
            : `Turno de ${players[1 - me].displayName}…`}
      </div>
      <div className="ut-board" style={{ width: boardPx, height: boardPx, gap }}>
        {Array.from({ length: 9 }, (_, b) => {
          const won = state.small[b];
          return (
            <div key={b} className={`ut-small ${myTurn && allowed(b) ? 'is-allowed' : ''} ${won !== null ? 'is-decided' : ''}`} style={{ width: small, height: small }}>
              {Array.from({ length: 9 }, (_, i) => {
                const v = state.cells[b * 9 + i];
                const isLast = state.last?.board === b && state.last?.cell === i;
                return (
                  <button key={i} className={`ut-cell ${isLast ? 'is-last' : ''}`} style={{ width: cell, height: cell }} onClick={() => play(b, i)} disabled={!myTurn || !allowed(b) || v !== null}>
                    {v !== null && <Cat color={colors[v]} mood="happy" size={cell * 0.8} />}
                  </button>
                );
              })}
              {won !== null && (
                <div className="ut-won">{won === 'draw' ? <span>🤝</span> : <Cat color={colors[won]} mood="love" size={small * 0.7} />}</div>
              )}
            </div>
          );
        })}
      </div>
      <p className="muted small center">Gana 3 tableros en línea. La casilla donde juegas decide en qué tablero juega tu pareja.</p>
    </div>
  );
}
